import { MONTHS, type SampleStudent } from './data'

const money = (v: number) => `$${Math.round(v).toLocaleString()}`

export default function PaymentGrid({ students }: { students: SampleStudent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {['Student', 'Program', 'Type', 'Status'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
            {MONTHS.map((m) => (
              <th key={m} className="px-1 py-2.5 text-center text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold">{m}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold whitespace-nowrap">2026 Total</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const total = s.cells.reduce((sum, c) => sum + (c.state === 'paid' ? c.amount : 0), 0)
            return (
              <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{s.program}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{s.paymentType}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{s.status}</td>
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
                        <div title={`${s.name} · ${month} · Due, not received`} className="rounded bg-red-50 text-red-600 font-mono text-[10px] text-center py-1.5 min-w-[44px]">
                          —
                        </div>
                      </td>
                    )
                  }
                  return (
                    <td key={month} className="px-0.5 py-1">
                      <div title={`${s.name} · ${month} · Not due / not applicable`} className="rounded bg-slate-50 py-1.5 min-w-[44px] h-[27px]" />
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{money(total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
