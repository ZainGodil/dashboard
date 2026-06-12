'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'

interface MonthlyCacPoint {
  month: string
  B2C: number
  WFD: number
  B2C_enroll: number
  WFD_enroll: number
}

interface Props { data: MonthlyCacPoint[] }

const fmtCac = (v: unknown) => {
  const n = Number(v)
  if (!n) return ''
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`
}

const fmtCount = (v: unknown) => {
  const n = Number(v)
  return n > 0 ? String(n) : ''
}

export default function MonthlyCacBarChart({ data }: Props) {
  const hasSpend = data.some((d) => d.B2C > 0 || d.WFD > 0)
  const hasEnroll = data.some((d) => d.B2C_enroll > 0 || d.WFD_enroll > 0)

  if (!hasSpend && !hasEnroll) {
    return (
      <div>
        <p className="font-display text-[13px] font-bold text-slate-900 mb-0.5">Monthly CAC</p>
        <p className="text-[11px] text-slate-400 mb-3">B2C vs WFD, last 12 months</p>
        <div className="h-[210px] flex items-center justify-center text-slate-300 text-sm">
          No data — run HubSpot sync first
        </div>
      </div>
    )
  }

  // When no spend yet, show enrollment counts as bars instead of CAC
  const showEnroll = !hasSpend && hasEnroll
  const chartData = showEnroll
    ? data.map((d) => ({ month: d.month, B2C: d.B2C_enroll, WFD: d.WFD_enroll }))
    : data.map((d) => ({ month: d.month, B2C: d.B2C, WFD: d.WFD }))

  const subtitle = showEnroll ? 'Enrollments by segment (no spend data yet)' : 'B2C vs WFD, last 12 months'
  const fmt = showEnroll ? fmtCount : fmtCac
  const yTickFmt = showEnroll
    ? (v: number) => String(v)
    : (v: number) => `$${(v / 1000).toFixed(0)}K`

  return (
    <div>
      <p className="font-display text-[13px] font-bold text-slate-900 mb-0.5">Monthly CAC</p>
      <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={yTickFmt}
            width={34}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v: unknown) => [showEnroll ? `${Number(v)} enrollments` : fmtCac(v), '']}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Bar dataKey="B2C" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={18}>
            <LabelList dataKey="B2C" position="top" style={{ fontSize: 8.5, fill: '#374151', fontWeight: 600 }} formatter={fmt} />
          </Bar>
          <Bar dataKey="WFD" fill="#1E3A5F" radius={[3, 3, 0, 0]} maxBarSize={18}>
            <LabelList dataKey="WFD" position="top" style={{ fontSize: 8.5, fill: '#374151', fontWeight: 600 }} formatter={fmt} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
