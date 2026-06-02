'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface MonthPoint {
  month: string
  b2he: number
  b2g: number
}

export default function BookingsTrendChart({ data }: { data: MonthPoint[] }) {
  const hasData = data.some((d) => d.b2he + d.b2g > 0)

  if (!hasData) {
    return (
      <div>
        <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
          YTD Bookings Trend
        </div>
        <div className="text-[11px] text-slate-400 mb-3">Monthly B2HE vs B2G</div>
        <div className="h-[180px] flex items-center justify-center text-slate-300 text-sm">No data yet</div>
      </div>
    )
  }

  return (
    <div>
      <div className="font-display text-[12px] font-bold text-slate-900 uppercase tracking-[0.5px] mb-0.5">
        YTD Bookings Trend
      </div>
      <div className="text-[11px] text-slate-400 mb-3">Monthly B2HE vs B2G</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v, name) => [v, name === 'b2he' ? 'B2HE' : 'B2G']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(val) => (val === 'b2he' ? 'B2HE' : 'B2G')}
          />
          <Line
            type="monotone"
            dataKey="b2he"
            name="b2he"
            stroke="#2563EB"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="b2g"
            name="b2g"
            stroke="#7C3AED"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
