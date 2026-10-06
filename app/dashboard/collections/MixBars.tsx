import type { MixItem } from './data'

export default function MixBars({ items }: { items: MixItem[] }) {
  const max = Math.max(...items.map((d) => d.value))
  return (
    <div className="space-y-2">
      {items.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[11px] text-slate-500 text-right">{d.label}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
            <div className={`h-full rounded ${d.color}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 font-mono text-[11px] text-slate-700 text-right">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
