import { MONTHS } from './data'

const money = (v: number) => `$${Math.round(v).toLocaleString()}`

// Pinned while the grid scrolls; the inset shadow stands in for the border, which sticky cells drop
const STICKY_HEAD = 'sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#E2E8F0]'
const STICKY_FOOT = 'sticky bottom-0 z-10 bg-slate-50 shadow-[inset_0_2px_0_#E2E8F0]'

export type GridCell = { state: 'paid'; amount: number } | { state: 'missed'; reason?: string } | { state: 'none' }

export interface GridRow {
  key: string
  name: string
  meta: React.ReactNode[] // one value per entry in metaColumns
  cells: GridCell[] // Jan–Dec
}

export default function PaymentGrid({ metaColumns, rows, totalLabel }: { metaColumns: string[]; rows: GridRow[]; totalLabel: string }) {
  return (
    // Fixed height with its own scroll bar; headings stay at the top and the totals row at the bottom
    <div className="max-h-[600px] overflow-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {['Student', ...metaColumns].map((h) => (
              <th key={h} className={`px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap ${STICKY_HEAD}`}>{h}</th>
            ))}
            {MONTHS.map((m) => (
              <th key={m} className={`px-1 py-2.5 text-center text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold ${STICKY_HEAD}`}>{m}</th>
            ))}
            <th className={`px-3 py-2.5 text-right text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap ${STICKY_HEAD}`}>{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const total = s.cells.reduce((sum, c) => sum + (c.state === 'paid' ? c.amount : 0), 0)
            return (
              <tr key={s.key} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{s.name}</td>
                {s.meta.map((v, i) => (
                  <td key={metaColumns[i]} className="px-3 py-2 text-slate-500 whitespace-nowrap">{v}</td>
                ))}
                {s.cells.map((c, i) => {
                  const month = MONTHS[i]
                  if (c.state === 'paid') {
                    return (
                      <td key={month} className="px-0.5 py-1">
                        <div title={`${s.name} · ${month} · Paid ${money(c.amount)}`} className="rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] text-center py-1.5 min-w-[44px]">
                          {money(c.amount)}
                        </div>
                      </td>
                    )
                  }
                  if (c.state === 'missed') {
                    return (
                      <td key={month} className="px-0.5 py-1">
                        <div title={`${s.name} · ${month} · ${c.reason ? `Failed: ${c.reason}` : 'Due, not received'}`} className="rounded bg-red-50 text-red-600 font-mono text-[10px] text-center py-1.5 min-w-[44px]">
                          —
                        </div>
                      </td>
                    )
                  }
                  return (
                    <td key={month} className="px-0.5 py-1">
                      <div title={`${s.name} · ${month} · Nothing due or attempted`} className="rounded bg-slate-50 py-1.5 min-w-[44px] h-[27px]" />
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{money(total)}</td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={1 + metaColumns.length} className={`px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap ${STICKY_FOOT}`}>Monthly total</td>
              {MONTHS.map((m, i) => {
                const paid = rows.reduce((sum, r) => {
                  const c = r.cells[i]
                  return sum + (c && c.state === 'paid' ? c.amount : 0)
                }, 0)
                return (
                  <td key={m} className={`px-0.5 py-2.5 text-center font-mono text-[10px] font-semibold text-slate-900 whitespace-nowrap ${STICKY_FOOT}`} title={`${m} · Total paid ${money(paid)}`}>
                    {paid > 0 ? money(paid) : ''}
                  </td>
                )
              })}
              <td className={`px-3 py-2.5 text-right font-mono font-bold text-slate-900 ${STICKY_FOOT}`}>
                {money(rows.reduce((sum, r) => sum + r.cells.reduce((s, c) => s + (c.state === 'paid' ? c.amount : 0), 0), 0))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
