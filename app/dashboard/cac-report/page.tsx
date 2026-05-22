import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { getMonthsForPeriod, getLast6Months, type Period } from '@/lib/metrics/periods'
import StatCard from '@/components/ui/StatCard'
import SbuCard from '@/components/ui/SbuCard'
import CacTrendChart from '@/components/charts/CacTrendChart'
import MonthlySpendChart from '@/components/charts/MonthlySpendChart'
import FilterBar from './FilterBar'
import SbuTable from './SbuTable'

interface PageProps {
  searchParams: { period?: string; university?: string; segment?: string }
}

const COURSES = ['Digital Marketing', 'UI/UX Design', 'Generative AI Data Analyst', 'General']

export default async function CacReportPage({ searchParams }: PageProps) {
  const period = (searchParams.period ?? 'mtd') as Period
  const university = searchParams.university ?? ''
  const segment = searchParams.segment ?? ''

  const supabase = createServiceClient()
  const months = period === '90d' ? [] : getMonthsForPeriod(period)

  // ── Query cac_metrics ──────────────────────────────────────────
  let query = supabase.from('cac_metrics').select('*')

  if (period === '90d') {
    // Use rolling_metrics for 90-day view
    const { data: rolling } = await supabase
      .from('rolling_metrics')
      .select('*')
      .order('as_of_date', { ascending: false })
      .limit(500)

    const rows = (rolling ?? []).filter((r) => {
      if (university && r.university !== university) return false
      if (segment && r.segment !== segment) return false
      return true
    })

    return <CacReportContent period={period} rows={[]} rollingRows={rows} university={university} segment={segment} />
  }

  query = query.in('month', months)
  if (university) query = query.eq('university', university)
  if (segment) query = query.eq('segment', segment)

  const { data: cacRows } = await query

  // ── Query ad_spend for monthly spend chart ─────────────────────
  const trendMonths = getLast6Months()
  const { data: spendRows } = await supabase
    .from('ad_spend')
    .select('date, platform, spend')
    .gte('date', `20${trendMonths[0].split('-')[1]}-${getMonthNum(trendMonths[0])}-01`)
    .order('date')

  return (
    <CacReportContent
      period={period}
      rows={cacRows ?? []}
      rollingRows={[]}
      university={university}
      segment={segment}
      spendRows={spendRows ?? []}
      trendMonths={trendMonths}
    />
  )
}

// ── Data aggregation ───────────────────────────────────────────────────────────

interface CacRow {
  month: string
  course: string | null
  university: string | null
  segment: string | null
  source: string | null
  leads: number
  enrollments: number
  cvr: number
  spend: number
  cpl: number
  cac: number
}

interface RollingRow {
  as_of_date: string
  course: string | null
  university: string | null
  segment: string | null
  leads_90d: number
  enrollments_90d: number
  spend_90d: number
  cvr_90d: number
  cpl_90d: number
  cac_90d: number
}

interface SpendRow {
  date: string
  platform: string
  spend: number
}

interface ContentProps {
  period: Period
  rows: CacRow[]
  rollingRows: RollingRow[]
  university: string
  segment: string
  spendRows?: SpendRow[]
  trendMonths?: string[]
}

function CacReportContent({ period, rows, rollingRows, spendRows = [], trendMonths = [] }: ContentProps) {
  // Choose correct row source
  const isRolling = period === '90d'
  const totalLeads = isRolling
    ? rollingRows.reduce((s, r) => s + r.leads_90d, 0)
    : rows.reduce((s, r) => s + r.leads, 0)
  const totalEnrollments = isRolling
    ? rollingRows.reduce((s, r) => s + r.enrollments_90d, 0)
    : rows.reduce((s, r) => s + r.enrollments, 0)
  const totalSpend = isRolling
    ? rollingRows.reduce((s, r) => s + Number(r.spend_90d), 0)
    : rows.reduce((s, r) => s + Number(r.spend), 0)
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
  const blendedCac = totalEnrollments > 0 ? totalSpend / totalEnrollments : 0

  // SBU aggregation
  const sbuMap = new Map<string, { leads: number; enrollments: number; spend: number; uniMap: Map<string, { leads: number; enrollments: number; spend: number }> }>()

  for (const course of COURSES) {
    sbuMap.set(course, { leads: 0, enrollments: 0, spend: 0, uniMap: new Map() })
  }

  const sourceRows = isRolling
    ? rollingRows.map((r) => ({ course: r.course, university: r.university, leads: r.leads_90d, enrollments: r.enrollments_90d, spend: Number(r.spend_90d) }))
    : rows.map((r) => ({ course: r.course, university: r.university, leads: r.leads, enrollments: r.enrollments, spend: Number(r.spend) }))

  for (const r of sourceRows) {
    const course = r.course ?? 'General'
    const sbu = sbuMap.get(course) ?? sbuMap.get('General')!
    sbu.leads += r.leads
    sbu.enrollments += r.enrollments
    sbu.spend += r.spend

    if (r.university) {
      const uniEntry = sbu.uniMap.get(r.university) ?? { leads: 0, enrollments: 0, spend: 0 }
      uniEntry.leads += r.leads
      uniEntry.enrollments += r.enrollments
      uniEntry.spend += r.spend
      sbu.uniMap.set(r.university, uniEntry)
    }
  }

  const sbuRows = COURSES.map((course) => {
    const sbu = sbuMap.get(course)!
    const cvr = sbu.leads > 0 ? sbu.enrollments / sbu.leads : 0
    const cpl = sbu.leads > 0 ? sbu.spend / sbu.leads : 0
    const cac = sbu.enrollments > 0 ? sbu.spend / sbu.enrollments : 0

    const byUniversity = Array.from(sbu.uniMap.entries()).map(([university, u]) => ({
      university,
      leads: u.leads,
      enrollments: u.enrollments,
      cvr: u.leads > 0 ? u.enrollments / u.leads : 0,
      spendGoogle: 0,
      spendMeta: 0,
      cplGoogle: 0,
      cplMeta: 0,
      cac: u.enrollments > 0 ? u.spend / u.enrollments : 0,
    }))

    return { course, leads: sbu.leads, enrollments: sbu.enrollments, cvr, spend: sbu.spend, cpl, cac, byUniversity }
  })

  // CAC trend data (last 6 months)
  const trendData = trendMonths.map((month) => {
    const point: Record<string, number | string> = { month }
    for (const course of COURSES) {
      const courseRows = rows.filter((r) => r.month === month && r.course === course)
      const enroll = courseRows.reduce((s, r) => s + r.enrollments, 0)
      const spend = courseRows.reduce((s, r) => s + Number(r.spend), 0)
      point[course] = enroll > 0 ? Math.round(spend / enroll) : 0
    }
    return point
  })

  // Monthly spend data
  const monthlySpend = trendMonths.map((month) => {
    const [mon, yr] = month.split('-')
    const prefix = `20${yr}-${getMonthNum2(mon)}`
    const google = spendRows.filter((r) => r.date.startsWith(prefix) && r.platform === 'google').reduce((s, r) => s + Number(r.spend), 0)
    const meta = spendRows.filter((r) => r.date.startsWith(prefix) && r.platform === 'meta').reduce((s, r) => s + Number(r.spend), 0)
    return { month, google, meta }
  })

  const periodLabel = { mtd: 'MTD', last_month: 'Last Mo.', '90d': '90-Day', ytd: 'YTD' }[period]

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-3 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">CAC Report</h1>
        <div className="flex-1" />
        <Suspense>
          <FilterBar />
        </Suspense>
      </header>

      {/* Content */}
      <div className="p-6 space-y-4">

        {/* Summary stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label={`Total Leads ${periodLabel}`} value={totalLeads.toLocaleString()} accent="blue" />
          <StatCard label={`Enrollments ${periodLabel}`} value={totalEnrollments.toLocaleString()} accent="green" />
          <StatCard label="Blended CPL" value={blendedCpl > 0 ? `$${Math.round(blendedCpl).toLocaleString()}` : '—'} accent="teal" />
          <StatCard label="Blended CAC" value={blendedCac > 0 ? `$${Math.round(blendedCac).toLocaleString()}` : '—'} accent="amber" />
        </div>

        {/* SBU overview cards */}
        <div className="grid grid-cols-4 gap-3">
          {sbuRows.map((row) => (
            <SbuCard
              key={row.course}
              course={row.course}
              leads={row.leads}
              enrollments={row.enrollments}
              cvr={row.cvr}
              cpl={row.cpl}
              cac={row.cac}
              ragStatus="none"
            />
          ))}
        </div>

        {/* Detail table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="font-display text-[13px] font-bold text-slate-900">SBU Breakdown</span>
            <span className="text-[11px] text-slate-400">Click a row to expand by university</span>
          </div>
          <SbuTable rows={sbuRows} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CacTrendChart data={trendData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlySpendChart data={monthlySpend} />
          </div>
        </div>

      </div>
    </div>
  )
}

function getMonthNum(label: string): string {
  const map: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
  return map[label.split('-')[0]] ?? '01'
}

function getMonthNum2(mon: string): string {
  const map: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
  return map[mon] ?? '01'
}
