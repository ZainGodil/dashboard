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
  total?: { label: string; keys: string[] } // extra last line in the hover box, adding up these series
}

const dollars = (v: unknown) => `$${Math.round(Number(v) || 0).toLocaleString()}`
// Very light bar colours (e.g. the grey "Expected" bars) are unreadable as text, so darken them
const textColor = (c: string) => (c.toUpperCase() === '#CBD5E1' ? '#64748B' : c)

export default function MonthlyCollectionChart({ title, subtitle, data, series, total }: MonthlyCollectionChartProps) {
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
            content={({ active, label }) => {
              const row = active ? data.find((d) => d.month === label) : undefined
              if (!row) return null
              return (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2 text-[12px] leading-relaxed">
                  <div className="text-slate-900 mb-0.5">{String(label)}</div>
                  {series.map((s) => (
                    <div key={s.key} style={{ color: textColor(s.color) }}>
                      {s.name} : {dollars(row[s.key])}
                    </div>
                  ))}
                  {total && (
                    <div className="mt-1 pt-1 border-t border-slate-200 font-semibold text-slate-900">
                      {total.label} : {dollars(total.keys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0))}
                    </div>
                  )}
                </div>
              )
            }}
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
