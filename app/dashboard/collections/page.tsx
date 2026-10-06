import StatCard from '@/components/ui/StatCard'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { buildStripeView, type PaymentRow, type StripeView } from '@/lib/collections/stripe-view'
import MonthlyCollectionChart from './MonthlyCollectionChart'
import PaymentGrid from './PaymentGrid'
import MixBars from './MixBars'
import StripeSyncButton from './StripeSyncButton'
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
const TH = 'px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold'

const k = (v: number) => `$${(v / 1000).toFixed(1)}K`
const money = (v: number) => `$${Math.round(v).toLocaleString()}`
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }) : '—'

function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'slate' | 'emerald' }) {
  const tones = { amber: 'bg-amber-100 text-amber-700', slate: 'bg-slate-100 text-slate-500', emerald: 'bg-emerald-100 text-emerald-700' }
  return <span className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

async function loadStripe(): Promise<{ view: StripeView | null; lastSync: string | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const [rows, { data: log }] = await Promise.all([
      fetchAllRows<PaymentRow>((from, to) =>
        supabase
          .from('stripe_payments')
          .select('status, amount, amount_refunded, created_at, month, customer_email, customer_name, failure_message')
          .gte('created_at', '2026-01-01T06:00:00Z')
          .order('created_at', { ascending: true })
          .range(from, to)
      ),
      supabase.from('sync_log').select('completed_at').eq('source', 'stripe').eq('status', 'success').order('completed_at', { ascending: false }).limit(1),
    ])
    return { view: rows.length ? buildStripeView(rows, new Date()) : null, lastSync: log?.[0]?.completed_at ?? null, error: null }
  } catch (err) {
    // Table not created yet, or Supabase unavailable: fall back to the workbook snapshot
    return { view: null, lastSync: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export default async function CollectionsPage() {
  const { view, lastSync, error } = await loadStripe()

  return (
    <div>
      {/* Top bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-4 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Collections</h1>
        <span className="text-[12px] text-slate-500 font-medium">{view ? `${view.year} · Stripe` : '2026 Cohort'}</span>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          {view ? (lastSync ? `Last Stripe sync ${relativeTime(lastSync)}` : 'Stripe data') : `Master workbook figures as of ${AS_OF}`}
        </span>
        <div className="flex-1" />
        {!error && <StripeSyncButton />}
      </header>

      <div className="p-6 space-y-4">
        {view ? <LiveView view={view} /> : <SnapshotView stripeError={error} />}

        {/* Workbook snapshot: Stripe has no payment type or student status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${CARD} p-5`}>
            <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Payment Type</div>
            <div className="text-[11px] text-slate-400 mb-4">Master workbook, {AS_OF} · all {TOTAL_RECORDS.toLocaleString()} records · blue = automatable, amber = manual, grey = not set</div>
            <MixBars items={PAYMENT_MIX} />
          </div>
          <div className={`${CARD} p-5`}>
            <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Student Status</div>
            <div className="text-[11px] text-slate-400 mb-4">Master workbook, {AS_OF} · all {TOTAL_RECORDS.toLocaleString()} records</div>
            <MixBars items={STATUS_MIX} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Live: Stripe charges ─────────────────────────────────────────────────────

function LiveView({ view }: { view: StripeView }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label={`Collected ${view.year}`} value={k(view.collectedYtd)} delta="Stripe, net of refunds" accent="blue" />
        <StatCard label={`Collected ${view.thisMonthLabel}`} value={k(view.collectedThisMonth)} delta="this month so far" accent="green" />
        <StatCard label="Failed, Last 30 Days" value={String(view.failedLast30.count)} delta={`${money(view.failedLast30.amount)} declined`} deltaDir={view.failedLast30.count ? 'down' : 'neutral'} accent="amber" />
        <StatCard label="Paying Students" value={String(view.payingStudents)} delta="paid in the last 60 days" accent="teal" />
        <StatCard label="Needs Follow-Up" value={String(view.exceptions.length)} delta="see exception queue" deltaDir={view.exceptions.length ? 'down' : 'neutral'} accent="amber" />
      </div>

      <div className={`${CARD} p-5`}>
        <MonthlyCollectionChart
          title={`Monthly Collection ${view.year}`}
          subtitle="Stripe card and bank payments. WFD, Sallie Mae and other lender payments are not in Stripe."
          data={view.monthly}
          series={[
            { key: 'collected', name: 'Collected', color: '#2563EB' },
            { key: 'failed', name: 'Failed', color: '#F87171' },
          ]}
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <span className="font-display text-[13px] font-bold text-slate-900">Exception Queue</span>
          <Badge tone={view.exceptions.length ? 'amber' : 'emerald'}>{view.exceptions.length} to review</Badge>
        </div>
        {view.exceptions.length === 0 ? (
          <div className="px-5 py-6 text-[12px] text-slate-400">Nothing to follow up: no failed last payments and no paying student quiet for 45+ days.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Student', 'Email', 'Last Successful Payment', 'Flag'].map((h) => <th key={h} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {view.exceptions.map((r) => (
                  <tr key={r.email || r.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.email}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{shortDate(r.lastPaidAt)}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${FLAG_STYLE[r.flag]}`}>{r.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">
          Flags: the student&apos;s latest Stripe charge failed, or they paid within the last 120 days but nothing in the last 45.
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[13px] font-bold text-slate-900">Student Payment Grid</span>
          <Badge tone="slate">{view.students.length} students</Badge>
          <div className="flex-1" />
          <GridLegend missedLabel="Failed (hover for reason)" noneLabel="No charge" />
        </div>
        <PaymentGrid
          metaColumns={['Email']}
          rows={view.students.map((s) => ({ key: s.key, name: s.name, meta: [s.email], cells: s.cells }))}
          totalLabel={`${view.year} Total`}
        />
        <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">
          One row per Stripe customer email; students flagged for follow-up are listed first. A month is red only when every charge that month failed.
        </div>
      </div>
    </>
  )
}

// ── Fallback: workbook snapshot + sample rows (before Stripe is connected) ──

function SnapshotView({ stripeError }: { stripeError: string | null }) {
  const closed = MONTHLY.slice(0, CLOSED_MONTHS)
  const ytdExpected = closed.reduce((s, m) => s + m.expected, 0)
  const ytdCollected = closed.reduce((s, m) => s + m.collected, 0)
  const collectionRate = Math.round((ytdCollected / ytdExpected) * 100)
  const stillDue = MONTHLY.slice(CLOSED_MONTHS).reduce((s, m) => s + m.expected - m.collected, 0)
  const activeStudents = STATUS_MIX.find((s) => s.label === 'Active')?.value ?? 0
  const noPaymentType = PAYMENT_MIX.find((p) => p.label === 'Not set')?.value ?? 0

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800">
        {stripeError
          ? 'Stripe data is not set up yet, so this shows the August workbook snapshot with sample student rows.'
          : 'No Stripe payments synced yet. Click Sync Stripe to load them; until then this shows the August workbook snapshot with sample student rows.'}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Collected Jan–Jul" value={k(ytdCollected)} delta={`of ${k(ytdExpected)} expected`} accent="blue" />
        <StatCard label="Collection Rate" value={`${collectionRate}%`} delta="Jan–Jul, closed months" deltaDir={collectionRate >= 90 ? 'up' : 'down'} accent="green" />
        <StatCard label="Still Due Aug–Dec" value={k(stillDue)} delta="expected less collected" accent="amber" />
        <StatCard label="Active Students" value={activeStudents.toLocaleString()} delta={`of ${TOTAL_RECORDS.toLocaleString()} all-time`} accent="teal" />
        <StatCard label="No Payment Type" value={noPaymentType.toLocaleString()} delta={`${Math.round((noPaymentType / TOTAL_RECORDS) * 100)}% of records · fix first`} deltaDir="down" accent="amber" />
      </div>

      <div className={`${CARD} p-5`}>
        <MonthlyCollectionChart
          title="Monthly Collection 2026"
          subtitle="Expected (Total Collection) vs Collected (Cash Received) · Aug is part-month, Sep–Dec not yet due"
          data={MONTHLY}
          series={[
            { key: 'expected', name: 'Expected', color: '#CBD5E1' },
            { key: 'collected', name: 'Collected', color: '#2563EB' },
          ]}
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[13px] font-bold text-slate-900">Student Payment Grid</span>
          <Badge tone="amber">Sample rows</Badge>
          <div className="flex-1" />
          <GridLegend missedLabel="Due, not received" noneLabel="Not due" />
        </div>
        <PaymentGrid
          metaColumns={['Program', 'Type', 'Status']}
          rows={SAMPLE_STUDENTS.map((s) => ({ key: s.name, name: s.name, meta: [s.program, s.paymentType, s.status], cells: s.cells }))}
          totalLabel="2026 Total"
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <span className="font-display text-[13px] font-bold text-slate-900">Exception Queue</span>
          <Badge tone="amber">Sample rows</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Student', 'Payment Type', 'Status', 'Last Payment', 'Flag'].map((h) => <th key={h} className={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_EXCEPTIONS.map((r) => (
                <tr key={r.name} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.paymentType}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.status}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{r.lastPayment}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${FLAG_STYLE[r.flag]}`}>{r.reason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function GridLegend({ missedLabel, noneLabel }: { missedLabel: string; noneLabel: string }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-500">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />Paid</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" />{missedLabel}</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-50 border border-slate-200" />{noneLabel}</span>
    </div>
  )
}
