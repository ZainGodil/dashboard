import StatCard from '@/components/ui/StatCard'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { buildStripeView, type PaymentRow, type StripeView, type StudentStatus } from '@/lib/collections/stripe-view'
import MonthlyCollectionChart from './MonthlyCollectionChart'
import PaymentGrid from './PaymentGrid'
import MixBars from './MixBars'
import StripeSyncButton from './StripeSyncButton'
import StatusSelect from './StatusSelect'
import RecordPaymentForm from './RecordPaymentForm'
import DeleteManualPaymentButton from './DeleteManualPaymentButton'
import HandleFlagButton from './HandleFlagButton'
import ReopenFlagButton from './ReopenFlagButton'
import { applyActions, chicagoToday, type ExceptionAction, type OpenException, type HandledException } from '@/lib/collections/exception-actions'
import { buildPlansView, planLabel, type PlanDeal, type PlanPayment, type PlansView } from '@/lib/collections/plans'
import { paycoveConfig } from '@/lib/paycove/client'
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

interface ManualEntry {
  id: string
  student_name: string
  student_email: string | null
  payer: string
  amount: number
  paid_on: string
  month: string
  note: string | null
  created_by: string
}

interface CollectionsData {
  view: StripeView | null
  lastSync: string | null
  error: string | null // Stripe table missing or unreadable
  manualReady: boolean // manual_payments and student_status exist (migration 010)
  manual: ManualEntry[]
  actionsReady: boolean // exception_actions exists (migration 011)
  queue: { open: OpenException[]; handled: HandledException[] }
  paycove: {
    ready: boolean // paycove tables exist (migration 012)
    configured: boolean // PAYCOVE_CLIENT_ID and PAYCOVE_CLIENT_SECRET are set
    connected: { by: string; at: string } | null
    lastSync: string | null
    plans: PlansView | null
  }
}

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function loadCollections(): Promise<CollectionsData> {
  const supabase = createAdminClient()

  // Each source is read on its own so one missing table doesn't hide the others
  const stripe = fetchAllRows<PaymentRow>((from, to) =>
    supabase
      .from('stripe_payments')
      .select('status, amount, amount_refunded, created_at, month, customer_email, customer_name, failure_message')
      .gte('created_at', '2026-01-01T06:00:00Z')
      .order('created_at', { ascending: true })
      .range(from, to)
  ).then((rows) => ({ rows, error: null as string | null }), (err) => ({ rows: [] as PaymentRow[], error: errMessage(err) }))

  const manual = fetchAllRows<ManualEntry>((from, to) =>
    supabase
      .from('manual_payments')
      .select('id, student_name, student_email, payer, amount, paid_on, month, note, created_by')
      .is('deleted_at', null)
      .gte('paid_on', '2026-01-01')
      .order('paid_on', { ascending: false })
      .range(from, to)
  ).then((rows) => ({ rows, ok: true }), () => ({ rows: [] as ManualEntry[], ok: false }))

  const actions = fetchAllRows<ExceptionAction>((from, to) =>
    supabase
      .from('exception_actions')
      .select('id, student_key, flag_kind, flag_since, note, follow_up_on, created_by, created_at')
      .is('reopened_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)
  ).then((rows) => ({ rows, ok: true }), () => ({ rows: [] as ExceptionAction[], ok: false }))

  const plans = Promise.all([
    fetchAllRows<PlanDeal>((from, to) =>
      supabase.from('paycove_deals').select('id, name, status, student_name, student_email, total_amount, remaining_balance').order('id').range(from, to)
    ),
    fetchAllRows<PlanPayment>((from, to) =>
      supabase.from('paycove_payments').select('deal_id, number, due_on, amount, is_paid, payable').order('id').range(from, to)
    ),
  ]).then(([deals, payments]) => ({ deals, payments, ok: true }), () => ({ deals: [] as PlanDeal[], payments: [] as PlanPayment[], ok: false }))

  const [stripeRes, manualRes, statusRes, logRes, actionsRes, plansRes, tokenRes, paycoveLogRes] = await Promise.all([
    stripe,
    manual,
    supabase.from('student_status').select('student_key, status'),
    supabase.from('sync_log').select('completed_at').eq('source', 'stripe').eq('status', 'success').order('completed_at', { ascending: false }).limit(1),
    actions,
    plans,
    // Only whether Paycove is connected, and by whom; the token itself is never read here
    supabase.from('integration_tokens').select('connected_by, connected_at').eq('provider', 'paycove').maybeSingle(),
    supabase.from('sync_log').select('completed_at').eq('source', 'paycove').eq('status', 'success').order('completed_at', { ascending: false }).limit(1),
  ])

  const statusByKey = new Map<string, StudentStatus>(
    (statusRes.data ?? []).map((r: { student_key: string; status: StudentStatus }) => [r.student_key, r.status])
  )
  const rows: PaymentRow[] = [
    ...stripeRes.rows,
    ...manualRes.rows.map((m) => ({
      status: 'succeeded' as const,
      amount: Number(m.amount),
      amount_refunded: 0,
      created_at: `${m.paid_on}T18:00:00Z`, // midday in Chicago, so it lands on the date entered
      month: m.month,
      customer_email: m.student_email,
      customer_name: m.student_name,
      failure_message: null,
      source: m.payer,
    })),
  ]

  const view = rows.length ? buildStripeView(rows, new Date(), statusByKey) : null
  const today = chicagoToday()
  const planView = plansRes.ok && plansRes.deals.length
    ? buildPlansView(
        plansRes.deals.map((d) => ({ ...d, total_amount: d.total_amount === null ? null : Number(d.total_amount), remaining_balance: d.remaining_balance === null ? null : Number(d.remaining_balance) })),
        plansRes.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
        today,
        statusByKey,
      )
    : null

  // Plan flags join the payment flags; fill in the last successful payment from the payment data
  const lastPaid = new Map<string, string | null>((view?.students ?? []).map((s): [string, string | null] => [s.key, s.lastPaidAt]))
  const planExceptions = (planView?.exceptions ?? []).map((e) => ({ ...e, lastPaidAt: lastPaid.get(e.key) ?? null }))

  return {
    view,
    lastSync: logRes.data?.[0]?.completed_at ?? null,
    error: stripeRes.error,
    manualReady: manualRes.ok && !statusRes.error,
    manual: manualRes.rows,
    actionsReady: actionsRes.ok,
    queue: applyActions([...(view?.exceptions ?? []), ...planExceptions], actionsRes.rows, today),
    paycove: {
      ready: plansRes.ok && !tokenRes.error,
      configured: paycoveConfig() !== null,
      connected: tokenRes.data ? { by: tokenRes.data.connected_by, at: tokenRes.data.connected_at } : null,
      lastSync: paycoveLogRes.data?.[0]?.completed_at ?? null,
      plans: planView,
    },
  }
}

const PAYCOVE_MESSAGES: Record<string, { tone: 'good' | 'bad'; text: string }> = {
  connected: { tone: 'good', text: 'Paycove is connected. Click Sync Paycove to load the payment plans.' },
  denied: { tone: 'bad', text: 'Paycove access was not approved, so nothing was connected.' },
  invalid: { tone: 'bad', text: 'The Paycove approval could not be verified. Please click Connect Paycove again.' },
  failed: { tone: 'bad', text: 'Paycove approved access, but the connection could not be saved. Check that the Paycove client ID and secret in Vercel are correct, then try again.' },
  'not-configured': { tone: 'bad', text: 'Paycove is not set up yet: add PAYCOVE_CLIENT_ID and PAYCOVE_CLIENT_SECRET in Vercel, then redeploy.' },
}

export default async function CollectionsPage({ searchParams }: { searchParams?: { paycove?: string } }) {
  const { view, lastSync, error, manualReady, manual, actionsReady, queue, paycove } = await loadCollections()
  const paycoveMessage = searchParams?.paycove ? PAYCOVE_MESSAGES[searchParams.paycove] : undefined

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
        {paycove.ready && paycove.configured && !paycove.connected && (
          <a href="/api/paycove/connect" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            Connect Paycove
          </a>
        )}
        {paycove.ready && paycove.connected && (
          <>
            {paycove.lastSync && <span className="text-[11px] text-slate-400 hidden md:inline">Paycove {relativeTime(paycove.lastSync)}</span>}
            <StripeSyncButton source="paycove" label="Sync Paycove" unit="plans" />
          </>
        )}
        {!error && <StripeSyncButton />}
      </header>

      <div className="p-6 space-y-4">
        {paycoveMessage && (
          <div className={`rounded-xl border px-4 py-2.5 text-[11px] ${paycoveMessage.tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {paycoveMessage.text}
          </div>
        )}
        {manualReady && (
          <div className={`${CARD} px-5 py-4`}>
            <RecordPaymentForm students={(view?.students ?? []).map((s) => ({ name: s.name, email: s.email }))} />
          </div>
        )}

        {view ? <LiveView view={view} manualReady={manualReady} actionsReady={actionsReady} queue={queue} plans={paycove.plans} /> : <SnapshotView stripeError={error} />}

        {manualReady && manual.length > 0 && <RecordedPayments entries={manual} />}

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

function LiveView({ view, manualReady, actionsReady, queue, plans }: {
  view: StripeView
  manualReady: boolean
  actionsReady: boolean
  queue: { open: OpenException[]; handled: HandledException[] }
  plans: PlansView | null
}) {
  // Students with a Paycove plan but no payment yet still get a grid row
  const inGrid = new Set(view.students.map((s) => s.key))
  const planOnly = (plans?.students ?? []).filter((p) => !inGrid.has(p.key))
  const emptyMonths = view.students[0]?.cells.map(() => ({ state: 'none' as const })) ?? Array.from({ length: 12 }, () => ({ state: 'none' as const }))

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label={`Collected ${view.year}`}
          value={k(view.collectedYtd)}
          delta={view.collectedOtherYtd > 0 ? `incl. ${k(view.collectedOtherYtd)} recorded by hand` : 'Stripe, net of refunds'}
          accent="blue"
        />
        <StatCard label={`Collected ${view.thisMonthLabel}`} value={k(view.collectedThisMonth)} delta="this month so far" accent="green" />
        <StatCard label="Failed, Last 30 Days" value={String(view.failedLast30.count)} delta={`${money(view.failedLast30.amount)} declined`} deltaDir={view.failedLast30.count ? 'down' : 'neutral'} accent="amber" />
        <StatCard label="Paying Students" value={String(view.payingStudents)} delta="paid in the last 60 days" accent="teal" />
        <StatCard
          label="Needs Follow-Up"
          value={String(queue.open.length)}
          delta={queue.handled.length ? `${queue.handled.length} handled` : 'see exception queue'}
          deltaDir={queue.open.length ? 'down' : 'neutral'}
          accent="amber"
        />
      </div>

      {plans && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Still Owed on Plans" value={k(plans.remainingTotal)} delta={`${plans.activePlans} open plan${plans.activePlans === 1 ? '' : 's'} in Paycove`} accent="blue" />
          <StatCard label="Installments Overdue" value={String(plans.overdueCount)} delta={`${money(plans.overdueAmount)} past due`} deltaDir={plans.overdueCount ? 'down' : 'neutral'} accent="amber" />
          <StatCard label="Due Next 30 Days" value={k(plans.dueNext30)} delta="unpaid installments coming up" accent="teal" />
          <StatCard label="Students on Plans" value={String(plans.students.length)} delta={`${plans.students.filter((s) => s.remaining > 0).length} with payments remaining`} accent="green" />
        </div>
      )}

      <div className={`${CARD} p-5`}>
        <MonthlyCollectionChart
          title={`Monthly Collection ${view.year}`}
          subtitle="Stripe card and bank payments, plus WFD, lender and other payments recorded on this page."
          data={view.monthly}
          series={[
            { key: 'stripe', name: 'Collected via Stripe', color: '#2563EB', stackId: 'collected' },
            { key: 'other', name: 'Recorded by hand', color: '#0891B2', stackId: 'collected' },
            { key: 'failed', name: 'Failed', color: '#F87171' },
          ]}
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <span className="font-display text-[13px] font-bold text-slate-900">Exception Queue</span>
          <Badge tone={queue.open.length ? 'amber' : 'emerald'}>{queue.open.length} to review</Badge>
        </div>
        {queue.open.length === 0 ? (
          <div className="px-5 py-6 text-[12px] text-slate-400">
            Nothing to follow up{queue.handled.length ? `; ${queue.handled.length} handled below` : ': no failed last payments and no paying student quiet for 45+ days'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Student', 'Email', 'Status', 'Last Successful Payment', 'Flag', ...(actionsReady ? [''] : [])].map((h, i) => <th key={h || i} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {queue.open.map((r) => (
                  <tr key={`${r.key}:${r.kind}`} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.email}</td>
                    <td className="px-4 py-1.5">{manualReady ? <StatusSelect studentKey={r.key} status={r.status} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{shortDate(r.lastPaidAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${FLAG_STYLE[r.flag]}`}>{r.reason}</span>
                      {r.followUpDue && (
                        <div className="mt-1.5 text-[10px] text-amber-700">
                          Follow-up due {shortDate(`${r.followUpDue.follow_up_on}T18:00:00Z`)}: {r.followUpDue.note}
                          <span className="text-slate-400"> · {r.followUpDue.created_by}</span>
                        </div>
                      )}
                    </td>
                    {actionsReady && (
                      <td className="px-4 py-2 text-right">
                        <HandleFlagButton studentKey={r.key} studentName={r.name} kind={r.kind} since={r.since} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">
          Flags: the student&apos;s latest Stripe charge failed, or they paid within the last 120 days but nothing in the last 45 (not raised for students marked Graduated).
          {plans && ' From Paycove: a plan installment is past its due date and unpaid, or a student marked Dropped still owes on their plan.'}
          {actionsReady && ' A handled flag comes back on its follow-up date, or when a newer payment fails.'}
        </div>
      </div>

      {actionsReady && queue.handled.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
            <span className="font-display text-[13px] font-bold text-slate-900">Handled</span>
            <Badge tone="emerald">{queue.handled.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Student', 'Flag', 'Note', 'Follow Up', 'Handled By', ''].map((h, i) => <th key={h || i} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {queue.handled.map((r) => (
                  <tr key={r.action.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {r.name}
                      {r.email && <span className="block text-[10px] font-normal text-slate-400">{r.email}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.reason}</td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-[360px]">{r.action.note}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">{r.action.follow_up_on ? shortDate(`${r.action.follow_up_on}T18:00:00Z`) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {r.action.created_by}
                      <span className="block text-[10px]">{shortDate(r.action.created_at)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right"><ReopenFlagButton id={r.action.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[13px] font-bold text-slate-900">Student Payment Grid</span>
          <Badge tone="slate">{view.students.length + planOnly.length} students</Badge>
          <div className="flex-1" />
          <GridLegend missedLabel="Failed (hover for reason)" noneLabel="No charge" />
        </div>
        <PaymentGrid
          metaColumns={plans ? ['Email', 'Status', 'Paid Via', 'Plan'] : ['Email', 'Status', 'Paid Via']}
          rows={[
            ...view.students.map((s) => ({
              key: s.key,
              name: s.name,
              meta: [
                s.email,
                manualReady ? <StatusSelect key="status" studentKey={s.key} status={s.status} /> : '—',
                s.sources.join(', '),
                ...(plans ? [planLabel(plans.byKey.get(s.key))] : []),
              ],
              cells: s.cells,
            })),
            ...planOnly.map((p) => ({
              key: p.key,
              name: p.name,
              meta: [
                p.email,
                manualReady ? <StatusSelect key="status" studentKey={p.key} status={p.status} /> : '—',
                'No payment yet',
                planLabel(p),
              ],
              cells: emptyMonths,
            })),
          ]}
          totalLabel={`${view.year} Total`}
        />
        <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">
          One row per student email (or name, when no email was given); students flagged for follow-up are listed first. A month is red only when every charge that month failed.
          {plans && ' Plan shows installments paid out of the total in Paycove, what is still owed, and the next due date.'}
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

// ── Payments recorded by hand ────────────────────────────────────────────────

function RecordedPayments({ entries }: { entries: ManualEntry[] }) {
  const shown = entries.slice(0, 25)
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
        <span className="font-display text-[13px] font-bold text-slate-900">Recorded Payments</span>
        <Badge tone="slate">{entries.length} this year</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Date', 'Student', 'Paid By', 'Amount', 'Note', 'Added By', ''].map((h, i) => <th key={h || i} className={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">{shortDate(`${m.paid_on}T18:00:00Z`)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {m.student_name}
                  {m.student_email && <span className="block text-[10px] font-normal text-slate-400">{m.student_email}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{m.payer}</td>
                <td className="px-4 py-2.5 font-mono text-slate-900">{money(Number(m.amount))}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.note}</td>
                <td className="px-4 py-2.5 text-slate-400">{m.created_by}</td>
                <td className="px-4 py-2.5 text-right">
                  <DeleteManualPaymentButton id={m.id} label={`${money(Number(m.amount))} from ${m.payer} for ${m.student_name}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length > shown.length && (
        <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">Showing the latest {shown.length} of {entries.length}.</div>
      )}
    </div>
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
