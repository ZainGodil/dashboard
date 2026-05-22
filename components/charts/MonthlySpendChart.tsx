'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SpendPoint {
  month: string
  google: number
  meta: number
}

interface MonthlySpendChartProps {
  data: SpendPoint[]
}

export default function MonthlySpendChart({ data }: MonthlySpendChartProps) {
  if (!data.length || data.every((d) => d.google === 0 && d.meta === 0)) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Monthly Ad Spend</div>
        <div className="text-[11px] text-slate-400 mb-3">Google vs Meta</div>
        <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">No spend data yet — connect Google Ads & Meta</div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Monthly Ad Spend</div>
      <div className="text-[11px] text-slate-400 mb-3">Google vs Meta</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v) => [`$${Number(v).toLocaleString()}`, '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="google" name="Google" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="meta" name="Meta" stackId="a" fill="#0891B2" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
