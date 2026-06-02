'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DayPoint {
  day: string
  actual: number
  pace: number
}

interface DailyLeadsChartProps {
  data: DayPoint[]
}

export default function DailyLeadsChart({ data }: DailyLeadsChartProps) {
  if (!data.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">
        No daily data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          formatter={(v, name) => [Number(v).toFixed(name === 'pace' ? 1 : 0), name === 'pace' ? 'Goal pace' : 'Leads']}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(val) => val === 'pace' ? 'Goal pace' : 'Actual leads'}
        />
        <Bar dataKey="actual" name="actual" fill="#2563EB" opacity={0.85} radius={[2, 2, 0, 0]} />
        <Line dataKey="pace" name="pace" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
