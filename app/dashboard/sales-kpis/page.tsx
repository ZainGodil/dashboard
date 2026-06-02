import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGoals } from '@/lib/hubspot/goals'
import type { GoalRecord } from '@/lib/hubspot/goals'
import type { Period } from '@/lib/metrics/periods'
import SalesFilterBar from './SalesFilterBar'
import BookingsChart from './BookingsChart'
import BookingsTrendChart from './BookingsTrendChart'
import CsvButton from '@/components/ui/CsvButton'

// ─── types ────────────────────────────────────────────────────────────────────

interface AdvisorRow {
  advisor: string
  b2heBookings: number
  b2gBookings: number
  totalBookings: number
  b2hePipeline: number
  b2gPipeline: number
  totalPipeline: number
}

interface MonthPoint {
  month: string
  b2he: number
  b2g: number
}

type ContactRow = { advisor: string | null; sales_segment: string | null }
type MonthRow   = { month: string | null; sales_segment: string | null }

// ─── helpers ──────────────────────────────────────────────────────────────────

const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const toLabel = (d: Date) => `${ML[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`

function getPeriodMonths(period: Period): string[] | null {
  const now = new Date()
  if (period === 'mtd') return [toLabel(now)]
  if (period === 'last_month') {
    return [toLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1))]
  }
  if (period === 'ytd') {
    const months: string[] = []
    for (let m = 0; m <= now.getMonth(); m++) {
      months.push(toLabel(new Date(now.getFullYear(), m, 1)))
    }
    return months
  }
  return null
}

function getYtdMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let m = 0; m <= now.getMonth(); m++) {
    months.push(toLabel(new Date(now.getFullYear(), m, 1)))
  }
  return months
}

function get90dStart(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().split('T')[0]
}

function matchGoalTarget(goals: GoalRecord[], ...keywords: string[]): number {
  return goals
    .filter((g) => keywords.some((k) => g.name.toLowerCase().includes(k.toLowerCase())))
    .reduce((s, g) => s + g.target, 0)
}

const PIPELINE_STATUSES = ['Booked Decision Appointment', 'Open Deal']

const PERIOD_LABELS: Record<Period, string> = {
  mtd: 'MTD',
  last_month: 'Last Mo.',
  '90d': '90-Day',
  ytd: 'YTD',
}

// ─── sub-components (server-safe, no hooks) ───────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent = 'slate',
}: {
  label: string
  value: number
  sub: string
  accent?: 'slate' | 'blue' | 'purple' | 'amber'
}) {
  const colors = {
    slate:  'text-slate-900',
    blue:   'text-blue-600',
    purple: 'text-purple-600',
    amber:  'text-amber-600',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1">{label}</div>
      <div className={`text-[28px] font-bold leading-none font-display tabular-nums ${colors[accent]}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">{sub}</div>
    </div>
  )
}

function GoalBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
  const color = pct >= 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626'
  return (
    <div className="flex items-center gap-3 min-w-[160px]">
      <div className="text-[11px] font-medium text-slate-500 w-8">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-[11px] font-mono text-slate-600 whitespace-nowrap">
        {actual} / {target}
        <span className="ml-1 font-semibold" style={{ color }}>{pct}%</span>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function SalesKpisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const period = (sp.period ?? 'mtd') as Period
  const is90d = period === '90d'
  const months = getPeriodMonths(period)
  const ytdMonths = getYtdMonths()
  const supabase = createServiceClient()

  const [bookingsRes, pipelineRes, ytdRes, goals] = await Promise.all([
    is90d
      ? supabase
          .from('contacts')
          .select('advisor, sales_segment')
          .eq('enrolled', true)
          .gte('create_date', get90dStart())
      : supabase
          .from('contacts')
          .select('advisor, sales_segment')
          .eq('enrolled', true)
          .in('month', months ?? []),

    supabase
      .from('contacts')
      .select('advisor, sales_segment')
      .in('lead_status', PIPELINE_STATUSES),

    supabase
      .from('contacts')
      .select('month, sales_segment')
      .eq('enrolled', true)
      .in('month', ytdMonths),

    fetchGoals().catch((): GoalRecord[] => []),
  ])

  // ── advisor map ─────────────────────────────────────────────────────────────
  const advisorMap = new Map<string, {
    b2heBookings: number; b2gBookings: number
    b2hePipeline: number; b2gPipeline: number
  }>()

  function ensure(name: string) {
    if (!advisorMap.has(name)) {
      advisorMap.set(name, { b2heBookings: 0, b2gBookings: 0, b2hePipeline: 0, b2gPipeline: 0 })
    }
    return advisorMap.get(name)!
  }

  for (const r of (bookingsRes.data ?? []) as ContactRow[]) {
    if (!r.advisor) continue
    const a = ensure(r.advisor)
    if (r.sales_segment === 'B2HE') a.b2heBookings++
    else a.b2gBookings++
  }

  for (const r of (pipelineRes.data ?? []) as ContactRow[]) {
    if (!r.advisor) continue
    const a = ensure(r.advisor)
    if (r.sales_segment === 'B2HE') a.b2hePipeline++
    else a.b2gPipeline++
  }

  const advisorRows: AdvisorRow[] = Array.from(advisorMap.entries())
    .map(([advisor, v]) => ({
      advisor,
      b2heBookings:  v.b2heBookings,
      b2gBookings:   v.b2gBookings,
      totalBookings: v.b2heBookings + v.b2gBookings,
      b2hePipeline:  v.b2hePipeline,
      b2gPipeline:   v.b2gPipeline,
      totalPipeline: v.b2hePipeline + v.b2gPipeline,
    }))
    .sort((a, b) => b.totalBookings - a.totalBookings)

  // ── YTD monthly trend ───────────────────────────────────────────────────────
  const monthMap = new Map<string, { b2he: number; b2g: number }>()
  for (const m of ytdMonths) monthMap.set(m, { b2he: 0, b2g: 0 })

  for (const r of (ytdRes.data ?? []) as MonthRow[]) {
    if (!r.month || !monthMap.has(r.month)) continue
    const entry = monthMap.get(r.month)!
    if (r.sales_segment === 'B2HE') entry.b2he++
    else entry.b2g++
  }

  const trendData: MonthPoint[] = ytdMonths.map((m) => ({ month: m, ...monthMap.get(m)! }))

  // ── summary ─────────────────────────────────────────────────────────────────
  const totalBookings  = advisorRows.reduce((s, r) => s + r.totalBookings, 0)
  const totalB2HE      = advisorRows.reduce((s, r) => s + r.b2heBookings, 0)
  const totalB2G       = advisorRows.reduce((s, r) => s + r.b2gBookings, 0)
  const totalPipeline  = advisorRows.reduce((s, r) => s + r.totalPipeline, 0)

  const b2heTarget  = matchGoalTarget(goals, 'B2HE', 'b2he')
  const b2gTarget   = matchGoalTarget(goals, 'B2G', 'b2g', 'WFD')
  const totalTarget = b2heTarget + b2gTarget
  const hasGoals    = totalTarget > 0

  const chartData = advisorRows.map((r) => ({
    advisor: r.advisor.split(' ')[0],
    b2he: r.b2heBookings,
    b2g: r.b2gBookings,
  }))

  const periodLabel = PERIOD_LABELS[period]

  const csvRows = advisorRows.map((r) => [
    r.advisor, r.b2heBookings, r.b2gBookings, r.totalBookings, r.totalPipeline,
  ] as (string | number)[])
  const csvFilename = `sales-kpis-${periodLabel.toLowerCase().replace(/\s/g, '-')}.csv`

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[18px] font-bold text-slate-900">Sales KPIs</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Bookings and pipeline by advisor</p>
        </div>
        <Suspense fallback={null}>
          <SalesFilterBar />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Bookings" value={totalBookings} sub={periodLabel} />
        <KpiCard label="B2HE"           value={totalB2HE}     sub={`${periodLabel} enrollments`} accent="blue" />
        <KpiCard label="B2G"            value={totalB2G}      sub={`${periodLabel} enrollments`} accent="purple" />
        <KpiCard label="Pipeline"       value={totalPipeline} sub="Decision stage" accent={totalPipeline > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Goals strip */}
      {hasGoals && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-3">
            vs Target — {periodLabel}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {b2heTarget > 0 && <GoalBar label="B2HE" actual={totalB2HE} target={b2heTarget} />}
            {b2gTarget  > 0 && <GoalBar label="B2G"  actual={totalB2G}  target={b2gTarget}  />}
            {hasGoals         && <GoalBar label="All"  actual={totalBookings} target={totalTarget} />}
          </div>
        </div>
      )}

      {/* Advisor table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display text-[13px] font-bold text-slate-900">
            By Advisor — {periodLabel}
          </span>
          {advisorRows.length > 0 && (
            <CsvButton
              filename={csvFilename}
              headers={['Advisor', 'B2HE', 'B2G', 'Total', 'Pipeline']}
              rows={csvRows}
            />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold min-w-[160px]">
                  Advisor
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-blue-400 font-semibold">
                  B2HE
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-purple-400 font-semibold">
                  B2G
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">
                  Total
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-amber-400 font-semibold">
                  Pipeline
                </th>
              </tr>
            </thead>
            <tbody>
              {advisorRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No bookings data for this period — run HubSpot sync first
                  </td>
                </tr>
              ) : (
                advisorRows.map((row) => (
                  <tr key={row.advisor} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{row.advisor}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {row.b2heBookings > 0
                        ? <span className="text-blue-600 font-semibold">{row.b2heBookings}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {row.b2gBookings > 0
                        ? <span className="text-purple-600 font-semibold">{row.b2gBookings}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                      {row.totalBookings > 0 ? row.totalBookings : <span className="text-slate-200 font-normal">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {row.totalPipeline > 0
                        ? <span className="text-amber-600 font-semibold">{row.totalPipeline}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {advisorRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-2.5 text-[11px] font-bold text-slate-900">Total</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600">
                    {totalB2HE > 0 ? totalB2HE : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-600">
                    {totalB2G > 0 ? totalB2G : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                    {totalBookings > 0 ? totalBookings : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">
                    {totalPipeline > 0 ? totalPipeline : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
            Bookings by Advisor
          </div>
          <div className="text-[11px] text-slate-400 mb-3">{periodLabel} — B2HE + B2G</div>
          <BookingsChart data={chartData} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <BookingsTrendChart data={trendData} />
        </div>
      </div>
    </div>
  )
}
