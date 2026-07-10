'use client'

import { useState } from 'react'
import AdvisorFunnelCard from './AdvisorFunnelCard'
import type { AdvisorFunnelRow } from './page'

export default function FunnelMatrix({ advisors, total }: { advisors: AdvisorFunnelRow[]; total: AdvisorFunnelRow }) {
  const [activeIdx, setActiveIdx] = useState(0) // 0 = Total, 1..N = advisors[i-1]

  const tabs = ['Total', ...advisors.map((a) => a.advisor)]
  const active = activeIdx === 0 ? total : advisors[activeIdx - 1]

  return (
    <div>
      <div className="flex gap-1 flex-wrap px-5 py-3 border-b border-slate-100 bg-slate-50">
        {tabs.map((name, i) => (
          <button
            key={name}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeIdx === i
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="p-4">
        <AdvisorFunnelCard title={active.advisor} counts={active.counts} percents={active.percents} rawStatusRows={active.rawStatusRows} />
      </div>
    </div>
  )
}
