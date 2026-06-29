import { createAdminClient } from '@/lib/supabase/server'
import { getLast12Months } from '@/lib/metrics/periods'
import { fetchGoals, goalsForMonth } from '@/lib/hubspot/goals'
import DailyLeadsChart from './DailyLeadsChart'
import MonthlyTrendChart from './MonthlyTrendChart'

const COURSES = ['Digital Marketing', 'UI/UX Design', 'Generative AI Data Analyst', 'General'] as const

function formatMonth(date: Date): string {
  const LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${LABELS[date.getMonth()]}-${String(date.getFullYear()).slice(2)}`
}

type RagStatus = 'green' | 'amber' | 'red' | 'none'

function ragStatus(actual: number, target: number, paceRatio: number): RagStatus {
  if (!target) return 'none'
  const achievement = actual / target
  if (achievement >= paceRatio) return 'green'
  if (achievement >= paceRatio * 0.77) return 'amber'
  return 'red'
}

export default async function PacingPage() {
  const supabase = createAdminClient()

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = today.getDate()
  const daysLeft = daysInMonth - daysElapsed
  const paceRatio = daysElapsed / daysInMonth
  const todayStr = today.toISOString().split('T')[0]
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const monthStart = `${monthStr}-01`
  const currentMonthLabel = formatMonth(today)

  // YTD months (current year only)
  const allMonths = getLast12Months()
  const ytdMonths = allMonths.filter((m) => m.endsWith(String(year).slice(2)))

  // ── Parallel data fetch ───────────────────────────────────────────
  const [
    { data: currentContacts },
    { data: monthSpendRaw },
    { data: ytdContactsRaw },
    { data: dailyContactsRaw },
  ] = await Promise.all([
    supabase.from('contacts')
      .select('course, viable, enrolled, segment')
      .eq('month', currentMonthLabel),
    supabase.from('ad_spend')
      .select('course, spend')
      .gte('date', monthStart).lte('date', todayStr),
    supabase.from('contacts')
      .select('month, viable, enrolled')
      .in('month', ytdMonths),
    supabase.from('contacts')
      .select('create_date, viable')
      .gte('create_date', monthStart).lte('create_date', todayStr),
  ])

  // Goals (graceful fallback)
  let goals: Awaited<ReturnType<typeof fetchGoals>> = []
  try { goals = await fetchGoals() } catch { /* goals unavailable */ }
  const monthGoals = goalsForMonth(goals, year, month)

  // ── Current month aggregations ────────────────────────────────────
  const contacts = currentContacts ?? []
  const totalLeads = contacts.filter((c) => c.viable).length
  const totalEnrolled = contacts.filter((c) => c.enrolled).length
  const totalSpend = (monthSpendRaw ?? []).reduce((s, r) => s + Number(r.spend), 0)

  const projectedEnrollments = daysElapsed > 0 && totalEnrolled > 0
    ? totalEnrolled * daysInMonth / daysElapsed
    : 0
  const projectedCac = projectedEnrollments > 0 && totalSpend > 0
    ? Math.round(totalSpend / projectedEnrollments)
    : null

  // ── Parse goals ───────────────────────────────────────────────────
  // Try to match goals to leads/enrollments by name keywords
  const totalLeadsTarget = matchGoalTarget(monthGoals, ['lead', 'leads'])
  const totalEnrollTarget = matchGoalTarget(monthGoals, ['enroll', 'enrollment', 'student'])

  // ── SBU data ─────────────────────────────────────────────────────
  const sbuRows = COURSES.map((course) => {
    const cc = contacts.filter((c) => c.course === course)
    const leads = cc.filter((c) => c.viable).length
    const enrolled = cc.filter((c) => c.enrolled).length
    const spend = (monthSpendRaw ?? []).filter((r) => r.course === course).reduce((s, r) => s + Number(r.spend), 0)
    const projEnroll = daysElapsed > 0 && enrolled > 0 ? enrolled * daysInMonth / daysElapsed : 0
    const projCac = projEnroll > 0 && spend > 0 ? Math.round(spend / projEnroll) : null
    const leadsTarget = matchGoalTarget(monthGoals, ['lead', 'leads', course.toLowerCase().split(' ')[0]])
    const enrollTarget = matchGoalTarget(monthGoals, ['enroll', course.toLowerCase().split(' ')[0]])

    return {
      course,
      leads, leadsTarget,
      enrolled, enrollTarget,
      spend, projCac,
      leadsRag: ragStatus(leads, leadsTarget, paceRatio),
      enrollRag: ragStatus(enrolled, enrollTarget, paceRatio),
    }
  })

  // ── Daily leads chart ─────────────────────────────────────────────
  const dailyPace = totalLeadsTarget > 0 ? totalLeadsTarget / daysInMonth : 0
  const dailyMap = new Map<number, number>()
  for (const c of dailyContactsRaw ?? []) {
    if (!c.create_date || !c.viable) continue
    const d = new Date(c.create_date).getDate()
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + 1)
  }
  const dailyData = Array.from({ length: daysElapsed }, (_, i) => ({
    day: String(i + 1),
    actual: dailyMap.get(i + 1) ?? 0,
    pace: dailyPace,
  }))

  // ── YTD monthly trend ─────────────────────────────────────────────
  const ytdContacts = ytdContactsRaw ?? []
  const ytdLeadsData = ytdMonths.map((m) => ({
    month: m,
    actual: ytdContacts.filter((c) => c.month === m && c.viable).length,
    target: null as number | null,
  }))
  const ytdEnrollData = ytdMonths.map((m) => ({
    month: m,
    actual: ytdContacts.filter((c) => c.month === m && c.enrolled).length,
    target: null as number | null,
  }))

  const pctLeads = totalLeadsTarget > 0 ? Math.round(totalLeads / totalLeadsTarget * 100) : null
  const pctEnroll = totalEnrollTarget > 0 ? Math.round(totalEnrolled / totalEnrollTarget * 100) : null
  const pctElapsed = Math.round(paceRatio * 100)

  const RAG_BG = { green: 'bg-emerald-50 border-emerald-200', amber: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200', none: 'bg-white border-slate-200' }
  const RAG_BADGE = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', none: 'bg-slate-100 text-slate-500' }
  const RAG_LABEL = { green: 'On Track', amber: 'At Risk', red: 'Behind', none: '' }

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-4 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Pacing</h1>
        <span className="text-[12px] text-slate-500 font-medium">
          {today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <span className="text-[11px] text-slate-400">Day {daysElapsed} of {daysInMonth} · {daysLeft} days left</span>
        <div className="flex-1" />
        {/* Progress bars */}
        <div className="flex items-center gap-4">
          <ProgressBar label="Month" pct={pctElapsed} color="bg-slate-400" />
          <ProgressBar label="Leads" pct={pctLeads ?? pctElapsed} color="bg-blue-500" />
          <ProgressBar label="Enrollments" pct={pctEnroll ?? pctElapsed} color="bg-emerald-500" />
        </div>
        {projectedCac !== null && (
          <div className="text-right ml-2">
            <div className="text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">Proj. EOM CAC</div>
            <div className="font-mono text-[15px] font-semibold text-slate-900">${projectedCac.toLocaleString()}</div>
          </div>
        )}
      </header>

      <div className="p-6 space-y-4">
        {/* SBU RAG cards */}
        <div className="grid grid-cols-4 gap-3">
          {sbuRows.map((row) => {
            const rag = row.leadsRag !== 'none' ? row.leadsRag : row.enrollRag
            return (
              <div key={row.course} className={`border rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${RAG_BG[rag]}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="font-display text-[12px] font-bold text-slate-900 leading-tight pr-2">{row.course}</div>
                  {rag !== 'none' && (
                    <span className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full shrink-0 ${RAG_BADGE[rag]}`}>
                      {RAG_LABEL[rag]}
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  <KpiRow
                    label="Leads"
                    actual={row.leads}
                    target={row.leadsTarget}
                    rag={row.leadsRag}
                  />
                  <KpiRow
                    label="Enrollments"
                    actual={row.enrolled}
                    target={row.enrollTarget}
                    rag={row.enrollRag}
                  />
                  {row.projCac !== null && (
                    <div className="pt-1 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Proj. CAC</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-700">${row.projCac.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Daily leads chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px]">Daily Leads</span>
            {totalLeadsTarget > 0 && (
              <span className="text-[11px] text-slate-400">Target: {totalLeadsTarget} total ({Math.round(dailyPace * 10) / 10}/day)</span>
            )}
          </div>
          <DailyLeadsChart data={dailyData} />
        </div>

        {/* Enrollment pacing table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200">
            <span className="font-display text-[13px] font-bold text-slate-900">Enrollment Pacing</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['SBU', 'Enrolled', 'Target', 'Run Rate', 'Proj. EOM', 'Days Left', 'Needed/Day'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold first:text-left text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sbuRows.map((row) => {
                  const runRate = daysElapsed > 0 ? (row.enrolled / daysElapsed * daysInMonth) : 0
                  const needed = row.enrollTarget > 0 && daysLeft > 0
                    ? Math.max(0, Math.ceil((row.enrollTarget - row.enrolled) / daysLeft))
                    : null
                  const projEom = Math.round(runRate)
                  const RAG_TEXT = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', none: 'text-slate-600' }
                  return (
                    <tr key={row.course} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.course}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${RAG_TEXT[row.enrollRag]}`}>{row.enrolled}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{row.enrollTarget > 0 ? row.enrollTarget : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600">{(row.enrolled / daysElapsed).toFixed(1)}/day</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700">{projEom > 0 ? projEom : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{daysLeft}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600">{needed !== null ? needed : ''}</td>
                    </tr>
                  )
                })}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{totalEnrolled}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">{totalEnrollTarget > 0 ? totalEnrollTarget : ''}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{(totalEnrolled / daysElapsed).toFixed(1)}/day</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {daysElapsed > 0 && totalEnrolled > 0 ? Math.round(totalEnrolled * daysInMonth / daysElapsed) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">{daysLeft}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {totalEnrollTarget > 0 && daysLeft > 0 ? Math.max(0, Math.ceil((totalEnrollTarget - totalEnrolled) / daysLeft)) : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* YTD trend charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlyTrendChart data={ytdLeadsData} title="Monthly Leads YTD" color="#2563EB" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <MonthlyTrendChart data={ytdEnrollData} title="Monthly Enrollments YTD" color="#059669" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchGoalTarget(goals: { name: string; target: number }[], keywords: string[]): number {
  const matched = goals.filter((g) => keywords.some((kw) => g.name.toLowerCase().includes(kw)))
  return matched.reduce((s, g) => s + g.target, 0)
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const capped = Math.min(pct, 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400 w-16 text-right">{label}</span>
      <div className="w-20 h-1.5 bg-slate-200 rounded overflow-hidden">
        <div className={`h-full ${color} rounded transition-all`} style={{ width: `${capped}%` }} />
      </div>
      <span className="font-mono text-[11px] text-slate-600 w-8">{pct}%</span>
    </div>
  )
}

const RAG_ACTUAL = { green: 'text-emerald-700 font-semibold', amber: 'text-amber-700 font-semibold', red: 'text-red-600 font-semibold', none: 'text-slate-700 font-semibold' }

function KpiRow({ label, actual, target, rag }: { label: string; actual: number; target: number; rag: RagStatus }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[10px] text-slate-400">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-[13px] ${RAG_ACTUAL[rag]}`}>{actual.toLocaleString()}</span>
        {target > 0 && (
          <span className="font-mono text-[10px] text-slate-400">/ {target}</span>
        )}
      </div>
    </div>
  )
}
