'use client'

import type { ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts'
import { FUNNEL_CHART_STAGES, type StageCounts } from '@/lib/funnel/stages'

export default function FunnelBarChart({ counts, title }: { counts: StageCounts; title: string }) {
  const data = FUNNEL_CHART_STAGES.map((stage) => ({ name: stage.label, value: counts[stage.key] }))

  return (
    <div>
      <div className="text-center text-[12px] font-semibold text-slate-700 mb-1">{title}</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 10, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
          <Bar dataKey="value" fill="#1E5F8C" radius={[0, 2, 2, 0]} barSize={14}>
            <LabelList
              dataKey="value"
              position="insideLeft"
              fill="#fff"
              fontSize={10}
              formatter={(v?: ReactNode) => (typeof v === 'number' && v > 0 ? v : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
