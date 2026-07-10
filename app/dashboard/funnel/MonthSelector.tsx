'use client'

import { useRouter, useSearchParams } from 'next/navigation'

function formatMonthLabel(label: string): string {
  const [mon, yr] = label.split('-')
  return `${mon} 20${yr}`
}

export default function MonthSelector({ months, selected }: { months: string[]; selected: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function goToMonth(value: string) {
    const next = new URLSearchParams(params.toString())
    next.set('m', value)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <select
      value={selected}
      onChange={(e) => goToMonth(e.target.value)}
      className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    >
      {months.map((m) => (
        <option key={m} value={m}>{formatMonthLabel(m)}</option>
      ))}
    </select>
  )
}
