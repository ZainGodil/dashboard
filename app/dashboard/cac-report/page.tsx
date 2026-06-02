import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { getMonthsForPeriod, getLast6Months, getLast12Months, type Period } from '@/lib/metrics/periods'
import StatCard from '@/components/ui/StatCard'
import SbuCard from '@/components/ui/SbuCard'
import CacTrendChart from '@/components/charts/CacTrendChart'
import MonthlySpendChart from '@/components/charts/MonthlySpendChart'
import L2ETrendChart from '@/components/charts/L2ETrendChart'
import YoYSpendChart from '@/components/charts/YoYSpendChart'
import WeeklySpendChart from '@/components/charts/WeeklySpendChart'
import DailySpendChart from '@/components/charts/DailySpendChart'
import FilterBar from './FilterBar'
import SbuTable from './SbuTable'

interface PageProps {
  searchParams: { period?: string; university?: string; segment?: string }
}

const COURSES = ['Digital Marketing', 'UI/UX Design', 'Generative AI Data Analyst', 'General']
const MONTH_MAP: Record<string, string> = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
}

function monthLabelToStart(label: string): string {
  const [mon, yr] = label.split('-')
  return `20${yr}-${MONTH_MAP[mon]}-01`
}

function monthLabelToEnd(label: string): string {
  const [mon, yr] = label.split('-')
  const year = 2000 + Number(yr)
  const month = Number(MONTH_MAP[mon])
  const days = new Date(year, month, 0).getDate()
  return `20${yr}-${MONTH_MAP[mon]}-${String(days).padStart(2, '0')}`
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default async function CacReportPage({ searchParams }: PageProps) {
  const period = (searchParams.period ?? 'mtd') as Period
  const university = searchParams.university ?? ''
  const segment = searchParams.segment ?? ''
  const supabase = createServiceClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const trendMonths = getLast6Months()
  const last12 = getLast12Months()

  // ── Period-specific data ──────────────────────────────────────────
  let cacRows: CacRow[] = []
  let rollingRows: RollingRow[] = []
  let periodSpendRows: PeriodSpendRow[] = []

  if (period === '90d') {
    const { data } = await supabase
      .from('rolling_metrics').select('*')
      .order('as_of_date', { ascending: false }).limit(500)
    rollingRows = (data ?? []).filter((r) => {
      if (university && r.university !== university) return false
      if (segment && r.segment !== segment) return false
      return true
    })
  } else {
    const months = getMonthsForPeriod(period)
    let q = supabase.from('cac_metrics').select('*').in('month', months)
    if (university) q = q.eq('university', university)
    if (segment) q = q.eq('segment', segment)
    const { data } = await q
    cacRows = data ?? []

    if (months.length) {
      const { data: ps } = await supabase
        .from('ad_spend')
        .select('course, university, platform, spend')
        .gte('date', monthLabelToStart(months[0]))
        .lte('date', monthLabelToEnd(months[months.length - 1]))
      periodSpendRows = ps ?? []
    }
  }

  // ── Always-fetched data (parallel) ───────────────────────────────
  const eightWeeksAgo = new Date(today)
  eightWeeksAgo.setDate(today.getDate() - 56)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: trendSpendRaw },
    { data: l2eContactsRaw },
    { data: yoySpendRaw },
    { data: weeklySpendRaw },
    { data: dailySpendRaw },
  ] = await Promise.all([
    supabase.from('ad_spend').select('date, platform, spend')
      .gte('date', monthLabelToStart(trendMonths[0])).lte('date', todayStr).order('date'),
    supabase.from('contacts').select('month, original_source, viable, enrolled')
      .in('month', last12),
    supabase.from('ad_spend').select('date, spend')
      .gte('date', '2024-01-01').lte('date', todayStr),
    supabase.from('ad_spend').select('date, platform, spend')
      .gte('date', eightWeeksAgo.toISOString().split('T')[0]).lte('date', todayStr),
    supabase.from('ad_spend').select('date, platform, spend')
      .gte('date', monthStart).lte('date', todayStr),
  ])

  // ── Aggregate chart data ─────────────────────────────────────────

  // L2E% trend (12 months, Paid Search vs Paid Social)
  const l2eData: L2EPoint[] = last12.map((month) => {
    const mc = (l2eContactsRaw ?? []).filter((c) => c.month === month)
    const l2e = (src: string) => {
      const rows = mc.filter((c) => c.original_source === src)
      const leads = rows.filter((c) => c.viable).length
      const enrolled = rows.filter((c) => c.enrolled).length
      return leads > 0 ? Math.round((enrolled / leads) * 1000) / 10 : 0
    }
    return { month, 'Paid Search': l2e('Paid Search'), 'Paid Social': l2e('Paid Social') }
  })

  // YoY spend (2024-2025-2026, Jan to current month)
  const currentMonth = today.getMonth() + 1
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const yoyData: YoYPoint[] = SHORT_MONTHS.slice(0, currentMonth).map((mon, idx) => {
    const padded = String(idx + 1).padStart(2, '0')
    const total = (yr: number) =>
      (yoySpendRaw ?? []).filter((r) => r.date.startsWith(`${yr}-${padded}`)).reduce((s, r) => s + Number(r.spend), 0)
    return { month: mon, '2024': total(2024), '2025': total(2025), '2026': total(2026) }
  })

  // Weekly spend (last 8 weeks)
  const weekMap = new Map<string, { google: number; meta: number }>()
  for (const row of weeklySpendRaw ?? []) {
    const key = getWeekStart(row.date)
    const cur = weekMap.get(key) ?? { google: 0, meta: 0 }
    if (row.platform === 'google') cur.google += Number(row.spend)
    else if (row.platform === 'meta') cur.meta += Number(row.spend)
    weekMap.set(key, cur)
  }
  const weeklyData: WeekPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, { google, meta }]) => ({ week: week.slice(5), google, meta }))

  // Daily spend (current month)
  const dayMap = new Map<string, { google: number; meta: number }>()
  for (const row of dailySpendRaw ?? []) {
    const cur = dayMap.get(row.date) ?? { google: 0, meta: 0 }
    if (row.platform === 'google') cur.google += Number(row.spend)
    else if (row.platform === 'meta') cur.meta += Number(row.spend)
    dayMap.set(row.date, cur)
  }
  const dailyData: DayPoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { google, meta }]) => ({ date: date.slice(5), google, meta }))

  const currentMonthLabel = today.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <CacReportContent
      period={period}
      cacRows={cacRows}
      rollingRows={rollingRows}
      periodSpendRows={periodSpendRows}
      trendMonths={trendMonths}
      trendSpendRows={trendSpendRaw ?? []}
      l2eData={l2eData}
      yoyData={yoyData}
      weeklyData={weeklyData}
      dailyData={dailyData}
      currentMonthLabel={currentMonthLabel}
    />
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CacRow {
  month: string; course: string | null; university: string | null
  segment: string | null; source: string | null
  leads: number; enrollments: number; cvr: number; spend: number; cpl: number; cac: number
}
interface RollingRow {
  as_of_date: string; course: string | null; university: string | null; segment: string | null
  leads_90d: number; enrollments_90d: number; spend_90d: number
  cvr_90d: number; cpl_90d: number; cac_90d: number
}
interface PeriodSpendRow { course: string | null; university: string | null; platform: string; spend: number }
interface TrendSpendRow { date: string; platform: string; spend: number }
interface L2EPoint { month: string; 'Paid Search': number; 'Paid Social': number }
interface YoYPoint { month: string; '2024': number; '2025': number; '2026': number }
interface WeekPoint { week: string; google: number; meta: number }
interface DayPoint { date: string; google: number; meta: number }

interface ContentProps {
  period: Period
  cacRows: CacRow[]
  rollingRows: RollingRow[]
  periodSpendRows: PeriodSpendRow[]
  trendMonths: string[]
  trendSpendRows: TrendSpendRow[]
  l2eData: L2EPoint[]
  yoyData: YoYPoint[]
  weeklyData: WeekPoint[]
  dailyData: DayPoint[]
  currentMonthLabel: string
}

// ── Content component ────────────────────────────────────────────────────────

function CacReportContent({
  period, cacRows, rollingRows, periodSpendRows,
  trendMonths, trendSpendRows, l2eData, yoyData, weeklyData, dailyData, currentMonthLabel,
}: ContentProps) {
  const isRolling = period === '90d'

  const totalLeads = isRolling
    ? rollingRows.reduce((s, r) => s + r.leads_90d, 0)
    : cacRows.reduce((s, r) => s + r.leads, 0)
  const totalEnrollments = isRolling
    ? rollingRows.reduce((s, r) => s + r.enrollments_90d, 0)
    : cacRows.reduce((s, r) => s + r.enrollments, 0)
  const totalSpend = isRolling
    ? rollingRows.reduce((s, r) => s + Number(r.spend_90d), 0)
    : cacRows.reduce((s, r) => s + Number(r.spend), 0)
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
  const blendedCac = totalEnrollments > 0 ? totalSpend / totalEnrollments : 0

  // Per-platform spend map keyed by "course|university|platform"
  const platMap = new Map<string, number>()
  for (const r of periodSpendRows) {
    const key = `${r.course ?? ''}|${r.university ?? ''}|${r.platform}`
    platMap.set(key, (platMap.get(key) ?? 0) + Number(r.spend))
  }

  // SBU aggregation
  type SbuEntry = { leads: number; enrollments: number; spend: number; uniMap: Map<string, { leads: number; enrollments: number; spend: number }> }
  const sbuMap = new Map<string, SbuEntry>()
  for (const course of COURSES) sbuMap.set(course, { leads: 0, enrollments: 0, spend: 0, uniMap: new Map() })

  const sourceRows = isRolling
    ? rollingRows.map((r) => ({ course: r.course, university: r.university, leads: r.leads_90d, enrollments: r.enrollments_90d, spend: Number(r.spend_90d) }))
    : cacRows.map((r) => ({ course: r.course, university: r.university, leads: r.leads, enrollments: r.enrollments, spend: Number(r.spend) }))

  for (const r of sourceRows) {
    const course = r.course ?? 'General'
    const sbu = sbuMap.get(course) ?? sbuMap.get('General')!
    sbu.leads += r.leads; sbu.enrollments += r.enrollments; sbu.spend += r.spend
    if (r.university) {
      const u = sbu.uniMap.get(r.university) ?? { leads: 0, enrollments: 0, spend: 0 }
      u.leads += r.leads; u.enrollments += r.enrollments; u.spend += r.spend
      sbu.uniMap.set(r.university, u)
    }
  }

  const sbuRows = COURSES.map((course) => {
    const sbu = sbuMap.get(course)!
    const cvr = sbu.leads > 0 ? sbu.enrollments / sbu.leads : 0
    const cpl = sbu.leads > 0 ? sbu.spend / sbu.leads : 0
    const cac = sbu.enrollments > 0 ? sbu.spend / sbu.enrollments : 0

    const byUniversity = Array.from(sbu.uniMap.entries()).map(([uni, u]) => {
      const spendGoogle = platMap.get(`${course}|${uni}|google`) ?? 0
      const spendMeta = platMap.get(`${course}|${uni}|meta`) ?? 0
      return {
        university: uni,
        leads: u.leads,
        enrollments: u.enrollments,
        cvr: u.leads > 0 ? u.enrollments / u.leads : 0,
        spendGoogle,
        spendMeta,
        cplGoogle: u.leads > 0 ? spendGoogle / u.leads : 0,
        cplMeta: u.leads > 0 ? spendMeta / u.leads : 0,
        cac: u.enrollments > 0 ? u.spend / u.enrollments : 0,
      }
    })

    return { course, leads: sbu.leads, enrollments: sbu.enrollments, cvr, spend: sbu.spend, cpl, cac, byUniversity }
  })

  // CAC trend data (6 months per SBU)
  const trendData = trendMonths.map((month) => {
    const point: Record<string, number | string> = { month }
    for (const course of COURSES) {
      const rows = cacRows.filter((r) => r.month === month && r.course === course)
      const enroll = rows.reduce((s, r) => s + r.enrollments, 0)
      const spend = rows.reduce((s, r) => s + Number(r.spend), 0)
      point[course] = enroll > 0 ? Math.round(spend / enroll) : 0
    }
    return point
  })

  // Monthly spend data (6 months)
  const monthlySpend = trendMonths.map((month) => {
    const [mon, yr] = month.split('-')
    const prefix = `20${yr}-${MONTH_MAP[mon]}`
    const filter = (plat: string) =>
      trendSpendRows.filter((r) => r.date.startsWith(prefix) && r.platform === plat).reduce((s, r) => s + Number(r.spend), 0)
    return { month, google: filter('google'), meta: filter('meta') }
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

        {/* Charts row 1: CAC Trend + Monthly Spend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CacTrendChart data={trendData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlySpendChart data={monthlySpend} />
          </div>
        </div>

        {/* Charts row 2: L2E% Trend + YoY Spend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <L2ETrendChart data={l2eData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <YoYSpendChart data={yoyData} />
          </div>
        </div>

        {/* Charts row 3: Weekly Paid Media + Daily Spend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <WeeklySpendChart data={weeklyData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <DailySpendChart data={dailyData} monthLabel={currentMonthLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}
