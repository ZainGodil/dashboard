'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface YoYPoint {
  month: string
  '2024': number
  '2025': number
  '2026': number
}

interface YoYSpendChartProps {
  data: YoYPoint[]
}

export default function YoYSpendChart({ data }: YoYSpendChartProps) {
  const hasData = data.some((d) => d['2024'] > 0 || d['2025'] > 0 || d['2026'] > 0)

  if (!hasData) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">YoY Ad Spend</div>
        <div className="text-[11px] text-slate-400 mb-3">2024 · 2025 · 2026 YTD</div>
        <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">No spend data yet</div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">YoY Ad Spend</div>
      <div className="text-[11px] text-slate-400 mb-3">2024 · 2025 · 2026 YTD</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v) => [`$${Number(v).toLocaleString()}`, '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="2024" name="2024" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
          <Bar dataKey="2025" name="2025" fill="#93C5FD" radius={[2, 2, 0, 0]} />
          <Bar dataKey="2026" name="2026" fill="#2563EB" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
