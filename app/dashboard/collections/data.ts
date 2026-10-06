// Static figures for the Collections preview (Phase 0).
// Monthly totals, payment-method counts and status counts are real aggregates from the
// Workforce Institute master workbook, as of mid-August 2026. Student rows are SAMPLES —
// no real names or amounts. Real student data arrives in Phase 2 via Supabase.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const AS_OF = 'Aug 2026'

// Total Collection (expected) vs Cash Received (collected), 2026
export const MONTHLY = [
  { month: 'Jan', expected: 65495.70, collected: 56968.17 },
  { month: 'Feb', expected: 62053.75, collected: 52233.86 },
  { month: 'Mar', expected: 47036.22, collected: 35050.52 },
  { month: 'Apr', expected: 51969.32, collected: 40716.61 },
  { month: 'May', expected: 68950.53, collected: 56078.53 },
  { month: 'Jun', expected: 47603.78, collected: 32648.71 },
  { month: 'Jul', expected: 59766.23, collected: 42990.75 },
  { month: 'Aug', expected: 36983.86, collected: 9382.77 },
  { month: 'Sep', expected: 28972.66, collected: 0 },
  { month: 'Oct', expected: 28063.61, collected: 0 },
  { month: 'Nov', expected: 27646.83, collected: 0 },
  { month: 'Dec', expected: 24207.93, collected: 0 },
]

// Months with complete actuals (Aug is part-month at the snapshot date)
export const CLOSED_MONTHS = 7

export const TOTAL_RECORDS = 1064

export type MixItem = { label: string; value: number; color: string }

// Payment type, all-time. Blue = automatable via Stripe/Paycove, amber = manual, slate = not set
export const PAYMENT_MIX: MixItem[] = [
  { label: 'Not set',      value: 426, color: 'bg-slate-300' },
  { label: 'Installments', value: 392, color: 'bg-blue-600' },
  { label: 'Up-Front',     value: 197, color: 'bg-blue-600' },
  { label: 'WFD',          value: 20,  color: 'bg-amber-500' },
  { label: 'Climb Credit', value: 10,  color: 'bg-amber-500' },
  { label: 'Sallie Mae',   value: 10,  color: 'bg-amber-500' },
  { label: 'Meritize',     value: 4,   color: 'bg-amber-500' },
  { label: 'Voc. Rehab.',  value: 2,   color: 'bg-amber-500' },
  { label: 'Credee',       value: 2,   color: 'bg-amber-500' },
  { label: 'Direct',       value: 1,   color: 'bg-amber-500' },
]

// Student status, all-time
export const STATUS_MIX: MixItem[] = [
  { label: 'Active',       value: 389, color: 'bg-blue-600' },
  { label: 'Graduated',    value: 323, color: 'bg-emerald-600' },
  { label: 'Dropped',      value: 273, color: 'bg-red-500' },
  { label: 'Not set',      value: 39,  color: 'bg-slate-300' },
  { label: 'Blocked',      value: 20,  color: 'bg-slate-500' },
  { label: 'On Hold',      value: 13,  color: 'bg-amber-500' },
  { label: 'Climb Credit', value: 7,   color: 'bg-cyan-600' },
]

// ── Sample student grid ─────────────────────────────────────────────────────

export type Cell = { state: 'paid'; amount: number } | { state: 'missed' } | { state: 'none' }

const paid = (amount: number): Cell => ({ state: 'paid', amount })
const MISSED: Cell = { state: 'missed' }
const NONE: Cell = { state: 'none' }
const repeat = (cell: Cell, n: number): Cell[] => Array.from({ length: n }, () => cell)

export type SampleStudent = {
  name: string
  program: string
  paymentType: string
  status: string
  cells: Cell[] // Jan–Dec
}

export const SAMPLE_STUDENTS: SampleStudent[] = [
  { name: 'Sample Student 01', program: 'UI/UX Design', paymentType: 'Installments', status: 'Active',
    cells: [...repeat(paid(450), 8), ...repeat(NONE, 4)] },
  { name: 'Sample Student 02', program: 'Digital Marketing', paymentType: 'Installments', status: 'Active',
    cells: [...repeat(paid(250), 8), ...repeat(NONE, 4)] },
  { name: 'Sample Student 03', program: 'Generative AI Data Analyst', paymentType: 'Installments', status: 'Active',
    cells: [NONE, NONE, ...repeat(paid(500), 6), ...repeat(NONE, 4)] },
  { name: 'Sample Student 04', program: 'UI/UX Design', paymentType: 'Installments', status: 'Active',
    cells: [paid(400), MISSED, paid(400), ...repeat(MISSED, 5), ...repeat(NONE, 4)] },
  { name: 'Sample Student 05', program: 'Digital Marketing', paymentType: 'Installments', status: 'Active',
    cells: [...repeat(paid(350), 4), ...repeat(MISSED, 4), ...repeat(NONE, 4)] },
  { name: 'Sample Student 06', program: 'Project Management', paymentType: 'Up-Front', status: 'Active',
    cells: [paid(4800), ...repeat(NONE, 11)] },
  { name: 'Sample Student 07', program: 'UI/UX Design', paymentType: 'WFD', status: 'Active',
    cells: [NONE, paid(6000), ...repeat(NONE, 10)] },
  { name: 'Sample Student 08', program: 'Project Management', paymentType: 'Climb Credit', status: 'Active',
    cells: [...repeat(NONE, 4), paid(5000), ...repeat(NONE, 7)] },
  { name: 'Sample Student 09', program: 'Digital Marketing', paymentType: 'Installments', status: 'Graduated',
    cells: [...repeat(paid(300), 4), ...repeat(NONE, 8)] },
  { name: 'Sample Student 10', program: 'UI/UX Design', paymentType: 'Sallie Mae', status: 'Graduated',
    cells: [NONE, NONE, paid(5500), ...repeat(NONE, 9)] },
  { name: 'Sample Student 11', program: 'Generative AI Data Analyst', paymentType: 'Installments', status: 'Graduated',
    cells: [NONE, paid(700), MISSED, paid(700), ...repeat(NONE, 8)] },
  { name: 'Sample Student 12', program: 'UI/UX Design', paymentType: 'Installments', status: 'Dropped',
    cells: [...repeat(paid(450), 3), ...repeat(NONE, 9)] },
  { name: 'Sample Student 13', program: 'Digital Marketing', paymentType: 'Installments', status: 'Dropped',
    cells: [paid(350), ...repeat(NONE, 11)] },
  { name: 'Sample Student 14', program: 'UI/UX Design', paymentType: 'Installments', status: 'On Hold',
    cells: [paid(450), paid(225), ...repeat(MISSED, 6), ...repeat(NONE, 4)] },
]

// ── Sample exception queue ──────────────────────────────────────────────────

export type Flag = 'review' | 'manual' | 'ok'

export const SAMPLE_EXCEPTIONS: { name: string; paymentType: string; status: string; lastPayment: string; flag: Flag; reason: string }[] = [
  { name: 'Sample Student 04', paymentType: 'Installments', status: 'Active',  lastPayment: 'Mar 2026', flag: 'review', reason: 'No payment 45+ days' },
  { name: 'Sample Student 14', paymentType: 'Installments', status: 'On Hold', lastPayment: 'Feb 2026', flag: 'review', reason: 'On hold, balance owed' },
  { name: 'Sample Student 05', paymentType: 'Installments', status: 'Active',  lastPayment: 'Apr 2026', flag: 'review', reason: 'No payment 45+ days' },
  { name: 'Sample Student 07', paymentType: 'WFD',          status: 'Active',  lastPayment: 'Feb 2026', flag: 'manual', reason: 'Awaiting bank entry' },
  { name: 'Sample Student 08', paymentType: 'Climb Credit', status: 'Active',  lastPayment: 'May 2026', flag: 'manual', reason: 'Awaiting lender report' },
  { name: 'Sample Student 01', paymentType: 'Installments', status: 'Active',  lastPayment: 'Aug 2026', flag: 'ok',     reason: 'On schedule' },
]
