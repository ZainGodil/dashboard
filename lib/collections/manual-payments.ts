// Shared by the Record payment form and its API route. Keep PAYERS in step with the
// manual_payments.payer check constraint (migration 010).
export const PAYERS = [
  'WFD',
  'Sallie Mae',
  'Climb Credit',
  'Meritize',
  'Credee',
  'Vocational Rehabilitation Services',
  'Direct',
  'Bank transfer',
  'Other',
] as const
export type Payer = (typeof PAYERS)[number]

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export interface ManualPaymentInput {
  student_name: string
  student_email: string | null
  payer: Payer
  amount: number
  paid_on: string // YYYY-MM-DD
  month: string // 'Jan-26'
  note: string | null
}

// Returns the cleaned record, or an error message for the person filling in the form
export function parseManualPayment(body: unknown, today: Date): ManualPaymentInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const name = typeof b.student_name === 'string' ? b.student_name.trim() : ''
  const email = typeof b.student_email === 'string' ? b.student_email.trim().toLowerCase() : ''
  const payer = b.payer
  const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount)
  const paidOn = typeof b.paid_on === 'string' ? b.paid_on.trim() : ''
  const note = typeof b.note === 'string' ? b.note.trim() : ''

  if (!name) return { error: 'Student name is required.' }
  if (name.length > 200) return { error: 'Student name is too long.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address doesn’t look right.' }
  if (!PAYERS.includes(payer as Payer)) return { error: 'Pick who paid from the list.' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be more than $0.' }
  if (amount >= 1_000_000) return { error: 'Amount is too large.' }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidOn)
  const parsed = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
  if (!m || !parsed || parsed.getUTCMonth() !== Number(m[2]) - 1 || parsed.getUTCDate() !== Number(m[3])) {
    return { error: 'Payment date is not a valid date.' }
  }
  if (parsed.getTime() > today.getTime() + 24 * 60 * 60 * 1000) return { error: 'Payment date can’t be in the future.' }
  if (Number(m[1]) < 2020) return { error: 'Payment date is too far in the past.' }
  if (note.length > 500) return { error: 'Note is too long (500 characters max).' }

  return {
    student_name: name,
    student_email: email || null,
    payer: payer as Payer,
    amount: Math.round(amount * 100) / 100,
    paid_on: paidOn,
    month: `${MONTH_SHORT[Number(m[2]) - 1]}-${m[1].slice(2)}`,
    note: note || null,
  }
}
