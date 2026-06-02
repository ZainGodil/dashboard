'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface L2EPoint {
  month: string
  'Paid Search': number
  'Paid Social': number
}

interface L2ETrendChartProps {
  data: L2EPoint[]
}

export default function L2ETrendChart({ data }: L2ETrendChartProps) {
  const hasData = data.some((d) => d['Paid Search'] > 0 || d['Paid Social'] > 0)

  if (!hasData) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">L2E% Trend</div>
        <div className="text-[11px] text-slate-400 mb-3">12-month · Paid Search vs Paid Social</div>
        <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">No data — run HubSpot sync first</div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">L2E% Trend</div>
      <div className="text-[11px] text-slate-400 mb-3">12-month · Paid Search vs Paid Social</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v) => [`${Number(v).toFixed(1)}%`, '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Line type="monotone" dataKey="Paid Search" stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="Paid Social" stroke="#0891B2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
