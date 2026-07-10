import RawStatusTable from './RawStatusTable'
import FunnelSummaryTable from './FunnelSummaryTable'
import FunnelBarChart from './FunnelBarChart'
import type { RawStatusRow, StageCounts, StagePercents } from '@/lib/funnel/stages'

export default function AdvisorFunnelCard({
  title,
  counts,
  percents,
  rawStatusRows,
}: {
  title: string
  counts: StageCounts
  percents: StagePercents
  rawStatusRows: RawStatusRow[]
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-slate-800">
        <span className="font-display text-[13px] font-bold text-white">{title}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1.1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        <div className="overflow-x-auto">
          <RawStatusTable rows={rawStatusRows} totals={counts} />
        </div>
        <div className="overflow-x-auto">
          <FunnelSummaryTable counts={counts} percents={percents} title={title} />
        </div>
        <div className="p-2">
          <FunnelBarChart counts={counts} title={title} />
        </div>
      </div>
    </div>
  )
}
