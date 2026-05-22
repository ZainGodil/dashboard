'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CacTrendChartProps {
  data: Record<string, string | number>[]
}

const COLORS = ['#2563EB', '#0891B2', '#059669', '#D97706']
const COURSES = ['Digital Marketing', 'UI/UX Design', 'Generative AI Data Analyst', 'General']

export default function CacTrendChart({ data }: CacTrendChartProps) {
  if (!data.length) {
    return <EmptyChart title="CAC Trend" subtitle="6-month rolling, per SBU" />
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">CAC Trend</div>
      <div className="text-[11px] text-slate-400 mb-3">6-month rolling, per SBU</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v) => [`$${Number(v).toLocaleString()}`, '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {COURSES.map((course, i) => (
            <Line
              key={course}
              type="monotone"
              dataKey={course}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyChart({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-400 mb-3">{subtitle}</div>
      <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">No data — run HubSpot sync first</div>
    </div>
  )
}
