'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface AdvisorBar {
  advisor: string
  b2he: number
  b2g: number
}

export default function BookingsChart({ data }: { data: AdvisorBar[] }) {
  if (!data.length || data.every((d) => d.b2he + d.b2g === 0)) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">
        No bookings data yet
      </div>
    )
  }

  const height = Math.max(180, data.length * 48)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="advisor"
          tick={{ fontSize: 11, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          formatter={(v, name) => [v, name === 'b2he' ? 'B2C' : 'WFD']}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(val) => (val === 'b2he' ? 'B2C' : 'WFD')}
        />
        <Bar dataKey="b2he" name="b2he" fill="#2563EB" stackId="a" />
        <Bar dataKey="b2g" name="b2g" fill="#7C3AED" stackId="a" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
