import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { getMonthsForPeriod, type Period } from '@/lib/metrics/periods'
import FilterBar from '../cac-report/FilterBar'

interface PageProps {
  searchParams: { period?: string; university?: string; segment?: string }
}

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
  return `20${yr}-${MONTH_MAP[mon]}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
}

function getDateRange90d(): { startDate: string; endDate: string } {
  const today = new Date()
  const s = new Date(today); s.setDate(s.getDate() - 90)
  return { startDate: s.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }
}

const PERIOD_LABELS: Record<Period, string> = { mtd: 'MTD', last_month: 'Last Mo.', '90d': '90-Day', ytd: 'YTD' }
const PROGRAMS = ['Digital Marketing', 'UI/UX Design', 'Generative AI Data Analyst', 'General']

// Aggregated data shape for a single (course, university) combination
interface SummaryRow {
  course: string
  university: string | null
  gSpend: number
  fbSpend: number
  paidSearchLeads: number
  paidSocialLeads: number
  organicLeads: number
  otherLeads: number
  totalLeads: number
  enrollments: number
}

function fmt$(n: number): string { return n > 0 ? `$${Math.round(n).toLocaleString()}` : '—' }
function fmtN(n: number): string { return n > 0 ? n.toLocaleString() : '—' }
function fmtPct(n: number): string { return n > 0 ? `${(n * 100).toFixed(1)}%` : '—' }

export default async function GrandSummaryPage({ searchParams }: PageProps) {
  const period = (searchParams.period ?? 'mtd') as Period
  const university = searchParams.university ?? ''
  const segment = searchParams.segment ?? ''
  const supabase = createAdminClient()

  const months = getMonthsForPeriod(period)
  const isRolling = period === '90d'
  const { startDate: start90, endDate: end90 } = getDateRange90d()
  const startDate = isRolling ? start90 : (months.length ? monthLabelToStart(months[0]) : '')
  const endDate = isRolling ? end90 : (months.length ? monthLabelToEnd(months[months.length - 1]) : '')

  // ── Fetch data ───────────────────────────────────────────────────
  let cacQ = supabase.from('cac_metrics').select('course, university, segment, source, leads, enrollments')
  if (isRolling) {
    // Use rolling metrics for 90d
    const { data: rollingRaw } = await supabase
      .from('rolling_metrics')
      .select('course, university, segment, source, leads_90d, enrollments_90d')
      .order('as_of_date', { ascending: false })
      .limit(500)
    const rollingRows = (rollingRaw ?? []).filter((r) => {
      if (university && r.university !== university) return false
      if (segment && r.segment !== segment) return false
      return true
    })

    const spendQ = supabase.from('ad_spend').select('course, university, platform, spend')
      .gte('date', start90).lte('date', end90)
    const { data: spendRaw } = await spendQ
    const spendRows = (spendRaw ?? []).filter((r) => {
      if (university && r.university !== university) return false
      return true
    })

    return (
      <GrandSummaryContent
        period={period}
        rows={buildRows(
          rollingRows.map((r) => ({
            course: r.course, university: r.university, segment: r.segment,
            source: r.source, leads: r.leads_90d, enrollments: r.enrollments_90d,
          })),
          spendRows
        )}
      />
    )
  }

  if (!months.length) {
    return <GrandSummaryContent period={period} rows={[]} />
  }

  if (university) cacQ = cacQ.eq('university', university)
  if (segment) cacQ = cacQ.eq('segment', segment)
  const { data: cacRaw } = await cacQ.in('month', months)

  let spendQ = supabase.from('ad_spend').select('course, university, platform, spend')
    .gte('date', startDate).lte('date', endDate)
  if (university) spendQ = spendQ.eq('university', university)
  const { data: spendRaw } = await spendQ

  return (
    <GrandSummaryContent
      period={period}
      rows={buildRows(cacRaw ?? [], spendRaw ?? [])}
    />
  )
}

function buildRows(
  cacRows: { course: string | null; university: string | null; segment: string | null; source: string | null; leads: number; enrollments: number }[],
  spendRows: { course: string | null; university: string | null; platform: string; spend: number }[]
): SummaryRow[] {
  // Spend map: (course|university) → { google, meta }
  const spendMap = new Map<string, { google: number; meta: number }>()
  for (const r of spendRows) {
    const key = `${r.course ?? ''}|||${r.university ?? ''}`
    const cur = spendMap.get(key) ?? { google: 0, meta: 0 }
    if (r.platform === 'google') cur.google += Number(r.spend)
    else if (r.platform === 'meta') cur.meta += Number(r.spend)
    spendMap.set(key, cur)
  }

  // Leads/enrollments aggregation
  const aggMap = new Map<string, Omit<SummaryRow, 'course' | 'university' | 'gSpend' | 'fbSpend'>>()
  for (const r of cacRows) {
    const key = `${r.course ?? ''}|||${r.university ?? ''}`
    const cur = aggMap.get(key) ?? { paidSearchLeads: 0, paidSocialLeads: 0, organicLeads: 0, otherLeads: 0, totalLeads: 0, enrollments: 0 }
    const src = r.source ?? ''
    if (src === 'Paid Search') cur.paidSearchLeads += r.leads
    else if (src === 'Paid Social') cur.paidSocialLeads += r.leads
    else if (src.toLowerCase().includes('organic')) cur.organicLeads += r.leads
    else cur.otherLeads += r.leads
    cur.totalLeads += r.leads
    cur.enrollments += r.enrollments
    aggMap.set(key, cur)
  }

  const rows: SummaryRow[] = []
  for (const [key, agg] of aggMap) {
    const [course, university] = key.split('|||')
    const spend = spendMap.get(key) ?? { google: 0, meta: 0 }
    rows.push({ course: course || 'General', university: university || null, gSpend: spend.google, fbSpend: spend.meta, ...agg })
  }

  return rows
}

// ── Content component ────────────────────────────────────────────────────────

function GrandSummaryContent({ period, rows }: { period: Period; rows: SummaryRow[] }) {
  const periodLabel = PERIOD_LABELS[period]

  // Grand totals
  const grandTotal = rows.reduce(
    (acc, r) => ({
      gSpend: acc.gSpend + r.gSpend,
      fbSpend: acc.fbSpend + r.fbSpend,
      paidSearchLeads: acc.paidSearchLeads + r.paidSearchLeads,
      paidSocialLeads: acc.paidSocialLeads + r.paidSocialLeads,
      organicLeads: acc.organicLeads + r.organicLeads,
      totalLeads: acc.totalLeads + r.totalLeads,
      enrollments: acc.enrollments + r.enrollments,
    }),
    { gSpend: 0, fbSpend: 0, paidSearchLeads: 0, paidSocialLeads: 0, organicLeads: 0, totalLeads: 0, enrollments: 0 }
  )
  const grandTotalSpend = grandTotal.gSpend + grandTotal.fbSpend

  // Group by program
  const byProgram = new Map<string, SummaryRow[]>()
  for (const r of rows) {
    const prog = r.course
    const list = byProgram.get(prog) ?? []
    list.push(r)
    byProgram.set(prog, list)
  }

  // Program-level subtotals
  function programTotal(progRows: SummaryRow[]): SummaryRow {
    return progRows.reduce(
      (acc, r) => ({
        ...acc,
        gSpend: acc.gSpend + r.gSpend,
        fbSpend: acc.fbSpend + r.fbSpend,
        paidSearchLeads: acc.paidSearchLeads + r.paidSearchLeads,
        paidSocialLeads: acc.paidSocialLeads + r.paidSocialLeads,
        organicLeads: acc.organicLeads + r.organicLeads,
        otherLeads: acc.otherLeads + r.otherLeads,
        totalLeads: acc.totalLeads + r.totalLeads,
        enrollments: acc.enrollments + r.enrollments,
      }),
      { course: progRows[0]?.course ?? '', university: null, gSpend: 0, fbSpend: 0, paidSearchLeads: 0, paidSocialLeads: 0, organicLeads: 0, otherLeads: 0, totalLeads: 0, enrollments: 0 }
    )
  }

  function rowMetrics(r: Pick<SummaryRow, 'gSpend' | 'fbSpend' | 'paidSearchLeads' | 'paidSocialLeads' | 'totalLeads' | 'enrollments'>) {
    const totalSpend = r.gSpend + r.fbSpend
    const l2e = r.totalLeads > 0 ? r.enrollments / r.totalLeads : 0
    const gCpl = r.paidSearchLeads > 0 ? r.gSpend / r.paidSearchLeads : 0
    const fbCpl = r.paidSocialLeads > 0 ? r.fbSpend / r.paidSocialLeads : 0
    const blendedCpl = r.totalLeads > 0 ? totalSpend / r.totalLeads : 0
    const blendedCac = r.enrollments > 0 ? totalSpend / r.enrollments : 0
    return { totalSpend, l2e, gCpl, fbCpl, blendedCpl, blendedCac }
  }

  const gtMetrics = rowMetrics({
    gSpend: grandTotal.gSpend, fbSpend: grandTotal.fbSpend,
    paidSearchLeads: grandTotal.paidSearchLeads, paidSocialLeads: grandTotal.paidSocialLeads,
    totalLeads: grandTotal.totalLeads, enrollments: grandTotal.enrollments,
  })

  return (
    <div>
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-3 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Grand Summary</h1>
        <div className="flex-1" />
        <Suspense>
          <FilterBar />
        </Suspense>
      </header>

      <div className="p-6 space-y-4">
        {/* Grand total stat cards */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Spend {periodLabel}</div>
            <div className="text-[22px] font-bold text-slate-900 tabular-nums">{fmt$(grandTotalSpend)}</div>
            <div className="flex gap-3 mt-1 text-[11px] text-slate-500">
              <span>G: {fmt$(grandTotal.gSpend)}</span>
              <span>FB: {fmt$(grandTotal.fbSpend)}</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Leads</div>
            <div className="text-[22px] font-bold text-slate-900 tabular-nums">{fmtN(grandTotal.totalLeads)}</div>
            <div className="flex gap-3 mt-1 text-[11px] text-slate-500">
              <span>PS: {grandTotal.paidSearchLeads}</span>
              <span>FB: {grandTotal.paidSocialLeads}</span>
              <span>Org: {grandTotal.organicLeads}</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Enrollments</div>
            <div className="text-[22px] font-bold text-slate-900 tabular-nums">{fmtN(grandTotal.enrollments)}</div>
            <div className="mt-1 text-[11px] text-slate-500">L2E: {fmtPct(gtMetrics.l2e)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Blended CPL</div>
            <div className="text-[22px] font-bold text-slate-900 tabular-nums">{fmt$(gtMetrics.blendedCpl)}</div>
            <div className="flex gap-3 mt-1 text-[11px] text-slate-500">
              <span>G: {fmt$(gtMetrics.gCpl)}</span>
              <span>FB: {fmt$(gtMetrics.fbCpl)}</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Blended CAC</div>
            <div className="text-[22px] font-bold text-slate-900 tabular-nums">{fmt$(gtMetrics.blendedCac)}</div>
          </div>
        </div>

        {/* Main summary table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="font-display text-[13px] font-bold text-slate-900">Summary by Program × Campus</span>
            <span className="text-[11px] text-slate-400">click rows to see campus breakdown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold sticky left-0 bg-slate-50" rowSpan={2}>Program / Campus</th>
                  {/* Spend group */}
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-blue-50 text-blue-600" colSpan={3}>Spend</th>
                  {/* Leads group */}
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-teal-50 text-teal-600" colSpan={4}>Leads</th>
                  {/* Conversions group */}
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-green-50 text-green-600" colSpan={2}>Conversions</th>
                  {/* CPL group */}
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-amber-50 text-amber-600" colSpan={3}>CPL</th>
                  {/* CAC */}
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-rose-50 text-rose-600" colSpan={1}>CAC</th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Google</th>
                  <th className="text-right px-3 py-2 font-semibold">Meta</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Paid Srch</th>
                  <th className="text-right px-3 py-2 font-semibold">Paid Soc</th>
                  <th className="text-right px-3 py-2 font-semibold">Organic</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Enrollments</th>
                  <th className="text-right px-3 py-2 font-semibold">L2E%</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Google</th>
                  <th className="text-right px-3 py-2 font-semibold">Meta</th>
                  <th className="text-right px-3 py-2 font-semibold">Blended</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Blended</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={14} className="px-4 py-8 text-center text-slate-400">No data for this period</td></tr>
                )}
                {PROGRAMS.map((prog) => {
                  const progRows = (byProgram.get(prog) ?? []).sort((a, b) => (b.gSpend + b.fbSpend) - (a.gSpend + a.fbSpend))
                  if (!progRows.length) return null
                  const pt = programTotal(progRows)
                  const pm = rowMetrics(pt)
                  return (
                    <SummaryProgramGroup
                      key={prog}
                      program={prog}
                      totalRow={pt}
                      totalMetrics={pm}
                      campusRows={progRows}
                    />
                  )
                })}
                {/* Programs not in the fixed list */}
                {Array.from(byProgram.keys())
                  .filter((p) => !PROGRAMS.includes(p))
                  .map((prog) => {
                    const progRows = (byProgram.get(prog) ?? []).sort((a, b) => (b.gSpend + b.fbSpend) - (a.gSpend + a.fbSpend))
                    const pt = programTotal(progRows)
                    const pm = rowMetrics(pt)
                    return (
                      <SummaryProgramGroup
                        key={prog}
                        program={prog}
                        totalRow={pt}
                        totalMetrics={pm}
                        campusRows={progRows}
                      />
                    )
                  })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-800 text-[12px] border-t-2 border-slate-300">
                    <td className="px-4 py-3 sticky left-0 bg-slate-100">Grand Total</td>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-slate-200">{fmt$(grandTotal.gSpend)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt$(grandTotal.fbSpend)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt$(grandTotalSpend)}</td>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-slate-200">{fmtN(grandTotal.paidSearchLeads)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtN(grandTotal.paidSocialLeads)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtN(grandTotal.organicLeads)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtN(grandTotal.totalLeads)}</td>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-slate-200">{fmtN(grandTotal.enrollments)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtPct(gtMetrics.l2e)}</td>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-slate-200">{fmt$(gtMetrics.gCpl)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt$(gtMetrics.fbCpl)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt$(gtMetrics.blendedCpl)}</td>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-slate-200">{fmt$(gtMetrics.blendedCac)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryProgramGroup({
  program,
  totalRow,
  totalMetrics,
  campusRows,
}: {
  program: string
  totalRow: SummaryRow
  totalMetrics: ReturnType<typeof rowMetrics>
  campusRows: SummaryRow[]
}) {
  const totalSpend = totalRow.gSpend + totalRow.fbSpend
  return (
    <>
      {/* Program total row */}
      <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-800 text-[12px]">
        <td className="px-4 py-2.5 sticky left-0 bg-slate-50">{program}</td>
        <td className="px-3 py-2.5 text-right tabular-nums border-l border-slate-100 text-blue-700">{fmt$(totalRow.gSpend)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-teal-700">{fmt$(totalRow.fbSpend)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmt$(totalSpend)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums border-l border-slate-100">{fmtN(totalRow.paidSearchLeads)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{fmtN(totalRow.paidSocialLeads)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{fmtN(totalRow.organicLeads)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmtN(totalRow.totalLeads)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums border-l border-slate-100 font-bold">{fmtN(totalRow.enrollments)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(totalMetrics.l2e)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums border-l border-slate-100 text-blue-700">{fmt$(totalMetrics.gCpl)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-teal-700">{fmt$(totalMetrics.fbCpl)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{fmt$(totalMetrics.blendedCpl)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums border-l border-slate-100">{fmt$(totalMetrics.blendedCac)}</td>
      </tr>
      {/* Campus sub-rows */}
      {campusRows.filter((r) => r.university).map((r, i) => {
        const rSpend = r.gSpend + r.fbSpend
        const rM = rowMetrics(r)
        return (
          <tr key={i} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors text-[11.5px]">
            <td className="px-4 py-2 pl-8 sticky left-0 bg-white hover:bg-slate-50">{r.university}</td>
            <td className="px-3 py-2 text-right tabular-nums border-l border-slate-100 text-blue-600">{fmt$(r.gSpend)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-teal-600">{fmt$(r.fbSpend)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-700 font-medium">{fmt$(rSpend)}</td>
            <td className="px-3 py-2 text-right tabular-nums border-l border-slate-100">{fmtN(r.paidSearchLeads)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtN(r.paidSocialLeads)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtN(r.organicLeads)}</td>
            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtN(r.totalLeads)}</td>
            <td className="px-3 py-2 text-right tabular-nums border-l border-slate-100 font-medium">{fmtN(r.enrollments)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtPct(rM.l2e)}</td>
            <td className="px-3 py-2 text-right tabular-nums border-l border-slate-100 text-blue-600">{fmt$(rM.gCpl)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-teal-600">{fmt$(rM.fbCpl)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmt$(rM.blendedCpl)}</td>
            <td className="px-3 py-2 text-right tabular-nums border-l border-slate-100">{fmt$(rM.blendedCac)}</td>
          </tr>
        )
      })}
    </>
  )
}

function rowMetrics(r: Pick<SummaryRow, 'gSpend' | 'fbSpend' | 'paidSearchLeads' | 'paidSocialLeads' | 'totalLeads' | 'enrollments'>) {
  const totalSpend = r.gSpend + r.fbSpend
  return {
    totalSpend,
    l2e: r.totalLeads > 0 ? r.enrollments / r.totalLeads : 0,
    gCpl: r.paidSearchLeads > 0 ? r.gSpend / r.paidSearchLeads : 0,
    fbCpl: r.paidSocialLeads > 0 ? r.fbSpend / r.paidSocialLeads : 0,
    blendedCpl: r.totalLeads > 0 ? totalSpend / r.totalLeads : 0,
    blendedCac: r.enrollments > 0 ? totalSpend / r.enrollments : 0,
  }
}
