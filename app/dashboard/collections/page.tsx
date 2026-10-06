import StatCard from '@/components/ui/StatCard'
import MonthlyCollectionChart from './MonthlyCollectionChart'
import PaymentGrid from './PaymentGrid'
import MixBars from './MixBars'
import {
  AS_OF, MONTHLY, CLOSED_MONTHS, TOTAL_RECORDS, PAYMENT_MIX, STATUS_MIX,
  SAMPLE_STUDENTS, SAMPLE_EXCEPTIONS, type Flag,
} from './data'

const FLAG_STYLE: Record<Flag, string> = {
  review: 'bg-red-100 text-red-700',
  manual: 'bg-amber-100 text-amber-700',
  ok:     'bg-emerald-100 text-emerald-700',
}

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]'

function SampleBadge() {
  return (
    <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Sample rows</span>
  )
}

export default function CollectionsPage() {
  // ── Tiles (real aggregates from the master workbook) ─────────────
  const closed = MONTHLY.slice(0, CLOSED_MONTHS)
  const ytdExpected = closed.reduce((s, m) => s + m.expected, 0)
  const ytdCollected = closed.reduce((s, m) => s + m.collected, 0)
  const collectionRate = Math.round((ytdCollected / ytdExpected) * 100)
  const stillDue = MONTHLY.slice(CLOSED_MONTHS).reduce((s, m) => s + m.expected - m.collected, 0)
  const activeStudents = STATUS_MIX.find((s) => s.label === 'Active')?.value ?? 0
  const noPaymentType = PAYMENT_MIX.find((p) => p.label === 'Not set')?.value ?? 0
  const k = (v: number) => `$${(v / 1000).toFixed(1)}K`

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-4 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Collections</h1>
        <span className="text-[12px] text-slate-500 font-medium">2026 Cohort</span>
        <span className="text-[11px] text-slate-400 hidden sm:inline">Master workbook figures as of {AS_OF}</span>
        <div className="flex-1" />
        <span className="text-[9px] uppercase tracking-wide font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">Preview · not live</span>
      </header>

      <div className="p-6 space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Collected Jan–Jul" value={k(ytdCollected)} delta={`of ${k(ytdExpected)} expected`} accent="blue" />
          <StatCard label="Collection Rate" value={`${collectionRate}%`} delta="Jan–Jul, closed months" deltaDir={collectionRate >= 90 ? 'up' : 'down'} accent="green" />
          <StatCard label="Still Due Aug–Dec" value={k(stillDue)} delta="expected less collected" accent="amber" />
          <StatCard label="Active Students" value={activeStudents.toLocaleString()} delta={`of ${TOTAL_RECORDS.toLocaleString()} all-time`} accent="teal" />
          <StatCard label="No Payment Type" value={noPaymentType.toLocaleString()} delta={`${Math.round((noPaymentType / TOTAL_RECORDS) * 100)}% of records · fix first`} deltaDir="down" accent="amber" />
        </div>

        {/* Monthly chart */}
        <div className={`${CARD} p-5`}>
          <MonthlyCollectionChart data={MONTHLY} />
        </div>

        {/* Student payment grid */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-[13px] font-bold text-slate-900">Student Payment Grid</span>
            <SampleBadge />
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />Paid</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" />Due, not received</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-50 border border-slate-200" />Not due</span>
            </div>
          </div>
          <PaymentGrid students={SAMPLE_STUDENTS} />
          <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">
            Placeholder students for layout only. Real rows load from Supabase in Phase 2; once Stripe is connected, missed payments come from the actual decline reason.
          </div>
        </div>

        {/* Mix cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${CARD} p-5`}>
            <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Payment Type</div>
            <div className="text-[11px] text-slate-400 mb-4">All {TOTAL_RECORDS.toLocaleString()} records · blue = automatable, amber = manual, grey = not set</div>
            <MixBars items={PAYMENT_MIX} />
          </div>
          <div className={`${CARD} p-5`}>
            <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Student Status</div>
            <div className="text-[11px] text-slate-400 mb-4">All {TOTAL_RECORDS.toLocaleString()} records</div>
            <MixBars items={STATUS_MIX} />
          </div>
        </div>

        {/* Exception queue */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
            <span className="font-display text-[13px] font-bold text-slate-900">Exception Queue</span>
            <SampleBadge />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Student', 'Payment Type', 'Status', 'Last Payment', 'Flag'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_EXCEPTIONS.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.paymentType}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.status}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{r.lastPayment}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${FLAG_STYLE[r.flag]}`}>{r.reason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
