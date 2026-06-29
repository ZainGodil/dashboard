'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Period } from '@/lib/metrics/periods'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'last_month', label: 'Last Mo.' },
  { value: '90d', label: '90-Day' },
  { value: 'ytd', label: 'YTD' },
]

const UNIVERSITIES = ['All Universities', 'UTA', 'WFI', 'Hofstra', 'NEIU', 'SCU', 'UTSA']
const SEGMENTS = ['B2C + WFD', 'B2C', 'WFD']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function currentMonthStr(): string {
  const now = new Date()
  return `${MONTH_LABELS[now.getMonth()]}-${String(now.getFullYear()).slice(2)}`
}

function shiftMonth(label: string, delta: number): string {
  const [mon, yr] = label.split('-')
  let m = MONTH_LABELS.indexOf(mon)
  let y = 2000 + Number(yr)
  m += delta
  while (m < 0) { m += 12; y-- }
  while (m > 11) { m -= 12; y++ }
  return `${MONTH_LABELS[m]}-${String(y).slice(2)}`
}

function formatMonthLabel(label: string): string {
  const [mon, yr] = label.split('-')
  return `${mon} 20${yr}`
}

export default function FilterBar() {
  const router = useRouter()
  const params = useSearchParams()

  const period = (params.get('period') ?? 'mtd') as Period
  const university = params.get('university') ?? ''
  const segment = params.get('segment') ?? ''
  const customMonth = params.get('m') ?? null

  const now = currentMonthStr()

  // Derive anchor month for navigation (what month the current view is centred on)
  const anchorMonth = customMonth ?? (period === 'last_month' ? shiftMonth(now, -1) : now)
  const prevMonth = shiftMonth(anchorMonth, -1)
  const nextMonth = shiftMonth(anchorMonth, 1)
  const isAtPresent = anchorMonth === now

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  function setPeriod(value: Period) {
    const next = new URLSearchParams(params.toString())
    next.set('period', value)
    next.delete('m')
    router.push(`?${next.toString()}`, { scroll: false })
  }

  function goToMonth(label: string) {
    const next = new URLSearchParams(params.toString())
    next.set('m', label)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Period toggle */}
      <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-px">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              period === value && !customMonth
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Month navigator */}
      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-px">
        <button
          onClick={() => goToMonth(prevMonth)}
          title={`Go to ${formatMonthLabel(prevMonth)}`}
          className="px-2 py-1.5 rounded-md text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all leading-none"
        >
          ‹
        </button>
        <span className={`px-2 py-1.5 text-[12px] font-medium min-w-[76px] text-center rounded-md transition-all ${
          customMonth ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'
        }`}>
          {formatMonthLabel(anchorMonth)}
        </span>
        <button
          onClick={() => !isAtPresent && goToMonth(nextMonth)}
          title={isAtPresent ? 'Already at current month' : `Go to ${formatMonthLabel(nextMonth)}`}
          className={`px-2 py-1.5 rounded-md text-[13px] leading-none transition-all ${
            isAtPresent
              ? 'text-slate-300 cursor-default'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer'
          }`}
        >
          ›
        </button>
      </div>

      {/* University filter */}
      <select
        value={university}
        onChange={(e) => update('university', e.target.value === 'All Universities' ? '' : e.target.value)}
        className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {UNIVERSITIES.map((u) => (
          <option key={u} value={u === 'All Universities' ? '' : u}>{u}</option>
        ))}
      </select>

      {/* Segment filter */}
      <select
        value={segment}
        onChange={(e) => update('segment', e.target.value === 'B2C + WFD' ? '' : e.target.value)}
        className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {SEGMENTS.map((s) => (
          <option key={s} value={s === 'B2C + WFD' ? '' : s}>{s}</option>
        ))}
      </select>
    </div>
  )
}
