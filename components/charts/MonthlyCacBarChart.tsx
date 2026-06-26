'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

interface MonthlyCacPoint {
  month: string
  cac: number
  enrollments: number
}

interface Props { data: MonthlyCacPoint[] }

const fmtCac = (v: unknown) => {
  const n = Number(v)
  if (!n) return ''
  return n >= 1000 ? `$${(n / 1000).toFixed(2)}K` : `$${n.toFixed(2)}`
}

export default function MonthlyCacBarChart({ data }: Props) {
  const hasData = data.some((d) => d.cac > 0 || d.enrollments > 0)

  if (!hasData) {
    return (
      <div>
        <p className="font-display text-[13px] font-bold text-slate-900 mb-0.5">Monthly CAC</p>
        <p className="text-[11px] text-slate-400 mb-3">Blended · last 12 months</p>
        <div className="h-[210px] flex items-center justify-center text-slate-300 text-sm">
          No data — run HubSpot sync first
        </div>
      </div>
    )
  }

  const hasSpend = data.some((d) => d.cac > 0)
  const chartData = hasSpend
    ? data.map((d) => ({ month: d.month, value: d.cac }))
    : data.map((d) => ({ month: d.month, value: d.enrollments }))

  const subtitle = hasSpend ? 'Blended · last 12 months' : 'Enrollments (no spend data yet)'
  const yTickFmt = hasSpend
    ? (v: number) => `$${(v / 1000).toFixed(0)}K`
    : (v: number) => String(v)

  return (
    <div>
      <p className="font-display text-[13px] font-bold text-slate-900 mb-0.5">Monthly CAC</p>
      <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
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
            width={36}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            formatter={(v: unknown) => [hasSpend ? fmtCac(v) : `${Number(v)} enrollments`, 'Blended CAC']}
          />
          <Bar dataKey="value" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={22}>
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 8.5, fill: '#374151', fontWeight: 600 }}
              formatter={hasSpend ? fmtCac : (v: unknown) => (Number(v) > 0 ? String(Number(v)) : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
