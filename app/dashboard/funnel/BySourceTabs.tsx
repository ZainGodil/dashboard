'use client'

import { useState } from 'react'
import type { AdvisorSourceFunnel, SourceFunnelRow } from './page'
import { FUNNEL_STAGES, sumStageCounts, computeStagePercents } from '@/lib/funnel/stages'

function pctStr(val: number | null): string | null {
  return val === null ? null : `${Math.round(val * 100)}%`
}

export default function BySourceTabs({ sourceFunnels }: { sourceFunnels: AdvisorSourceFunnel[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!sourceFunnels.length) return null

  const { advisor, rows } = sourceFunnels[activeIdx]
  const totalCounts = sumStageCounts(rows.map((r) => r.counts))
  const totalPercents = computeStagePercents(totalCounts)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Header + tabs */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <span className="font-display text-[13px] font-bold text-slate-900">By Source and AA</span>
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
              {FUNNEL_STAGES.map((stage) => (
                <th key={stage.key} className="text-right px-3 py-2.5 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap">
                  {stage.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: SourceFunnelRow) => (
              <tr key={row.source} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{row.source}</td>
                {FUNNEL_STAGES.map((stage) => {
                  const val = row.counts[stage.key]
                  const pct = stage.percentKey ? pctStr(row.percents[stage.percentKey]) : null
                  return (
                    <td key={stage.key} className="px-3 py-2 text-right font-mono">
                      {val > 0 ? (
                        <span>
                          <span className="text-slate-700">{val}</span>
                          {pct && <span className="text-slate-400 ml-1 text-[10px]">{pct}</span>}
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
                <td colSpan={FUNNEL_STAGES.length + 1} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No contacts assigned to this advisor
                </td>
              </tr>
            )}
          </tbody>
          {/* Total footer */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-4 py-2.5 text-[11px] font-bold text-slate-900">Total</td>
              {FUNNEL_STAGES.map((stage) => {
                const val = totalCounts[stage.key]
                const pct = stage.percentKey ? pctStr(totalPercents[stage.percentKey]) : null
                return (
                  <td key={stage.key} className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {val > 0 ? val.toLocaleString() : ''}
                    {pct && <span className="text-slate-400 ml-1 text-[10px] font-normal">{pct}</span>}
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
