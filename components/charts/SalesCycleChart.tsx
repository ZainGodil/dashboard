'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface SalesCyclePoint { month: string; days: number }

interface Props { data: SalesCyclePoint[] }

export default function SalesCycleChart({ data }: Props) {
  const avg = data.length
    ? Math.round(data.filter(d => d.days > 0).reduce((s, d) => s + d.days, 0) / (data.filter(d => d.days > 0).length || 1))
    : 0

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
        Sales Cycle
      </div>
      <div className="text-[11px] text-slate-400 mb-3">Avg days lead → enrollment, per month</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}d`}
            width={32}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v) => [`${Number(v)} days`, 'Avg Sales Cycle']}
          />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke="#94A3B8"
              strokeDasharray="4 4"
              label={{ value: `avg ${avg}d`, position: 'insideTopRight', fontSize: 10, fill: '#94A3B8' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="days"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
