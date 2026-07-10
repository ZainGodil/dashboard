import { FUNNEL_CHART_STAGES, type StageCounts, type StagePercents } from '@/lib/funnel/stages'

function pctStr(val: number | null): string | null {
  return val === null ? null : `${(val * 100).toFixed(1)}%`
}

export default function FunnelSummaryTable({ counts, percents, title }: { counts: StageCounts; percents: StagePercents; title: string }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          <th colSpan={3} className="bg-amber-400 px-2 py-1.5 text-left font-semibold text-slate-900">{title}</th>
        </tr>
      </thead>
      <tbody>
        {FUNNEL_CHART_STAGES.map((stage) => {
          const pct = stage.percentKey ? pctStr(percents[stage.percentKey]) : null
          return (
            <tr key={stage.key} className="border-b border-slate-100 even:bg-slate-50">
              <td className="px-2 py-1 text-slate-700">{stage.label}</td>
              <td className="px-2 py-1 text-right font-mono font-semibold text-slate-800">
                {counts[stage.key] > 0 ? counts[stage.key].toLocaleString() : <span className="text-slate-300">-</span>}
              </td>
              <td className="px-2 py-1 text-right font-mono text-slate-400 w-14">{pct ?? ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
