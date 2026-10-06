'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface ChartSeries {
  key: string
  name: string
  color: string
  stackId?: string // series sharing a stackId are drawn as one stacked bar
}

interface MonthlyCollectionChartProps {
  title: string
  subtitle: string
  data: Record<string, string | number>[]
  series: ChartSeries[]
}

export default function MonthlyCollectionChart({ title, subtitle, data, series }: MonthlyCollectionChartProps) {
  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-400 mb-3">{subtitle}</div>
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
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stackId} radius={s.stackId ? 0 : [3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
