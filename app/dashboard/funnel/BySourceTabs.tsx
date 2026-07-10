'use client'

import { useState } from 'react'
import AdvisorFunnelCard from './AdvisorFunnelCard'
import type { AdvisorSourceFunnel } from './page'
import { sumStageCounts, sumRawStatusRows, computeStagePercents } from '@/lib/funnel/stages'

export default function BySourceTabs({ sourceFunnels }: { sourceFunnels: AdvisorSourceFunnel[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!sourceFunnels.length) return null

  const { advisor, rows } = sourceFunnels[activeIdx]
  const totalCounts = sumStageCounts(rows.map((r) => r.counts))
  const totalRawStatusRows = sumRawStatusRows(rows.map((r) => r.rawStatusRows))

  return (
    <div className="space-y-3">
      {/* Header + tabs */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-8 text-center text-slate-400 text-sm">
          No contacts assigned to this advisor
        </div>
      ) : (
        <div className="space-y-4">
          <AdvisorFunnelCard
            title={`${advisor} — Total`}
            counts={totalCounts}
            percents={computeStagePercents(totalCounts)}
            rawStatusRows={totalRawStatusRows}
          />
          {rows.map((row) => (
            <AdvisorFunnelCard
              key={row.source}
              title={`${advisor} — ${row.source}`}
              counts={row.counts}
              percents={row.percents}
              rawStatusRows={row.rawStatusRows}
            />
          ))}
        </div>
      )}
    </div>
  )
}
