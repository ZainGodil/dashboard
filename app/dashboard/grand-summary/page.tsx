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

// Canonical source order — matches the Excel sheet column order
const ALL_SOURCES = [
  'Paid Search',
  'Paid Social',
  'Organic Search',
  'Organic Social',
  'Direct Traffic',
  'Affiliate Learner',
  'Offline Sources',
  'Referrals',
  'Other Campaigns',
  'AI Referrals',
  'Email Marketing',
]

interface SummaryRow {
  course: string
  university: string | null
  gSpend: number
  fbSpend: number
  leadsBySource: Record<string, number>
  totalLeads: number
  enrollmentsBySource: Record<string, number>
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

  if (isRolling) {
    const [{ data: rollingRaw }, { data: spendRaw }] = await Promise.all([
      supabase.from('rolling_metrics')
        .select('course, university, segment, source, leads_90d, enrollments_90d')
        .order('as_of_date', { ascending: false }).limit(500),
      (() => {
        let q = supabase.from('ad_spend').select('course, university, platform, spend')
          .gte('date', start90).lte('date', end90)
        if (university) q = q.eq('university', university)
        return q
      })(),
    ])
    const rollingRows = (rollingRaw ?? []).filter((r) => {
      if (university && r.university !== university) return false
      if (segment && r.segment !== segment) return false
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
          spendRaw ?? []
        )}
      />
    )
  }

  if (!months.length) return <GrandSummaryContent period={period} rows={[]} />

  let cacQ = supabase.from('cac_metrics').select('course, university, segment, source, leads, enrollments').in('month', months)
  if (university) cacQ = cacQ.eq('university', university)
  if (segment) cacQ = cacQ.eq('segment', segment)

  let spendQ = supabase.from('ad_spend').select('course, university, platform, spend')
    .gte('date', startDate).lte('date', endDate)
  if (university) spendQ = spendQ.eq('university', university)

  const [{ data: cacRaw }, { data: spendRaw }] = await Promise.all([cacQ, spendQ])

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
  const spendMap = new Map<string, { google: number; meta: number }>()
  for (const r of spendRows) {
    const key = `${r.course ?? ''}|||${r.university ?? ''}`
    const cur = spendMap.get(key) ?? { google: 0, meta: 0 }
    if (r.platform === 'google') cur.google += Number(r.spend)
    else if (r.platform === 'meta') cur.meta += Number(r.spend)
    spendMap.set(key, cur)
  }

  const aggMap = new Map<string, { leadsBySource: Record<string, number>; totalLeads: number; enrollmentsBySource: Record<string, number>; enrollments: number }>()
  for (const r of cacRows) {
    const key = `${r.course ?? ''}|||${r.university ?? ''}`
    const cur = aggMap.get(key) ?? { leadsBySource: {}, totalLeads: 0, enrollmentsBySource: {}, enrollments: 0 }
    const src = r.source ?? 'Other'
    cur.leadsBySource[src] = (cur.leadsBySource[src] ?? 0) + r.leads
    cur.totalLeads += r.leads
    if (r.enrollments > 0) {
      cur.enrollmentsBySource[src] = (cur.enrollmentsBySource[src] ?? 0) + r.enrollments
    }
    cur.enrollments += r.enrollments
    aggMap.set(key, cur)
  }

  // Union all keys so spend-only rows (campaigns with no tracked leads) are included
  const allKeys = new Set([...spendMap.keys(), ...aggMap.keys()])
  const rows: SummaryRow[] = []
  for (const key of allKeys) {
    const [course, university] = key.split('|||')
    const spend = spendMap.get(key) ?? { google: 0, meta: 0 }
    const agg = aggMap.get(key) ?? { leadsBySource: {}, totalLeads: 0, enrollmentsBySource: {}, enrollments: 0 }
    rows.push({
      course: course || 'General',
      university: university || null,
      gSpend: spend.google,
      fbSpend: spend.meta,
      leadsBySource: agg.leadsBySource,
      totalLeads: agg.totalLeads,
      enrollmentsBySource: agg.enrollmentsBySource,
      enrollments: agg.enrollments,
    })
  }
  return rows
}

function rowMetrics(r: SummaryRow) {
  const totalSpend = r.gSpend + r.fbSpend
  const paidSearchLeads = r.leadsBySource['Paid Search'] ?? 0
  const paidSocialLeads = r.leadsBySource['Paid Social'] ?? 0
  return {
    totalSpend,
    l2e: r.totalLeads > 0 ? r.enrollments / r.totalLeads : 0,
    gCpl: paidSearchLeads > 0 ? r.gSpend / paidSearchLeads : 0,
    fbCpl: paidSocialLeads > 0 ? r.fbSpend / paidSocialLeads : 0,
    blendedCpl: r.totalLeads > 0 ? totalSpend / r.totalLeads : 0,
    blendedCac: r.enrollments > 0 ? totalSpend / r.enrollments : 0,
  }
}

function addRows(a: SummaryRow, b: SummaryRow): SummaryRow {
  const leadsBySource = { ...a.leadsBySource }
  for (const [src, n] of Object.entries(b.leadsBySource)) {
    leadsBySource[src] = (leadsBySource[src] ?? 0) + n
  }
  const enrollmentsBySource = { ...a.enrollmentsBySource }
  for (const [src, n] of Object.entries(b.enrollmentsBySource)) {
    enrollmentsBySource[src] = (enrollmentsBySource[src] ?? 0) + n
  }
  return {
    course: a.course,
    university: null,
    gSpend: a.gSpend + b.gSpend,
    fbSpend: a.fbSpend + b.fbSpend,
    leadsBySource,
    totalLeads: a.totalLeads + b.totalLeads,
    enrollmentsBySource,
    enrollments: a.enrollments + b.enrollments,
  }
}

function emptyRow(course = ''): SummaryRow {
  return { course, university: null, gSpend: 0, fbSpend: 0, leadsBySource: {}, totalLeads: 0, enrollmentsBySource: {}, enrollments: 0 }
}

// ── Content component ────────────────────────────────────────────────────────

function GrandSummaryContent({ period, rows }: { period: Period; rows: SummaryRow[] }) {
  const periodLabel = PERIOD_LABELS[period]

  // Determine which lead source columns have any data
  const sourceTotals: Record<string, number> = {}
  for (const r of rows) {
    for (const [src, n] of Object.entries(r.leadsBySource)) {
      sourceTotals[src] = (sourceTotals[src] ?? 0) + n
    }
  }
  const activeSources = [
    ...ALL_SOURCES.filter((s) => (sourceTotals[s] ?? 0) > 0),
    ...Object.keys(sourceTotals).filter((s) => !ALL_SOURCES.includes(s) && sourceTotals[s] > 0),
  ]

  // Determine which enrollment source columns have any data
  const enrollTotals: Record<string, number> = {}
  for (const r of rows) {
    for (const [src, n] of Object.entries(r.enrollmentsBySource)) {
      enrollTotals[src] = (enrollTotals[src] ?? 0) + n
    }
  }
  const activeEnrollSources = [
    ...ALL_SOURCES.filter((s) => (enrollTotals[s] ?? 0) > 0),
    ...Object.keys(enrollTotals).filter((s) => !ALL_SOURCES.includes(s) && enrollTotals[s] > 0),
  ]

  const grandTotal = rows.reduce((acc, r) => addRows(acc, r), emptyRow())
  const grandTotalSpend = grandTotal.gSpend + grandTotal.fbSpend
  const gtMetrics = rowMetrics(grandTotal)

  const byProgram = new Map<string, SummaryRow[]>()
  for (const r of rows) {
    const list = byProgram.get(r.course) ?? []
    list.push(r)
    byProgram.set(r.course, list)
  }

  // Total colspan for "no data" cell
  const totalCols = 1 + 3 + activeSources.length + 1 + activeEnrollSources.length + 2 + 3 + 1

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
        {/* Stat cards */}
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

        {/* Main table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200">
            <span className="font-display text-[13px] font-bold text-slate-900">Summary by Program × Campus</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold sticky left-0 bg-slate-50 z-10" rowSpan={2}>Program / Campus</th>
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-blue-50 text-blue-600" colSpan={3}>Spend</th>
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-teal-50 text-teal-600" colSpan={activeSources.length + 1}>Leads by Source</th>
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-green-50 text-green-600" colSpan={activeEnrollSources.length + 2}>Conversions</th>
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-amber-50 text-amber-600" colSpan={3}>CPL</th>
                  <th className="text-center px-2 py-1 font-semibold border-l border-slate-200 bg-rose-50 text-rose-600" colSpan={1}>CAC</th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Google</th>
                  <th className="text-right px-3 py-2 font-semibold">Meta</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  {activeSources.map((src, i) => (
                    <th key={src} className={`text-right px-3 py-2 font-semibold whitespace-nowrap ${i === 0 ? 'border-l border-slate-200' : ''}`}>
                      {src}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold font-bold">Total</th>
                  {activeEnrollSources.map((src, i) => (
                    <th key={src} className={`text-right px-3 py-2 font-semibold whitespace-nowrap ${i === 0 ? 'border-l border-slate-200' : ''}`}>
                      {src}
                    </th>
                  ))}
                  <th className={`text-right px-3 py-2 font-semibold font-bold ${activeEnrollSources.length === 0 ? 'border-l border-slate-200' : ''}`}>Enrollments</th>
                  <th className="text-right px-3 py-2 font-semibold">L2E%</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Google</th>
                  <th className="text-right px-3 py-2 font-semibold">Meta</th>
                  <th className="text-right px-3 py-2 font-semibold">Blended</th>
                  <th className="text-right px-3 py-2 font-semibold border-l border-slate-200">Blended</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-slate-400">No data for this period</td></tr>
                )}
                {PROGRAMS.map((prog) => {
                  const progRows = (byProgram.get(prog) ?? []).sort((a, b) => (b.gSpend + b.fbSpend) - (a.gSpend + a.fbSpend))
                  if (!progRows.length) return null
                  const pt = progRows.reduce((acc, r) => addRows(acc, r), emptyRow(prog))
                  return <ProgramGroup key={prog} program={prog} totalRow={pt} campusRows={progRows} activeSources={activeSources} activeEnrollSources={activeEnrollSources} />
                })}
                {Array.from(byProgram.keys())
                  .filter((p) => !PROGRAMS.includes(p))
                  .map((prog) => {
                    const progRows = (byProgram.get(prog) ?? []).sort((a, b) => (b.gSpend + b.fbSpend) - (a.gSpend + a.fbSpend))
                    const pt = progRows.reduce((acc, r) => addRows(acc, r), emptyRow(prog))
                    return <ProgramGroup key={prog} program={prog} totalRow={pt} campusRows={progRows} activeSources={activeSources} activeEnrollSources={activeEnrollSources} />
                  })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <DataRow row={grandTotal} label="Grand Total" activeSources={activeSources} activeEnrollSources={activeEnrollSources} isTotal isGrandTotal />
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgramGroup({ program, totalRow, campusRows, activeSources, activeEnrollSources }: {
  program: string
  totalRow: SummaryRow
  campusRows: SummaryRow[]
  activeSources: string[]
  activeEnrollSources: string[]
}) {
  return (
    <>
      <DataRow row={totalRow} label={program} activeSources={activeSources} activeEnrollSources={activeEnrollSources} isTotal />
      {campusRows.filter((r) => r.university).map((r, i) => (
        <DataRow key={i} row={r} label={r.university!} activeSources={activeSources} activeEnrollSources={activeEnrollSources} indent />
      ))}
    </>
  )
}

function DataRow({ row, label, activeSources, activeEnrollSources, isTotal, isGrandTotal, indent }: {
  row: SummaryRow
  label: string
  activeSources: string[]
  activeEnrollSources: string[]
  isTotal?: boolean
  isGrandTotal?: boolean
  indent?: boolean
}) {
  const m = rowMetrics(row)
  const totalSpend = row.gSpend + row.fbSpend

  const rowCls = isGrandTotal
    ? 'bg-slate-100 font-bold text-slate-800 text-[12px] border-t-2 border-slate-300'
    : isTotal
    ? 'bg-slate-50 border-t border-slate-200 font-semibold text-slate-800 text-[12px]'
    : 'border-t border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors text-[11.5px]'

  const labelCls = indent
    ? 'px-4 py-2 pl-8 sticky left-0 bg-white'
    : isGrandTotal
    ? 'px-4 py-3 sticky left-0 bg-slate-100'
    : 'px-4 py-2.5 sticky left-0 bg-slate-50'

  const py = isGrandTotal ? 'py-3' : isTotal ? 'py-2.5' : 'py-2'

  return (
    <tr className={rowCls}>
      <td className={labelCls}>{label}</td>
      <td className={`px-3 ${py} text-right tabular-nums border-l border-slate-200 text-blue-700`}>{fmt$(row.gSpend)}</td>
      <td className={`px-3 ${py} text-right tabular-nums text-teal-700`}>{fmt$(row.fbSpend)}</td>
      <td className={`px-3 ${py} text-right tabular-nums`}>{fmt$(totalSpend)}</td>
      {activeSources.map((src, i) => (
        <td key={src} className={`px-3 ${py} text-right tabular-nums ${i === 0 ? 'border-l border-slate-200' : ''}`}>
          {fmtN(row.leadsBySource[src] ?? 0)}
        </td>
      ))}
      <td className={`px-3 ${py} text-right tabular-nums font-semibold`}>{fmtN(row.totalLeads)}</td>
      {activeEnrollSources.map((src, i) => (
        <td key={src} className={`px-3 ${py} text-right tabular-nums ${i === 0 ? 'border-l border-slate-200' : ''}`}>
          {fmtN(row.enrollmentsBySource[src] ?? 0)}
        </td>
      ))}
      <td className={`px-3 ${py} text-right tabular-nums font-semibold ${activeEnrollSources.length === 0 ? 'border-l border-slate-200' : ''}`}>{fmtN(row.enrollments)}</td>
      <td className={`px-3 ${py} text-right tabular-nums`}>{fmtPct(m.l2e)}</td>
      <td className={`px-3 ${py} text-right tabular-nums border-l border-slate-200 text-blue-700`}>{fmt$(m.gCpl)}</td>
      <td className={`px-3 ${py} text-right tabular-nums text-teal-700`}>{fmt$(m.fbCpl)}</td>
      <td className={`px-3 ${py} text-right tabular-nums`}>{fmt$(m.blendedCpl)}</td>
      <td className={`px-3 ${py} text-right tabular-nums border-l border-slate-200`}>{fmt$(m.blendedCac)}</td>
    </tr>
  )
}
