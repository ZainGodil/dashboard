export type Period = 'mtd' | 'last_month' | '90d' | 'half_year' | 'ytd'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toLabel(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

export function getMonthsForPeriod(period: Period): string[] {
  const now = new Date()

  if (period === 'mtd') return [toLabel(now)]

  if (period === 'last_month') {
    return [toLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1))]
  }

  if (period === 'ytd') {
    const months: string[] = []
    for (let m = 0; m <= now.getMonth(); m++) {
      months.push(toLabel(new Date(now.getFullYear(), m, 1)))
    }
    return months
  }

  if (period === 'half_year') return getHalfYearMonths()

  return [] // 90d uses rolling_metrics — handled separately
}

// Current half-year (H1 = Jan–Jun, H2 = Jul–Dec). To date by default; `full`
// returns all six months, e.g. for summing monthly goals.
export function getHalfYearMonths(full = false, now = new Date()): string[] {
  const startMonth = now.getMonth() < 6 ? 0 : 6
  const endMonth = full ? startMonth + 5 : now.getMonth()
  const months: string[] = []
  for (let m = startMonth; m <= endMonth; m++) {
    months.push(toLabel(new Date(now.getFullYear(), m, 1)))
  }
  return months
}

// First day of the current half-year as YYYY-MM-DD
export function getHalfYearStartDate(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() < 6 ? '01' : '07'}-01`
}

export function getPeriodLabel(period: Period): string {
  const labels: Record<Period, string> = {
    mtd: 'MTD',
    last_month: 'Last Mo.',
    '90d': '90-Day',
    half_year: 'Half-Yr',
    ytd: 'YTD',
  }
  return labels[period]
}

export function getLast6Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    months.push(toLabel(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return months
}

export function getLast12Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    months.push(toLabel(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return months
}

export function parseMonthLabel(label: string): Date {
  const [mon, yr] = label.split('-')
  const idx = MONTH_LABELS.indexOf(mon)
  return new Date(2000 + Number(yr), idx, 1)
}

export function sortMonthLabelsDesc(labels: string[]): string[] {
  return [...labels].sort((a, b) => parseMonthLabel(b).getTime() - parseMonthLabel(a).getTime())
}
