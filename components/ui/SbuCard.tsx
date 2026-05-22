interface SbuCardProps {
  course: string
  leads: number
  enrollments: number
  cvr: number
  cpl: number
  cac: number
  ragStatus: 'green' | 'amber' | 'red' | 'none'
}

const RAG_BORDER = { green: 'border-t-emerald-500', amber: 'border-t-amber-500', red: 'border-t-red-500', none: 'border-t-slate-200' }
const RAG_CAC_COLOR = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', none: 'text-slate-900' }
const RAG_PILL_STYLE = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  none: 'bg-slate-100 text-slate-500',
}

function fmt(n: number): string {
  return n === 0 ? '—' : `$${n.toLocaleString()}`
}

function pct(n: number): string {
  return n === 0 ? '—' : `${(n * 100).toFixed(1)}%`
}

export default function SbuCard({ course, leads, enrollments, cvr, cpl, cac, ragStatus }: SbuCardProps) {
  return (
    <div className={`bg-white border border-slate-200 border-t-[3px] ${RAG_BORDER[ragStatus]} rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]`}>
      <div className="font-display text-[12px] font-bold text-slate-900 mb-3">{course}</div>
      <div className="space-y-1.5">
        <Row label="Leads" value={leads.toLocaleString()} />
        <Row label="Enrollments" value={enrollments.toLocaleString()} />
        <Row label="CVR" value={pct(cvr)} />
        <Row label="Blended CPL" value={fmt(cpl)} />
        <Row label="Marketing CAC" value={fmt(cac)} valueClass={RAG_CAC_COLOR[ragStatus]} />
      </div>
      {ragStatus !== 'none' && (
        <div className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mt-3 ${RAG_PILL_STYLE[ragStatus]}`}>
          {ragStatus === 'green' ? '↓' : ragStatus === 'red' ? '↑' : '—'} vs last mo.
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueClass = 'text-slate-900' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`font-mono text-[11px] font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}
