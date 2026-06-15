'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Period } from '@/lib/metrics/periods'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'last_month', label: 'Last Mo.' },
  { value: '90d', label: '90-Day' },
  { value: 'ytd', label: 'YTD' },
]

const UNIVERSITIES = ['All Universities', 'UTA', 'WFI', 'Hofstra', 'NEIU', 'SCU']

export default function SpendFilterBar() {
  const router = useRouter()
  const params = useSearchParams()
  const period = (params.get('period') ?? 'mtd') as Period
  const university = params.get('university') ?? ''

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-px">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => update('period', value)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              period === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <select
        value={university}
        onChange={(e) => update('university', e.target.value === 'All Universities' ? '' : e.target.value)}
        className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {UNIVERSITIES.map((u) => (
          <option key={u} value={u === 'All Universities' ? '' : u}>{u}</option>
        ))}
      </select>
    </div>
  )
}
