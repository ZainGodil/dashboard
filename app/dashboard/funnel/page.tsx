import { createServiceClient } from '@/lib/supabase/server'
import FunnelMatrix from './FunnelMatrix'
import BySourceTabs from './BySourceTabs'
import StatCard from '@/components/ui/StatCard'

export interface AdvisorFunnel {
  advisor: string
  b2c: Record<string, number>
  wfd: Record<string, number>
}

export interface SourceRow {
  source: string
  totalLeads: number
  viable: number
  contacted: number
  apptBooked: number
  noShows: number
  apptAttended: number
  inProgress: number
  bookedDecision: number
  enrolled: number
}

export interface SourceFunnel {
  advisor: string
  rows: SourceRow[]
}

interface ContactRow {
  lead_status: string | null
  advisor: string | null
  segment: string | null
  original_source: string | null
  viable: boolean
  enrolled: boolean
  qualified: string | null
}

function initCounts(): Record<string, number> {
  return {
    total: 0, non_viable: 0, unqualified: 0, viable: 0,
    email_text: 0, connected: 0, bad_timing: 0, on_hold: 0,
    consult_booked: 0, no_show: 0, in_progress: 0,
    booked_decision: 0, open_deal: 0, enrolled: 0,
  }
}

function incrementCounts(counts: Record<string, number>, c: ContactRow) {
  counts.total++
  const ls = c.lead_status
  if (ls === 'Non Viable') counts.non_viable++
  if (ls === 'Unqualified') counts.unqualified++
  if (c.viable) counts.viable++
  if (ls === 'Email/Text') counts.email_text++
  if (ls === 'Connected') counts.connected++
  if (ls === 'Bad Timing') counts.bad_timing++
  if (ls === 'On Hold') counts.on_hold++
  if (ls === 'Career Consultation Booked') counts.consult_booked++
  if (ls === 'Interview No Show') counts.no_show++
  if (ls === 'In Progress') counts.in_progress++
  if (ls === 'Booked Decision Appointment') counts.booked_decision++
  if (ls === 'Open Deal') counts.open_deal++
  if (c.enrolled) counts.enrolled++
}

export default async function FunnelPage() {
  const supabase = createServiceClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('lead_status, advisor, segment, original_source, viable, enrolled, qualified')

  const all = (contacts ?? []) as ContactRow[]

  // ── Build per-advisor funnel counts ──────────────────────────────
  const advisorMap = new Map<string, { b2c: Record<string, number>; wfd: Record<string, number> }>()

  for (const c of all) {
    const advisor = c.advisor ?? 'Unassigned'
    if (!advisorMap.has(advisor)) {
      advisorMap.set(advisor, { b2c: initCounts(), wfd: initCounts() })
    }
    const ad = advisorMap.get(advisor)!
    const seg = c.segment === 'B2C' ? 'b2c' : 'wfd'
    incrementCounts(ad[seg], c)
  }

  const advisors: AdvisorFunnel[] = Array.from(advisorMap.entries())
    .filter(([a]) => a !== 'Unassigned')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([advisor, { b2c, wfd }]) => ({ advisor, b2c, wfd }))

  // ── Summary stat cards ────────────────────────────────────────────
  const totalViable = all.filter((c) => c.viable).length
  const totalConnected = all.filter((c) => c.lead_status === 'Connected').length
  const totalApptBooked = all.filter((c) => c.lead_status === 'Career Consultation Booked').length
  const totalEnrolled = all.filter((c) => c.enrolled).length

  // ── Breakdown cards ───────────────────────────────────────────────
  const segB2c = all.filter((c) => c.viable && c.segment === 'B2C').length
  const segWfd = all.filter((c) => c.viable && c.segment === 'WFD').length

  const sourceMap = new Map<string, number>()
  for (const c of all.filter((c) => c.viable)) {
    const src = c.original_source ?? 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
  }
  const topSources = Array.from(sourceMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const qualQ = all.filter((c) => c.qualified === 'Q').length
  const qualUQ = all.filter((c) => c.qualified === 'UQ').length
  const qualNA = all.filter((c) => c.qualified === 'NA' || (!c.qualified && c.viable)).length

  // ── Source funnel per advisor ─────────────────────────────────────
  const sourceFunnels: SourceFunnel[] = advisors.map(({ advisor }) => {
    const ac = all.filter((c) => (c.advisor ?? 'Unassigned') === advisor)

    const srcMap = new Map<string, ContactRow[]>()
    for (const c of ac) {
      const src = c.original_source ?? 'Unknown'
      const arr = srcMap.get(src) ?? []
      arr.push(c)
      srcMap.set(src, arr)
    }

    const rows: SourceRow[] = Array.from(srcMap.entries())
      .map(([source, cs]) => {
        const booked = cs.filter((c) => c.lead_status === 'Career Consultation Booked').length
        const noShows = cs.filter((c) => c.lead_status === 'Interview No Show').length
        return {
          source,
          totalLeads: cs.length,
          viable: cs.filter((c) => c.viable).length,
          contacted: cs.filter((c) => ['Email/Text','Connected','Bad Timing','On Hold'].includes(c.lead_status ?? '')).length,
          apptBooked: booked,
          noShows,
          apptAttended: Math.max(0, booked - noShows),
          inProgress: cs.filter((c) => c.lead_status === 'In Progress').length,
          bookedDecision: cs.filter((c) => c.lead_status === 'Booked Decision Appointment').length,
          enrolled: cs.filter((c) => c.enrolled).length,
        }
      })
      .sort((a, b) => b.totalLeads - a.totalLeads)

    return { advisor, rows }
  })

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Funnel</h1>
        <span className="ml-3 text-[11px] text-slate-400">All-time · {all.length.toLocaleString()} contacts</span>
      </header>

      <div className="p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Viable Leads" value={totalViable.toLocaleString()} accent="blue" />
          <StatCard label="Connected" value={totalConnected.toLocaleString()} accent="teal" />
          <StatCard label="Appts Booked" value={totalApptBooked.toLocaleString()} accent="green" />
          <StatCard label="Enrolled" value={totalEnrolled.toLocaleString()} accent="amber" />
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Segment split */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Viable by Segment</div>
            <div className="space-y-2">
              <BreakdownRow label="B2C" count={segB2c} total={totalViable} color="bg-blue-500" />
              <BreakdownRow label="WFD" count={segWfd} total={totalViable} color="bg-violet-500" />
            </div>
          </div>

          {/* Top sources */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Top Lead Sources</div>
            <div className="space-y-2">
              {topSources.map(([src, count]) => (
                <BreakdownRow key={src} label={src} count={count} total={totalViable} color="bg-cyan-500" />
              ))}
              {!topSources.length && <div className="text-[11px] text-slate-300">No data yet</div>}
            </div>
          </div>

          {/* Qualified */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-3">Qualified Breakdown</div>
            <div className="space-y-2">
              <BreakdownRow label="Qualified (Q)" count={qualQ} total={totalViable} color="bg-emerald-500" />
              <BreakdownRow label="Unqualified (UQ)" count={qualUQ} total={totalViable} color="bg-red-400" />
              <BreakdownRow label="Not Assessed (NA)" count={qualNA} total={totalViable} color="bg-slate-300" />
            </div>
          </div>
        </div>

        {/* Full funnel matrix */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200">
            <span className="font-display text-[13px] font-bold text-slate-900">Per-Advisor Funnel Matrix</span>
            <span className="ml-2 text-[11px] text-slate-400">B2C · WFD · % of viable</span>
          </div>
          {advisors.length > 0 ? (
            <FunnelMatrix advisors={advisors} />
          ) : (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No advisor data — run HubSpot sync first</div>
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
