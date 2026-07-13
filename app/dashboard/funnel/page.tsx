import { createAdminClient } from '@/lib/supabase/server'
import FunnelMatrix from './FunnelMatrix'
import BySourceTabs from './BySourceTabs'
import MonthSelector from './MonthSelector'
import StatCard from '@/components/ui/StatCard'
import { sortMonthLabelsDesc } from '@/lib/metrics/periods'
import { fetchAllRows } from '@/lib/supabase/paginate'
import {
  computeStageCounts,
  computeStagePercents,
  computeRawStatusRows,
  normalizeStatus,
  sumStageCounts,
  type StageCounts,
  type StagePercents,
  type RawStatusRow,
} from '@/lib/funnel/stages'

export interface AdvisorFunnelRow {
  advisor: string
  counts: StageCounts
  percents: StagePercents
  rawStatusRows: RawStatusRow[]
}

export interface SourceFunnelRow {
  source: string
  counts: StageCounts
  percents: StagePercents
  rawStatusRows: RawStatusRow[]
}

export interface AdvisorSourceFunnel {
  advisor: string
  rows: SourceFunnelRow[]
}

interface ContactRow {
  hubspot_id: string
  lead_status: string | null
  advisor: string | null
  segment: string | null
  original_source: string | null
  viable: boolean
}

interface DealRow {
  contact_hubspot_id: string | null
  advisor: string | null
  stage_label: string | null
}

export default async function FunnelPage({ searchParams }: { searchParams: { m?: string } }) {
  const supabase = createAdminClient()

  // Supabase/PostgREST caps unbounded selects at the project's Max Rows setting
  // (well under the 31k+ contact count), so this must page through .range() or
  // recent months silently vanish from the dropdown — see AUDIT_REPORT.md #11.
  const monthRows = await fetchAllRows<{ month: string }>((from, to) =>
    supabase.from('contacts').select('month').not('month', 'is', null).range(from, to)
  )

  const months = sortMonthLabelsDesc(
    Array.from(new Set(monthRows.map((r) => r.month)))
  )
  const selectedMonth = searchParams.m && months.includes(searchParams.m) ? searchParams.m : (months[0] ?? '')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('hubspot_id, lead_status, advisor, segment, original_source, viable')
    .eq('month', selectedMonth)

  const { data: deals } = await supabase
    .from('deals')
    .select('contact_hubspot_id, advisor, stage_label')
    .eq('month', selectedMonth)

  const allContacts = (contacts ?? []) as ContactRow[]
  const allDeals = (deals ?? []) as DealRow[]

  const advisorNames = Array.from(
    new Set([
      ...allContacts.map((c) => c.advisor),
      ...allDeals.map((d) => d.advisor),
    ].filter((a): a is string => !!a && a !== 'Unassigned'))
  ).sort()

  const advisors: AdvisorFunnelRow[] = advisorNames.map((advisor) => {
    const advisorContacts = allContacts.filter((c) => c.advisor === advisor)
    const advisorDeals = allDeals.filter((d) => d.advisor === advisor)
    const counts = computeStageCounts(advisorContacts, advisorDeals)
    return { advisor, counts, percents: computeStagePercents(counts), rawStatusRows: computeRawStatusRows(advisorContacts) }
  })

  const totalCounts = sumStageCounts(advisors.map((a) => a.counts))
  const totalRow: AdvisorFunnelRow = {
    advisor: 'Total',
    counts: totalCounts,
    percents: computeStagePercents(totalCounts),
    rawStatusRows: computeRawStatusRows(allContacts.filter((c) => advisorNames.includes(c.advisor ?? ''))),
  }

  // ── Source breakdown per advisor ──────────────────────────────────
  const sourceByContactId = new Map<string, string>()
  for (const c of allContacts) sourceByContactId.set(c.hubspot_id, c.original_source ?? 'Unknown')

  const sourceFunnels: AdvisorSourceFunnel[] = advisorNames.map((advisor) => {
    const advisorContacts = allContacts.filter((c) => c.advisor === advisor)
    const advisorDeals = allDeals.filter((d) => d.advisor === advisor)
    const sources = Array.from(new Set(advisorContacts.map((c) => c.original_source ?? 'Unknown')))

    const rows: SourceFunnelRow[] = sources
      .map((source) => {
        const sourceContacts = advisorContacts.filter((c) => (c.original_source ?? 'Unknown') === source)
        const sourceDeals = advisorDeals.filter((d) => sourceByContactId.get(d.contact_hubspot_id ?? '') === source)
        const counts = computeStageCounts(sourceContacts, sourceDeals)
        return { source, counts, percents: computeStagePercents(counts), rawStatusRows: computeRawStatusRows(sourceContacts) }
      })
      .sort((a, b) => b.counts.total - a.counts.total)

    return { advisor, rows }
  })

  // ── Summary stat cards (selected month) ────────────────────────────
  const totalConnected = allContacts.filter((c) => normalizeStatus(c.lead_status) === 'CONNECTED').length
  const totalApptBooked = allContacts.filter((c) => normalizeStatus(c.lead_status) === 'CAREER CONSULTATION BOOKED').length

  const segB2c = allContacts.filter((c) => c.viable && c.segment === 'B2C').length
  const segWfd = allContacts.filter((c) => c.viable && c.segment === 'WFD').length

  const sourceMap = new Map<string, number>()
  for (const c of allContacts.filter((c) => c.viable)) {
    const src = c.original_source ?? 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
  }
  const topSources = Array.from(sourceMap.entries()).sort(([, a], [, b]) => b - a).slice(0, 5)

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] gap-4">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Funnel</h1>
        <span className="text-[11px] text-slate-400">
          {selectedMonth || 'No data'} · {totalCounts.total.toLocaleString()} contacts
        </span>
        <div className="ml-auto">
          <MonthSelector months={months} selected={selectedMonth} />
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Viable Leads" value={totalCounts.viable.toLocaleString()} accent="blue" />
          <StatCard label="Connected" value={totalConnected.toLocaleString()} accent="teal" />
          <StatCard label="Appts Booked" value={totalApptBooked.toLocaleString()} accent="green" />
          <StatCard label="Enrolled" value={totalCounts.conversion.toLocaleString()} accent="amber" />
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Viable by Segment</div>
            <div className="space-y-2">
              <BreakdownRow label="B2C" count={segB2c} total={totalCounts.viable} color="bg-blue-500" />
              <BreakdownRow label="WFD" count={segWfd} total={totalCounts.viable} color="bg-violet-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Top Lead Sources</div>
            <div className="space-y-2">
              {topSources.map(([src, count]) => (
                <BreakdownRow key={src} label={src} count={count} total={totalCounts.viable} color="bg-cyan-500" />
              ))}
              {!topSources.length && <div className="text-[11px] text-slate-300">No data yet</div>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Qualified Breakdown</div>
            <div className="space-y-2">
              <BreakdownRow label="Viable (Q)" count={totalCounts.viable} total={totalCounts.total} color="bg-emerald-500" />
              <BreakdownRow label="Unqualified (UQ)" count={totalCounts.unqualified} total={totalCounts.total} color="bg-red-400" />
              <BreakdownRow label="Non Viable" count={totalCounts.nonViable} total={totalCounts.total} color="bg-slate-300" />
            </div>
          </div>
        </div>

        {/* Full funnel matrix */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200">
            <span className="font-display text-[13px] font-bold text-slate-900">Per-Advisor Funnel Matrix</span>
            <span className="ml-2 text-[11px] text-slate-400">{selectedMonth}</span>
          </div>
          {advisors.length > 0 ? (
            <FunnelMatrix advisors={advisors} total={totalRow} />
          ) : (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No advisor data for {selectedMonth || 'this month'}</div>
          )}
        </div>

        {/* By-Source tabs */}
        {sourceFunnels.length > 0 && (
          <BySourceTabs sourceFunnels={sourceFunnels} />
        )}
      </div>
    </div>
  )
}

function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-600 w-32 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-slate-500 w-8 text-right">{count}</span>
      <span className="font-mono text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  )
}
