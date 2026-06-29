'use client'

import { useState } from 'react'
import type { SourceFunnel, SourceRow } from './page'

const COLS: { key: keyof SourceRow; label: string }[] = [
  { key: 'totalLeads',     label: 'Total' },
  { key: 'viable',         label: 'Viable' },
  { key: 'contacted',      label: 'Contacted' },
  { key: 'apptBooked',     label: 'Appt Booked' },
  { key: 'noShows',        label: 'No Shows' },
  { key: 'apptAttended',   label: 'Attended' },
  { key: 'inProgress',     label: 'In Progress' },
  { key: 'bookedDecision', label: 'Book Decision' },
  { key: 'enrolled',       label: 'Enrolled' },
]

function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round(n / total * 100)}%` : ''
}

function sumRow(rows: SourceRow[]): SourceRow {
  return {
    source: 'Total',
    totalLeads:     rows.reduce((s, r) => s + r.totalLeads, 0),
    viable:         rows.reduce((s, r) => s + r.viable, 0),
    contacted:      rows.reduce((s, r) => s + r.contacted, 0),
    apptBooked:     rows.reduce((s, r) => s + r.apptBooked, 0),
    noShows:        rows.reduce((s, r) => s + r.noShows, 0),
    apptAttended:   rows.reduce((s, r) => s + r.apptAttended, 0),
    inProgress:     rows.reduce((s, r) => s + r.inProgress, 0),
    bookedDecision: rows.reduce((s, r) => s + r.bookedDecision, 0),
    enrolled:       rows.reduce((s, r) => s + r.enrolled, 0),
  }
}

export default function BySourceTabs({ sourceFunnels }: { sourceFunnels: SourceFunnel[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!sourceFunnels.length) return null

  const { advisor, rows } = sourceFunnels[activeIdx]
  const total = sumRow(rows)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Header + tabs */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <span className="font-display text-[13px] font-bold text-slate-900">By Source — per Advisor</span>
        <div className="flex gap-1 flex-wrap">
          {sourceFunnels.map(({ advisor: a }, i) => (
            <button
              key={a}
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeIdx === i
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {a.split(' ')[0]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 ml-auto">{advisor}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold min-w-[140px]">
                Source
              </th>
              {COLS.map((col) => (
                <th key={col.key} className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{row.source}</td>
                {COLS.map((col) => {
                  const val = row[col.key] as number
                  const showPct = col.key !== 'totalLeads' && col.key !== 'noShows'
                  const p = showPct ? pct(val, row.totalLeads) : ''
                  return (
                    <td key={col.key} className="px-3 py-2 text-right font-mono">
                      {val > 0 ? (
                        <span>
                          <span className="text-slate-700">{val}</span>
                          {p && <span className="text-slate-400 ml-1 text-[10px]">{p}</span>}
                        </span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No contacts assigned to this advisor
                </td>
              </tr>
            )}
          </tbody>
          {/* Total footer */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-4 py-2.5 text-[11px] font-bold text-slate-900">Total</td>
              {COLS.map((col) => {
                const val = total[col.key] as number
                return (
                  <td key={col.key} className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {val > 0 ? val.toLocaleString() : ''}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
