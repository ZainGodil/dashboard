'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface MonthPoint {
  month: string
  actual: number
  target?: number | null
}

interface MonthlyTrendChartProps {
  data: MonthPoint[]
  title: string
  color?: string
}

export default function MonthlyTrendChart({ data, title, color = '#2563EB' }: MonthlyTrendChartProps) {
  const hasTarget = data.some((d) => d.target != null && d.target > 0)

  if (!data.length || data.every((d) => d.actual === 0)) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">{title}</div>
        <div className="text-[11px] text-slate-400 mb-3">YTD monthly</div>
        <div className="h-[180px] flex items-center justify-center text-slate-300 text-sm">No data yet</div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-400 mb-3">YTD monthly</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v, name) => [Number(v).toLocaleString(), name === 'target' ? 'Target' : 'Actual']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(val) => val === 'target' ? 'Target' : 'Actual'}
          />
          <Line type="monotone" dataKey="actual" name="actual" stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          {hasTarget && (
            <Line type="monotone" dataKey="target" name="target" stroke="#CBD5E1" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
