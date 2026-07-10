import AdvisorFunnelCard from './AdvisorFunnelCard'
import type { AdvisorFunnelRow } from './page'

export default function FunnelMatrix({ advisors, total }: { advisors: AdvisorFunnelRow[]; total: AdvisorFunnelRow }) {
  return (
    <div className="space-y-4">
      <AdvisorFunnelCard title="Total" counts={total.counts} percents={total.percents} rawStatusRows={total.rawStatusRows} />
      {advisors.map(({ advisor, counts, percents, rawStatusRows }) => (
        <AdvisorFunnelCard key={advisor} title={advisor} counts={counts} percents={percents} rawStatusRows={rawStatusRows} />
      ))}
    </div>
  )
}
