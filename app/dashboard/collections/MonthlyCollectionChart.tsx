'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CollectionPoint {
  month: string
  expected: number
  collected: number
}

interface MonthlyCollectionChartProps {
  data: CollectionPoint[]
}

export default function MonthlyCollectionChart({ data }: MonthlyCollectionChartProps) {
  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">Monthly Collection 2026</div>
      <div className="text-[11px] text-slate-400 mb-3">Expected (Total Collection) vs Collected (Cash Received) · Aug is part-month, Sep–Dec not yet due</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v, name) => [`$${Math.round(Number(v)).toLocaleString()}`, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => <span className="text-slate-500">{value}</span>}
          />
          <Bar dataKey="expected" name="Expected" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="collected" name="Collected" fill="#2563EB" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
