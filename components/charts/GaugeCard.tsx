'use client'

interface GaugeCardProps {
  label: string
  value: number
  displayValue: string
  max: number
  color: string
  formatMin?: string
  formatMax?: string
}

export default function GaugeCard({
  label, value, displayValue, max, color,
  formatMin = '0', formatMax,
}: GaugeCardProps) {
  const pct = Math.min(Math.max(value / max, 0), 0.9999)

  // Semi-circular gauge: arc from left (cx−r, cy) counterclockwise through top to current point
  const cx = 50, cy = 56, r = 42
  const angle = Math.PI * pct
  const endX = cx - r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)
  const largeArc = pct > 0.5 ? 1 : 0

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy}`
  const fillPath = pct > 0.001
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}`
    : ''
  const maxLabel = formatMax ?? String(max)

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 pt-3 pb-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col items-center">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.6px] mb-1">{label}</p>
      <svg viewBox="0 0 100 70" className="w-full max-w-[200px]">
        {/* Background track */}
        <path d={trackPath} fill="none" stroke="#E2E8F0" strokeWidth="9" strokeLinecap="round" />
        {/* Value fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
        )}
        {/* Min label */}
        <text x={cx - r} y={cy + 13} textAnchor="middle" fontSize="6.5" fill="#94A3B8">{formatMin}</text>
        {/* Max label */}
        <text x={cx + r} y={cy + 13} textAnchor="middle" fontSize="6.5" fill="#94A3B8">{maxLabel}</text>
        {/* Current value */}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0F172A">{displayValue}</text>
      </svg>
    </div>
  )
}
