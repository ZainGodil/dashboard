'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Period } from '@/lib/metrics/periods'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'last_month', label: 'Last Mo.' },
  { value: '90d', label: '90-Day' },
  { value: 'ytd', label: 'YTD' },
]

export default function SalesFilterBar() {
  const router = useRouter()
  const params = useSearchParams()
  const period = (params.get('period') ?? 'mtd') as Period

  function setP(v: Period) {
    const next = new URLSearchParams(params.toString())
    next.set('period', v)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-px">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setP(value)}
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
  )
}
