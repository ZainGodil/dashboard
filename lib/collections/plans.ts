// Payment-plan figures from Paycove deals and their installments. Pure, so it can be unit tested.
import { studentKey, type ExceptionRow, type StudentStatus } from './stripe-view'

export interface PlanDeal {
  id: number
  name: string | null
  status: string | null
  student_name: string | null
  student_email: string | null
  total_amount: number | null
  remaining_balance: number | null
}

export interface PlanPayment {
  deal_id: number
  number: number | null
  due_on: string | null // YYYY-MM-DD
  amount: number
  is_paid: boolean
  payable: boolean
}

export interface StudentPlan {
  key: string
  name: string
  email: string
  status: StudentStatus | null
  plans: number
  installments: number
  paid: number
  remaining: number
  remainingAmount: number
  overdue: number
  overdueAmount: number
  oldestOverdue: string | null
  nextDue: { on: string; amount: number } | null
}

export interface PlansView {
  students: StudentPlan[]
  byKey: Map<string, StudentPlan>
  remainingTotal: number
  activePlans: number
  overdueCount: number
  overdueAmount: number
  dueNext30: number
  exceptions: ExceptionRow[]
}

const DAY = 24 * 60 * 60 * 1000
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${d}, ${y}`
}
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

// `today` is YYYY-MM-DD in America/Chicago. An installment is overdue when its due date has passed and it isn't paid.
export function buildPlansView(
  deals: PlanDeal[],
  payments: PlanPayment[],
  today: string,
  statusByKey: Map<string, StudentStatus> = new Map(),
): PlansView {
  const byDeal = new Map<number, PlanPayment[]>()
  for (const p of payments) {
    if (!p.payable) continue
    if (!byDeal.has(p.deal_id)) byDeal.set(p.deal_id, [])
    byDeal.get(p.deal_id)!.push(p)
  }

  const in30 = addDays(today, 30)
  const byStudent = new Map<string, StudentPlan>()
  let activePlans = 0
  let dueNext30 = 0

  for (const d of deals) {
    const ps = byDeal.get(d.id) ?? []
    const unpaid = ps.filter((p) => !p.is_paid)
    const overdue = unpaid.filter((p) => p.due_on && p.due_on < today)
    const upcoming = unpaid.filter((p) => p.due_on && p.due_on >= today).sort((a, b) => a.due_on!.localeCompare(b.due_on!))
    const remainingAmount = d.remaining_balance ?? unpaid.reduce((s, p) => s + p.amount, 0)
    if (unpaid.length > 0 || remainingAmount > 0) activePlans++
    dueNext30 += upcoming.filter((p) => p.due_on! <= in30).reduce((s, p) => s + p.amount, 0)

    const key = studentKey(d.student_email, d.student_name ?? d.name)
    const s = byStudent.get(key) ?? {
      key,
      name: d.student_name ?? d.name ?? 'Unknown student',
      email: d.student_email ?? '',
      status: statusByKey.get(key) ?? null,
      plans: 0, installments: 0, paid: 0, remaining: 0, remainingAmount: 0, overdue: 0, overdueAmount: 0,
      oldestOverdue: null as string | null,
      nextDue: null as { on: string; amount: number } | null,
    }
    s.plans += 1
    s.installments += ps.length
    s.paid += ps.length - unpaid.length
    s.remaining += unpaid.length
    s.remainingAmount += remainingAmount
    s.overdue += overdue.length
    s.overdueAmount += overdue.reduce((sum, p) => sum + p.amount, 0)
    for (const p of overdue) if (!s.oldestOverdue || p.due_on! < s.oldestOverdue) s.oldestOverdue = p.due_on
    const next = upcoming[0]
    if (next && (!s.nextDue || next.due_on! < s.nextDue.on)) s.nextDue = { on: next.due_on!, amount: next.amount }
    byStudent.set(key, s)
  }

  const students = Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name))
  const exceptions: ExceptionRow[] = []
  for (const s of students) {
    const status = s.status
    const base = { key: s.key, name: s.name, email: s.email, status, lastPaidAt: null, flag: 'review' as const, kind: 'overdue' as const }
    if (status === 'Dropped' && s.remainingAmount > 0) {
      // "since" pins the flag to the oldest unpaid installment, so a handled note stays until the plan changes
      exceptions.push({ ...base, since: `${s.oldestOverdue ?? s.nextDue?.on ?? '1970-01-01'}T12:00:00Z`, reason: `Dropped with ${money(s.remainingAmount)} still owed on the plan` })
    } else if (s.overdue > 0 && status !== 'Graduated') {
      exceptions.push({
        ...base,
        since: `${s.oldestOverdue}T12:00:00Z`,
        reason: `${s.overdue} installment${s.overdue === 1 ? '' : 's'} overdue, ${money(s.overdueAmount)} (oldest due ${shortDate(s.oldestOverdue!)})`,
      })
    }
  }

  return {
    students,
    byKey: byStudent,
    remainingTotal: students.reduce((sum, s) => sum + s.remainingAmount, 0),
    activePlans,
    overdueCount: students.reduce((sum, s) => sum + s.overdue, 0),
    overdueAmount: students.reduce((sum, s) => sum + s.overdueAmount, 0),
    dueNext30,
    exceptions,
  }
}

// Short line for the grid's Plan column, e.g. "8 of 12 paid · $1,818 left · next Nov 15"
export function planLabel(s: StudentPlan | undefined): string {
  if (!s) return '—'
  const parts = [`${s.paid} of ${s.installments} paid`]
  if (s.remainingAmount > 0) parts.push(`${money(s.remainingAmount)} left`)
  if (s.overdue > 0) parts.push(`${s.overdue} overdue`)
  else if (s.nextDue) parts.push(`next ${shortDate(s.nextDue.on).replace(/, \d{4}$/, '')}`)
  return parts.join(' · ')
}
