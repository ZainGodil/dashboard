export type Period = 'mtd' | 'last_month' | '90d' | 'ytd'

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

  return [] // 90d uses rolling_metrics — handled separately
}

export function getPeriodLabel(period: Period): string {
  const labels: Record<Period, string> = {
    mtd: 'MTD',
    last_month: 'Last Mo.',
    '90d': '90-Day',
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
