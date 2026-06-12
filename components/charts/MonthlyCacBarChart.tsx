'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface MonthlyCacPoint { month: string; B2C: number; WFD: number }

interface Props { data: MonthlyCacPoint[] }

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : v > 0 ? `$${v}` : '—'

export default function MonthlyCacBarChart({ data }: Props) {
  const hasData = data.some(d => d.B2C > 0 || d.WFD > 0)

  if (!hasData) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
          Monthly CAC
        </div>
        <div className="text-[11px] text-slate-400 mb-3">B2C vs WFD, last 12 months</div>
        <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">
          No data — run HubSpot sync first
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
        Monthly CAC
      </div>
      <div className="text-[11px] text-slate-400 mb-3">B2C vs WFD, last 12 months</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            width={36}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v) => [fmt(Number(v)), '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="B2C" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="WFD" fill="#1E3A5F" radius={[3, 3, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
