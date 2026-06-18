import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { getMonthsForPeriod, getLast6Months, getLast12Months, type Period } from '@/lib/metrics/periods'
import StatCard from '@/components/ui/StatCard'
import GaugeCard from '@/components/charts/GaugeCard'
import SbuCard from '@/components/ui/SbuCard'
import CacTrendChart from '@/components/charts/CacTrendChart'
import MonthlySpendChart from '@/components/charts/MonthlySpendChart'
import L2ETrendChart from '@/components/charts/L2ETrendChart'
import YoYSpendChart from '@/components/charts/YoYSpendChart'
import WeeklySpendChart from '@/components/charts/WeeklySpendChart'
import DailySpendChart from '@/components/charts/DailySpendChart'
import SalesCycleChart from '@/components/charts/SalesCycleChart'
import MonthlyCacBarChart from '@/components/charts/MonthlyCacBarChart'
import FilterBar from './FilterBar'
import SbuTable from './SbuTable'

interface PageProps {
  searchParams: { period?: string; university?: string; segment?: string; m?: string }
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
  const customMonth = searchParams.m ?? null        // e.g. "Apr-26" from ‹ › navigator
  const supabase = createAdminClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const trendMonths = getLast6Months()
  const last12 = getLast12Months()

  // When a specific month is chosen via ‹ ›, override the period months
  const is90d = period === '90d' && !customMonth
  const activeMonths = customMonth ? [customMonth] : getMonthsForPeriod(period)

  // ── Period-specific data ──────────────────────────────────────────
  let cacRows: CacRow[] = []
  let rollingRows: RollingRow[] = []
  let periodSpendRows: PeriodSpendRow[] = []

  if (is90d) {
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const rollingStart = ninetyDaysAgo.toISOString().split('T')[0]

    const [{ data: rollingData }, { data: rolling90dSpend }] = await Promise.all([
      supabase.from('rolling_metrics').select('*').order('as_of_date', { ascending: false }).limit(500),
      (() => {
        let q = supabase.from('ad_spend').select('course, university, platform, spend')
          .gte('date', rollingStart).lte('date', todayStr)
        if (university) q = q.eq('university', university)
        return q
      })(),
    ])
    rollingRows = (rollingData ?? []).filter((r) => {
      if (university && r.university !== university) return false
      if (segment && r.segment !== segment) return false
      return true
    })
    periodSpendRows = rolling90dSpend ?? []
  } else {
    const months = activeMonths
    let q = supabase.from('cac_metrics').select('*').in('month', months)
    if (university) q = q.eq('university', university)
    if (segment) q = q.eq('segment', segment)
    const { data } = await q
    cacRows = data ?? []

    if (months.length) {
      let psQ = supabase
        .from('ad_spend')
        .select('course, university, platform, spend')
        .gte('date', monthLabelToStart(months[0]))
        .lte('date', monthLabelToEnd(months[months.length - 1]))
      if (university) psQ = psQ.eq('university', university)
      const { data: ps } = await psQ
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
    { data: enrollmentDatesRaw },
    { data: monthlyCacRaw },
    { data: periodEnrollmentsRaw },
    { data: trendCacRaw },
  ] = await Promise.all([
    supabase.from('ad_spend').select('date, platform, course, spend')
      .gte('date', monthLabelToStart(trendMonths[0])).lte('date', todayStr).order('date').limit(10000),
    supabase.from('contacts').select('month, original_source, viable, enrolled')
      .in('month', last12).in('original_source', ['Paid Search', 'Paid Social']).limit(10000),
    supabase.from('ad_spend').select('date, spend')
      .gte('date', '2024-01-01').lte('date', todayStr).limit(10000),
    supabase.from('ad_spend').select('date, platform, spend')
      .gte('date', eightWeeksAgo.toISOString().split('T')[0]).lte('date', todayStr),
    supabase.from('ad_spend').select('date, platform, spend')
      .gte('date', monthStart).lte('date', todayStr),
    supabase.from('enrollments').select('hubspot_contact_id, enrolled_at, month')
      .in('month', last12).not('enrolled_at', 'is', null),
    supabase.from('cac_metrics').select('month, segment, course, university, enrollments, spend')
      .in('month', last12),
    // Enrollments for the active period — used for names table, gauge count, and booking revenue
    is90d
      ? supabase.from('enrollments').select('hubspot_contact_id, course, university, segment, month, deal_amount')
          .gte('enrolled_at', new Date(today.getTime() - 90 * 86400000).toISOString().split('T')[0])
          .lte('enrolled_at', todayStr)
      : supabase.from('enrollments').select('hubspot_contact_id, course, university, segment, month, deal_amount')
          .in('month', activeMonths),
    supabase.from('cac_metrics').select('month, course, enrollments')
      .in('month', trendMonths),
  ] as const)

  // ── Booking revenue: sum deal_amount for active-period enrollments ───
  const bookingRevenueMtd = (periodEnrollmentsRaw ?? [])
    .reduce((sum, e) => sum + ((e as { deal_amount?: number | null }).deal_amount ?? 0), 0)

  // ── Sales cycle: avg days lead→enrollment per month ─────────────────
  const enrolledIds = (enrollmentDatesRaw ?? []).map((e) => e.hubspot_contact_id).filter(Boolean)
  let salesCycleData: { month: string; days: number }[] = last12.map((m) => ({ month: m, days: 0 }))

  if (enrolledIds.length > 0) {
    const { data: contactDates } = await supabase
      .from('contacts')
      .select('hubspot_id, create_date')
      .in('hubspot_id', enrolledIds)

    const contactMap = new Map((contactDates ?? []).map((c) => [c.hubspot_id, c.create_date]))

    salesCycleData = last12.map((month) => {
      const monthEnrollments = (enrollmentDatesRaw ?? []).filter((e) => e.month === month)
      const validDays = monthEnrollments
        .map((e) => {
          const createDate = contactMap.get(e.hubspot_contact_id)
          if (!createDate || !e.enrolled_at) return null
          const diff = (new Date(e.enrolled_at).getTime() - new Date(createDate).getTime()) / 86_400_000
          return diff
        })
        .filter((d): d is number => d !== null && d >= 0 && d < 365)
      const avg = validDays.length > 0 ? validDays.reduce((a, b) => a + b, 0) / validDays.length : 0
      return { month, days: Math.round(avg) }
    })
  }

  // ── Monthly CAC by segment ───────────────────────────────────────────
  // Dedup spend at (course, university) — cac_metrics copies the same spend to every source row
  const monthlyCacData = last12.map((month) => {
    const rows = (monthlyCacRaw ?? []).filter((r) => r.month === month)
    const segData = (seg: string) => {
      const sr = rows.filter((r) => r.segment === seg)
      const seen = new Set<string>()
      let spend = 0
      for (const r of sr) {
        const key = `${r.course ?? ''}|${r.university ?? ''}`
        if (!seen.has(key)) { seen.add(key); spend += Number(r.spend) }
      }
      const enroll = sr.reduce((s, r) => s + r.enrollments, 0)
      return { cac: enroll > 0 ? Math.round(spend / enroll) : 0, enroll }
    }
    const b2c = segData('B2C')
    const wfd = segData('WFD')
    return { month, B2C: b2c.cac, WFD: wfd.cac, B2C_enroll: b2c.enroll, WFD_enroll: wfd.enroll }
  })

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

  // Fetch contact names for enrolled contacts in the active period
  const periodEnrollmentsList = periodEnrollmentsRaw ?? []
  const enrolledHsIds = periodEnrollmentsList.map((e) => e.hubspot_contact_id).filter(Boolean) as string[]
  const { data: enrolledContactsRaw } = enrolledHsIds.length > 0
    ? await supabase.from('contacts')
        .select('first_name, last_name, hubspot_id, course, university, advisor, segment')
        .in('hubspot_id', enrolledHsIds)
    : { data: [] }

  const enrolledContactMap = new Map((enrolledContactsRaw ?? []).map((c) => [c.hubspot_id, c]))
  const enrolledNames = periodEnrollmentsList.map((e) => {
    const contact = enrolledContactMap.get(e.hubspot_contact_id ?? '')
    return {
      first_name: contact?.first_name ?? null,
      last_name: contact?.last_name ?? null,
      course: contact?.course ?? e.course ?? null,
      university: contact?.university ?? e.university ?? null,
      advisor: contact?.advisor ?? null,
      segment: contact?.segment ?? e.segment ?? null,
    }
  })

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
      salesCycleData={salesCycleData}
      monthlyCacData={monthlyCacData}
      bookingRevenueMtd={bookingRevenueMtd}
      customMonth={customMonth}
      enrolledNames={enrolledNames}
      trendCacRows={trendCacRaw ?? []}
    />
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CacRow {
  month: string; course: string | null; university: string | null
  segment: string | null; source: string | null
  leads: number; enrollments: number; cvr: number; spend: number; cpl: number; cac: number
}
interface TrendCacRow { month: string; course: string | null; enrollments: number }
interface RollingRow {
  as_of_date: string; course: string | null; university: string | null; segment: string | null; source: string | null
  leads_90d: number; enrollments_90d: number; spend_90d: number
  cvr_90d: number; cpl_90d: number; cac_90d: number
}
interface PeriodSpendRow { course: string | null; university: string | null; platform: string; spend: number }
interface TrendSpendRow { date: string; platform: string; course: string | null; spend: number }
interface L2EPoint { month: string; 'Paid Search': number; 'Paid Social': number }
interface YoYPoint { month: string; '2024': number; '2025': number; '2026': number }
interface WeekPoint { week: string; google: number; meta: number }
interface DayPoint { date: string; google: number; meta: number }

interface MtdEnrolledContact {
  first_name: string | null
  last_name: string | null
  course: string | null
  university: string | null
  advisor: string | null
  segment: string | null
}

interface ContentProps {
  period: Period
  customMonth: string | null
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
  salesCycleData: { month: string; days: number }[]
  monthlyCacData: { month: string; B2C: number; WFD: number; B2C_enroll: number; WFD_enroll: number }[]
  bookingRevenueMtd: number
  enrolledNames: MtdEnrolledContact[]
  trendCacRows: TrendCacRow[]
}

// ── Content component ────────────────────────────────────────────────────────

function CacReportContent({
  period, customMonth, cacRows, rollingRows, periodSpendRows,
  trendMonths, trendSpendRows, l2eData, yoyData, weeklyData, dailyData, currentMonthLabel,
  salesCycleData, monthlyCacData, bookingRevenueMtd, enrolledNames, trendCacRows,
}: ContentProps) {
  const isRolling = period === '90d'

  const totalLeads = isRolling
    ? rollingRows.reduce((s, r) => s + r.leads_90d, 0)
    : cacRows.reduce((s, r) => s + r.leads, 0)
  const totalEnrollments = isRolling
    ? rollingRows.reduce((s, r) => s + r.enrollments_90d, 0)
    : cacRows.reduce((s, r) => s + r.enrollments, 0)

  // Use ad_spend directly as the source of truth for total spend — no double-counting possible
  // since ad_spend is keyed by (date, platform, campaign_name). periodSpendRows covers both
  // non-rolling and 90d periods (fetched with the same university filter as cacRows).
  const totalSpend = periodSpendRows.reduce((s, r) => s + Number(r.spend), 0)

  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
  const blendedCac = totalEnrollments > 0 ? totalSpend / totalEnrollments : 0

  // Per-platform spend map keyed by "course|university|platform"
  const platMap = new Map<string, number>()
  for (const r of periodSpendRows) {
    const key = `${r.course ?? ''}|${r.university ?? ''}|${r.platform}`
    platMap.set(key, (platMap.get(key) ?? 0) + Number(r.spend))
  }

  // Platform split tiles (Google vs Meta spend + CPL)
  const googleSpend = periodSpendRows.filter((r) => r.platform === 'google').reduce((s, r) => s + Number(r.spend), 0)
  const metaSpend   = periodSpendRows.filter((r) => r.platform === 'meta').reduce((s, r) => s + Number(r.spend), 0)
  const googleLeads = isRolling
    ? rollingRows.filter((r) => r.source === 'Paid Search').reduce((s, r) => s + r.leads_90d, 0)
    : cacRows.filter((r) => r.source === 'Paid Search').reduce((s, r) => s + r.leads, 0)
  const metaLeads = isRolling
    ? rollingRows.filter((r) => r.source === 'Paid Social').reduce((s, r) => s + r.leads_90d, 0)
    : cacRows.filter((r) => r.source === 'Paid Social').reduce((s, r) => s + r.leads, 0)
  const googleCpl = googleLeads > 0 ? googleSpend / googleLeads : 0
  const metaCpl   = metaLeads > 0   ? metaSpend   / metaLeads   : 0

  // Spend per course and per course|university from ad_spend (no double-counting)
  const spendByCourse = new Map<string, number>()
  const spendByCourseUni = new Map<string, number>()
  for (const r of periodSpendRows) {
    const c = r.course ?? 'General'
    spendByCourse.set(c, (spendByCourse.get(c) ?? 0) + Number(r.spend))
    const key = `${c}|${r.university ?? ''}`
    spendByCourseUni.set(key, (spendByCourseUni.get(key) ?? 0) + Number(r.spend))
  }

  // SBU aggregation — leads/enrollments from cac_metrics, spend from ad_spend
  type SbuEntry = { leads: number; enrollments: number; uniMap: Map<string, { leads: number; enrollments: number }> }
  const sbuMap = new Map<string, SbuEntry>()
  for (const course of COURSES) sbuMap.set(course, { leads: 0, enrollments: 0, uniMap: new Map() })

  const sourceRows = isRolling
    ? rollingRows.map((r) => ({ course: r.course, university: r.university, leads: r.leads_90d, enrollments: r.enrollments_90d }))
    : cacRows.map((r) => ({ course: r.course, university: r.university, leads: r.leads, enrollments: r.enrollments }))

  for (const r of sourceRows) {
    const course = r.course ?? 'General'
    const sbu = sbuMap.get(course) ?? sbuMap.get('General')!
    sbu.leads += r.leads; sbu.enrollments += r.enrollments
    if (r.university) {
      const u = sbu.uniMap.get(r.university) ?? { leads: 0, enrollments: 0 }
      u.leads += r.leads; u.enrollments += r.enrollments
      sbu.uniMap.set(r.university, u)
    }
  }

  const sbuRows = COURSES.map((course) => {
    const sbu = sbuMap.get(course)!
    const spend = spendByCourse.get(course) ?? 0
    const cvr = sbu.leads > 0 ? sbu.enrollments / sbu.leads : 0
    const cpl = sbu.leads > 0 ? spend / sbu.leads : 0
    const cac = sbu.enrollments > 0 ? spend / sbu.enrollments : 0

    const byUniversity = Array.from(sbu.uniMap.entries()).map(([uni, u]) => {
      const spendGoogle = platMap.get(`${course}|${uni}|google`) ?? 0
      const spendMeta = platMap.get(`${course}|${uni}|meta`) ?? 0
      const uniSpend = spendByCourseUni.get(`${course}|${uni}`) ?? (spendGoogle + spendMeta)
      return {
        university: uni,
        leads: u.leads,
        enrollments: u.enrollments,
        cvr: u.leads > 0 ? u.enrollments / u.leads : 0,
        spendGoogle,
        spendMeta,
        cplGoogle: u.leads > 0 ? spendGoogle / u.leads : 0,
        cplMeta: u.leads > 0 ? spendMeta / u.leads : 0,
        cac: u.enrollments > 0 ? uniSpend / u.enrollments : 0,
      }
    })

    return { course, leads: sbu.leads, enrollments: sbu.enrollments, cvr, spend, cpl, cac, byUniversity }
  })

  // CAC trend data (6 months per SBU) — spend from ad_spend (no double-count)
  const trendData = trendMonths.map((month) => {
    const [mon, yr] = month.split('-')
    const prefix = `20${yr}-${MONTH_MAP[mon]}`
    const point: Record<string, number | string> = { month }
    for (const course of COURSES) {
      const enroll = trendCacRows.filter((r) => r.month === month && r.course === course)
        .reduce((s, r) => s + r.enrollments, 0)
      const spend = trendSpendRows.filter((r) => r.date.startsWith(prefix) && r.course === course)
        .reduce((s, r) => s + Number(r.spend), 0)
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

  // Period label — shows month name when navigating via ‹ ›
  const periodLabel = customMonth
    ? (() => { const [mon, yr] = customMonth.split('-'); return `${mon} 20${yr}` })()
    : ({ mtd: 'MTD', last_month: 'Last Mo.', '90d': '90-Day', ytd: 'YTD' }[period] ?? 'MTD')

  // Gauge values derived from period data (totalLeads / totalEnrollments / totalSpend)
  const gaugeL2E = totalLeads > 0 ? (totalEnrollments / totalLeads) * 100 : 0

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
        {/* Row 1: Summary stat cards — 5 cols */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard label={`Total Leads ${periodLabel}`} value={totalLeads.toLocaleString()} accent="blue" />
          <StatCard label={`Enrollments ${periodLabel}`} value={totalEnrollments.toLocaleString()} accent="green" />
          <StatCard
            label="Bookings MTD"
            value={bookingRevenueMtd > 0 ? `$${Math.round(bookingRevenueMtd).toLocaleString()}` : '—'}
            accent="green"
          />
          <StatCard label="Blended CPL" value={blendedCpl > 0 ? `$${Math.round(blendedCpl).toLocaleString()}` : '—'} accent="teal" />
          <StatCard label="Blended CAC" value={blendedCac > 0 ? `$${Math.round(blendedCac).toLocaleString()}` : '—'} accent="amber" />
        </div>

        {/* Row 2: Platform spend tiles — Total Spend first */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            label={`Total Spend ${periodLabel}`}
            value={(googleSpend + metaSpend) > 0 ? `$${Math.round(googleSpend + metaSpend).toLocaleString()}` : '—'}
            accent="amber"
          />
          <StatCard
            label={`Google Spend ${periodLabel}`}
            value={googleSpend > 0 ? `$${Math.round(googleSpend).toLocaleString()}` : '—'}
            accent="blue"
          />
          <StatCard
            label={`Meta Spend ${periodLabel}`}
            value={metaSpend > 0 ? `$${Math.round(metaSpend).toLocaleString()}` : '—'}
            accent="teal"
          />
          <StatCard
            label="Google CPL"
            value={googleCpl > 0 ? `$${Math.round(googleCpl).toLocaleString()}` : '—'}
            accent="blue"
          />
          <StatCard
            label="Meta CPL"
            value={metaCpl > 0 ? `$${Math.round(metaCpl).toLocaleString()}` : '—'}
            accent="teal"
          />
        </div>

        {/* Row 3: Gauges — follow active period */}
        <div className="grid grid-cols-4 gap-4">
          <GaugeCard
            label={`Spend ${periodLabel}`}
            value={totalSpend}
            displayValue={totalSpend > 0 ? `$${Math.round(totalSpend / 1000)}k` : '—'}
            max={250000}
            color="#2563EB"
            formatMin="$0"
            formatMax="$250k"
          />
          <GaugeCard
            label={`Leads ${periodLabel}`}
            value={totalLeads}
            displayValue={totalLeads.toLocaleString()}
            max={6000}
            color="#059669"
            formatMin="0"
            formatMax="6,000"
          />
          <GaugeCard
            label={`Enrollment ${periodLabel}`}
            value={totalEnrollments}
            displayValue={totalEnrollments.toLocaleString()}
            max={250}
            color="#D97706"
            formatMin="0"
            formatMax="250"
          />
          <GaugeCard
            label={`L2E% ${periodLabel}`}
            value={gaugeL2E}
            displayValue={gaugeL2E > 0 ? `${gaugeL2E.toFixed(2)}%` : '—'}
            max={12}
            color="#7C3AED"
            formatMin="0%"
            formatMax="12%"
          />
        </div>

        {/* Sales Cycle + Monthly CAC charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <SalesCycleChart data={salesCycleData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlyCacBarChart data={monthlyCacData} />
          </div>
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

        {/* SBU detail table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="font-display text-[13px] font-bold text-slate-900">SBU Breakdown</span>
            <span className="text-[11px] text-slate-400">Click a row to expand by university</span>
          </div>
          <SbuTable rows={sbuRows} />
        </div>

        {/* Charts row 1: Daily Spend | Weekly Paid Media */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <DailySpendChart data={dailyData} monthLabel={currentMonthLabel} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <WeeklySpendChart data={weeklyData} />
          </div>
        </div>

        {/* Charts row 2: Monthly Ad Spend | YoY Ad Spend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlySpendChart data={monthlySpend} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <YoYSpendChart data={yoyData} />
          </div>
        </div>

        {/* Charts row 3: CAC Trend | L2E% Trend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CacTrendChart data={trendData} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <L2ETrendChart data={l2eData} />
          </div>
        </div>

        {/* Enrollment Names — follow active period */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="font-display text-[13px] font-bold text-slate-900">Enrollments</span>
            <span className="text-[11px] text-slate-400">{periodLabel} · {enrolledNames.length} enrolled</span>
          </div>
          {enrolledNames.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-slate-400">No enrollments recorded for this period yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">#</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">Name</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">Course</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">University</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">Advisor</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.5px]">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledNames.map((c: MtdEnrolledContact, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-900">
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600">{c.course ?? '—'}</td>
                      <td className="px-5 py-2.5 text-slate-600">{c.university ?? '—'}</td>
                      <td className="px-5 py-2.5 text-slate-600">{c.advisor ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        {c.segment ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            c.segment === 'B2C' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {c.segment}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
