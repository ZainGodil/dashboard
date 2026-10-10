'use client'

import { useState } from 'react'
import PaymentGrid, { type GridRow } from './PaymentGrid'

interface Props {
  title: string
  legend: React.ReactNode
  footnote: React.ReactNode
  metaColumns: string[]
  rows: GridRow[]
  totalLabel: string
}

// The student grid with a search box: filters by name or email; the Monthly total row follows the filter
export default function StudentGridCard({ title, legend, footnote, metaColumns, rows, totalLabel }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => (r.search ?? r.name).toLowerCase().includes(q)) : rows

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-display text-[13px] font-bold text-slate-900">{title}</span>
        <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {q ? `${shown.length} of ${rows.length}` : rows.length} students
        </span>
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search students"
            className="w-60 text-[12px] border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex-1" />
        {legend}
      </div>
      {shown.length ? (
        <PaymentGrid metaColumns={metaColumns} rows={shown} totalLabel={totalLabel} />
      ) : (
        <div className="px-5 py-6 text-[12px] text-slate-400">No students match &ldquo;{query.trim()}&rdquo;.</div>
      )}
      <div className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-100">{footnote}</div>
    </div>
  )
}
