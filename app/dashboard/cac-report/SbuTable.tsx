'use client'

import { useState } from 'react'

interface UniversityRow {
  university: string
  leads: number
  enrollments: number
  cvr: number
  spendGoogle: number
  spendMeta: number
  cplGoogle: number
  cplMeta: number
  cac: number
}

interface SbuRow {
  course: string
  leads: number
  enrollments: number
  cvr: number
  spend: number
  cpl: number
  cac: number
  byUniversity: UniversityRow[]
}

interface SbuTableProps {
  rows: SbuRow[]
}

const UNI_COLORS: Record<string, string> = {
  UTA: 'bg-blue-500',
  WFI: 'bg-violet-600',
  Hofstra: 'bg-amber-500',
  NEIU: 'bg-emerald-600',
  SCU: 'bg-orange-500',
  UTSA: 'bg-rose-500',
}

function fmt(n: number): string { return n > 0 ? `$${n.toLocaleString()}` : '—' }
function pct(n: number): string { return n > 0 ? `${(n * 100).toFixed(1)}%` : '—' }

export default function SbuTable({ rows }: SbuTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(course: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(course)) { next.delete(course) } else { next.add(course) }
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">SBU / University</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">Leads</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">Enrollments</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">CVR</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">CPL (G)</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">CPL (M)</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">Mktg CAC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              {/* SBU row */}
              <tr
                key={row.course}
                className="bg-blue-50/40 border-b border-slate-200 cursor-pointer hover:bg-blue-50"
                onClick={() => toggle(row.course)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-white border border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                      {expanded.has(row.course) ? '−' : '+'}
                    </span>
                    <span className="font-display text-[12px] font-bold text-slate-900">{row.course}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{row.leads.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{row.enrollments.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono font-semibold text-slate-900">{pct(row.cvr)}</span>
                    <div className="w-8 h-1.5 bg-slate-200 rounded overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded" style={{ width: `${Math.min(row.cvr * 100 * 5, 100)}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{fmt(row.cpl)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">—</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-600">{fmt(row.cac)}</td>
              </tr>

              {/* University sub-rows */}
              {expanded.has(row.course) && row.byUniversity.map((uni) => (
                <tr key={`${row.course}-${uni.university}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 pl-6">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${UNI_COLORS[uni.university] ?? 'bg-slate-400'}`} />
                      <span className="text-slate-600">{uni.university}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">{uni.leads.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">{uni.enrollments.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-mono text-slate-600">{pct(uni.cvr)}</span>
                      <div className="w-8 h-1.5 bg-slate-200 rounded overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded" style={{ width: `${Math.min(uni.cvr * 100 * 5, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">
                    {uni.cplGoogle > 0 ? (
                      <span className="inline-block text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{fmt(uni.cplGoogle)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">
                    {uni.cplMeta > 0 ? (
                      <span className="inline-block text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded font-mono">{fmt(uni.cplMeta)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-blue-600">{fmt(uni.cac)}</td>
                </tr>
              ))}
            </>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                No data — run the HubSpot sync first
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
