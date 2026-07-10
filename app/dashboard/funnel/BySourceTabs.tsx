'use client'

import { useState } from 'react'
import AdvisorFunnelCard from './AdvisorFunnelCard'
import type { AdvisorSourceFunnel, SourceFunnelRow } from './page'
import { sumStageCounts, sumRawStatusRows, computeStagePercents } from '@/lib/funnel/stages'

function aggregateBySource(sourceFunnels: AdvisorSourceFunnel[]): SourceFunnelRow[] {
  const bySource = new Map<string, SourceFunnelRow[]>()
  for (const { rows } of sourceFunnels) {
    for (const row of rows) {
      const existing = bySource.get(row.source) ?? []
      existing.push(row)
      bySource.set(row.source, existing)
    }
  }
  return Array.from(bySource.entries())
    .map(([source, rows]) => {
      const counts = sumStageCounts(rows.map((r) => r.counts))
      return { source, counts, percents: computeStagePercents(counts), rawStatusRows: sumRawStatusRows(rows.map((r) => r.rawStatusRows)) }
    })
    .sort((a, b) => b.counts.total - a.counts.total)
}

export default function BySourceTabs({ sourceFunnels }: { sourceFunnels: AdvisorSourceFunnel[] }) {
  const [advisorIdx, setAdvisorIdx] = useState(0) // 0 = Total (all advisors), 1..N = sourceFunnels[i-1]
  const [sourceIdx, setSourceIdx] = useState(0) // 0 = Total (this advisor's sources), 1..N = rows[i-1]

  if (!sourceFunnels.length) return null

  const advisor = advisorIdx === 0 ? 'All Advisors' : sourceFunnels[advisorIdx - 1].advisor
  const rows = advisorIdx === 0 ? aggregateBySource(sourceFunnels) : sourceFunnels[advisorIdx - 1].rows

  const totalCounts = sumStageCounts(rows.map((r) => r.counts))
  const totalRawStatusRows = sumRawStatusRows(rows.map((r) => r.rawStatusRows))

  const sourceTabs = ['Total', ...rows.map((r) => r.source)]
  const activeSource = sourceIdx === 0
    ? { title: `${advisor} — Total`, counts: totalCounts, percents: computeStagePercents(totalCounts), rawStatusRows: totalRawStatusRows }
    : { title: `${advisor} — ${rows[sourceIdx - 1].source}`, ...rows[sourceIdx - 1] }

  function selectAdvisor(i: number) {
    setAdvisorIdx(i)
    setSourceIdx(0)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Advisor tabs */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <span className="font-display text-[13px] font-bold text-slate-900">By Source and AA</span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => selectAdvisor(0)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
              advisorIdx === 0 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            Total
          </button>
          {sourceFunnels.map(({ advisor: a }, i) => (
            <button
              key={a}
              onClick={() => selectAdvisor(i + 1)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                advisorIdx === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {a.split(' ')[0]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 ml-auto">{advisor}</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-slate-400 text-sm">No contacts assigned to this advisor</div>
      ) : (
        <>
          {/* Source tabs */}
          <div className="px-5 py-2 border-b border-slate-100 bg-slate-50 flex gap-1 flex-wrap">
            {sourceTabs.map((name, i) => (
              <button
                key={name}
                onClick={() => setSourceIdx(i)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  sourceIdx === i ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="p-4">
            <AdvisorFunnelCard
              title={activeSource.title}
              counts={activeSource.counts}
              percents={activeSource.percents}
              rawStatusRows={activeSource.rawStatusRows}
            />
          </div>
        </>
      )}
    </div>
  )
}
