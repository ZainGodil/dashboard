'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

interface Props { data: { month: string; days: number }[] }

export default function SalesCycleChart({ data }: Props) {
  const visible = data.filter((d) => d.days > 0)
  const min = visible.length ? Math.max(0, Math.min(...visible.map((d) => d.days)) - 2) : 0
  const max = visible.length ? Math.max(...visible.map((d) => d.days)) + 4 : 30

  return (
    <div>
      <p className="font-display text-[13px] font-bold text-slate-900 mb-0.5">Sales Cycle</p>
      <p className="text-[11px] text-slate-400 mb-3">Avg days lead → enrollment</p>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            interval={1}
            height={52}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}d`}
            width={30}
            domain={[min, max]}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v: unknown) => [`${Number(v)} days`, 'Avg Sales Cycle']}
          />
          <Line
            type="linear"
            dataKey="days"
            stroke="#1E3A5F"
            strokeWidth={2}
            dot={{ r: 3, fill: '#1E3A5F', stroke: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: '#1E3A5F' }}
            connectNulls={false}
          >
            <LabelList
              dataKey="days"
              position="top"
              style={{ fontSize: 9, fill: '#374151', fontWeight: 700 }}
              formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : '')}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
