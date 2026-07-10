import type { RawStatusRow, StageCounts } from '@/lib/funnel/stages'

function Cell({ val }: { val: number }) {
  return <td className="px-2 py-1 text-right font-mono text-[11px] text-slate-600">{val > 0 ? val : <span className="text-slate-300">-</span>}</td>
}

export default function RawStatusTable({ rows, totals }: { rows: RawStatusRow[]; totals: StageCounts }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-amber-100">
          <th className="px-2 py-1.5 text-left font-semibold text-slate-700"></th>
          <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Total Leads</th>
          <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Non viable</th>
          <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Unqualified</th>
        </tr>
      </thead>
      <tbody>
        <tr className="bg-slate-200 font-semibold">
          <td className="px-2 py-1 text-slate-800">Total</td>
          <Cell val={totals.total} />
          <Cell val={totals.nonViable} />
          <Cell val={totals.unqualified} />
        </tr>
        {rows.map((row) => (
          <tr key={row.label} className="odd:bg-orange-50/60 even:bg-white border-b border-orange-100">
            <td className="px-2 py-1 italic text-slate-600">{row.label}</td>
            <Cell val={row.total} />
            <Cell val={row.nonViable} />
            <Cell val={row.unqualified} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
