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

  const cx = 50, cy = 48, r = 38
  const angle = Math.PI * pct
  const endX = cx - r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)

  // Track: full upper semi-circle (left → top → right), sweep=1 = clockwise in SVG = upward
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
  // Fill: always largeArc=0 because the fill arc is always ≤ 180°
  const fillPath = pct > 0.001
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`
    : ''
  const maxLabel = formatMax ?? String(max)

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 pt-3 pb-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col items-center">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.7px] mb-0.5">{label}</p>
      {/* Aspect-ratio wrapper guarantees the SVG is never height-collapsed in flex layouts */}
      <div className="w-full" style={{ aspectRatio: '100 / 66' }}>
        <svg viewBox="0 0 100 66" className="w-full h-full" style={{ overflow: 'visible' }}>
          <path d={trackPath} fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
          {fillPath && (
            <path d={fillPath} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
          )}
          <text x={cx - r} y={cy + 14} textAnchor="middle" fontSize="6.5" fill="#94A3B8">{formatMin}</text>
          <text x={cx + r} y={cy + 14} textAnchor="middle" fontSize="6.5" fill="#94A3B8">{maxLabel}</text>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="17" fontWeight="700" fill="#0F172A">{displayValue}</text>
        </svg>
      </div>
    </div>
  )
}
