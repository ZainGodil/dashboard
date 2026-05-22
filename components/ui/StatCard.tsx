interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaDir?: 'up' | 'down' | 'neutral'
  accent?: 'blue' | 'teal' | 'green' | 'amber'
}

const ACCENT_COLORS = {
  blue: 'bg-blue-600',
  teal: 'bg-cyan-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-600',
}

const DELTA_COLORS = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-slate-400',
}

export default function StatCard({ label, value, delta, deltaDir = 'neutral', accent = 'blue' }: StatCardProps) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${ACCENT_COLORS[accent]}`} />
      <div className="text-[11px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-1.5">{label}</div>
      <div className="font-mono text-[26px] font-medium text-slate-900 tracking-tight leading-none mb-1.5">{value}</div>
      {delta && (
        <div className={`text-[11px] font-mono ${DELTA_COLORS[deltaDir]}`}>{delta}</div>
      )}
    </div>
  )
}
