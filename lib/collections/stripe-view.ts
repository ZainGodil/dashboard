// Builds the Collections report from Stripe charges (stripe_payments rows). Pure, so it can be unit tested.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export interface PaymentRow {
  status: 'succeeded' | 'pending' | 'failed'
  amount: number
  amount_refunded: number
  created_at: string
  month: string
  customer_email: string | null
  customer_name: string | null
  failure_message: string | null
}

export type Cell = { state: 'paid'; amount: number } | { state: 'missed'; reason?: string } | { state: 'none' }

export interface StudentRow {
  key: string
  name: string
  email: string
  cells: Cell[] // Jan–Dec
  total: number
  lastPaidAt: string | null
  lastAttempt: { status: PaymentRow['status']; at: string; failureMessage: string | null } | null
}

export interface ExceptionRow {
  name: string
  email: string
  lastPaidAt: string | null
  flag: 'review'
  reason: string
}

export interface StripeView {
  year: number
  monthly: { month: string; collected: number; failed: number }[]
  collectedYtd: number
  collectedThisMonth: number
  thisMonthLabel: string
  failedLast30: { count: number; amount: number }
  payingStudents: number
  students: StudentRow[]
  exceptions: ExceptionRow[]
}

const DAY = 24 * 60 * 60 * 1000
const NO_PAYMENT_DAYS = 45
const RECENT_PAYER_DAYS = 120

const net = (r: PaymentRow) => Number(r.amount) - Number(r.amount_refunded)

function chicagoYearMonth(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric' }).formatToParts(d)
  return { year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value) }
}

export function buildStripeView(rows: PaymentRow[], now: Date): StripeView {
  const { year, month: currentMonth } = chicagoYearMonth(now)
  const yy = String(year).slice(2)
  const labels = MONTHS.map((m) => `${m}-${yy}`)
  const inYear = rows.filter((r) => labels.includes(r.month))

  const monthly = MONTHS.map((m, i) => {
    const rs = inYear.filter((r) => r.month === labels[i])
    return {
      month: m,
      collected: rs.filter((r) => r.status === 'succeeded').reduce((s, r) => s + net(r), 0),
      failed: rs.filter((r) => r.status === 'failed').reduce((s, r) => s + Number(r.amount), 0),
    }
  })

  const nowMs = now.getTime()
  const failed30 = rows.filter((r) => r.status === 'failed' && nowMs - Date.parse(r.created_at) <= 30 * DAY)
  const paying = new Set(
    rows.filter((r) => r.status === 'succeeded' && nowMs - Date.parse(r.created_at) <= 60 * DAY).map((r) => keyOf(r))
  )

  // ── Per student (keyed by email, falling back to name) ──
  const byStudent = new Map<string, PaymentRow[]>()
  for (const r of rows) {
    const k = keyOf(r)
    if (!byStudent.has(k)) byStudent.set(k, [])
    byStudent.get(k)!.push(r)
  }

  const students: StudentRow[] = []
  const exceptions: ExceptionRow[] = []
  for (const [k, rs] of Array.from(byStudent.entries())) {
    const sorted = [...rs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    const named = sorted.find((r) => r.customer_name)
    const name = named?.customer_name ?? sorted[0].customer_email ?? 'Unknown customer'
    const email = sorted.find((r) => r.customer_email)?.customer_email ?? ''

    const cells: Cell[] = labels.map((label) => {
      const ms = rs.filter((r) => r.month === label)
      const paid = ms.filter((r) => r.status === 'succeeded').reduce((s, r) => s + net(r), 0)
      if (paid > 0) return { state: 'paid', amount: paid }
      const fail = ms.filter((r) => r.status === 'failed').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
      if (fail) return { state: 'missed', reason: fail.failure_message ?? undefined }
      return { state: 'none' }
    })

    const lastPaid = sorted.find((r) => r.status === 'succeeded')
    const last = sorted.find((r) => r.status !== 'pending') ?? sorted[0]
    const total = cells.reduce((s, c) => s + (c.state === 'paid' ? c.amount : 0), 0)
    const row: StudentRow = {
      key: k,
      name,
      email,
      cells,
      total,
      lastPaidAt: lastPaid?.created_at ?? null,
      lastAttempt: last ? { status: last.status, at: last.created_at, failureMessage: last.failure_message } : null,
    }

    if (cells.some((c) => c.state !== 'none')) students.push(row)

    if (last?.status === 'failed') {
      exceptions.push({ name, email, lastPaidAt: row.lastPaidAt, flag: 'review', reason: `Last payment failed${last.failure_message ? `: ${last.failure_message}` : ''}` })
    } else if (lastPaid) {
      const sincePaid = nowMs - Date.parse(lastPaid.created_at)
      if (sincePaid > NO_PAYMENT_DAYS * DAY && sincePaid <= RECENT_PAYER_DAYS * DAY) {
        exceptions.push({ name, email, lastPaidAt: row.lastPaidAt, flag: 'review', reason: `No payment in ${Math.floor(sincePaid / DAY)} days` })
      }
    }
  }

  const flagged = new Set(exceptions.map((e) => e.email || e.name))
  students.sort((a, b) => {
    const fa = flagged.has(a.email || a.name) ? 0 : 1
    const fb = flagged.has(b.email || b.name) ? 0 : 1
    return fa - fb || a.name.localeCompare(b.name)
  })
  exceptions.sort((a, b) => Date.parse(b.lastPaidAt ?? '1970-01-01') - Date.parse(a.lastPaidAt ?? '1970-01-01'))

  return {
    year,
    monthly,
    collectedYtd: monthly.reduce((s, m) => s + m.collected, 0),
    collectedThisMonth: monthly[currentMonth - 1].collected,
    thisMonthLabel: MONTHS[currentMonth - 1],
    failedLast30: { count: failed30.length, amount: failed30.reduce((s, r) => s + Number(r.amount), 0) },
    payingStudents: paying.size,
    students,
    exceptions,
  }
}

function keyOf(r: PaymentRow): string {
  return r.customer_email ?? `name:${r.customer_name ?? 'unknown'}`
}
