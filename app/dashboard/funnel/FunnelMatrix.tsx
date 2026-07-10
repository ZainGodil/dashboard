'use client'

import { Fragment } from 'react'
import type { AdvisorFunnelRow } from './page'
import { FUNNEL_STAGES } from '@/lib/funnel/stages'

const GROUP_LABELS: Record<string, string> = {
  INTAKE: 'Intake',
  CONTACT: 'Contact',
  APPOINTMENTS: 'Appointments',
  OUTCOME: 'Outcome',
}

function pctStr(val: number | null): string | null {
  return val === null ? null : `${Math.round(val * 100)}%`
}

const processedStages = FUNNEL_STAGES.map((stage, i) => ({
  ...stage,
  isGroupFirst: i === 0 || FUNNEL_STAGES[i - 1].group !== stage.group,
}))

export default function FunnelMatrix({ advisors, total }: { advisors: AdvisorFunnelRow[]; total: AdvisorFunnelRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[11px]" style={{ minWidth: `${200 + (advisors.length + 1) * 110}px` }}>
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 text-left px-4 py-2 border-b border-r border-slate-200 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold" style={{ minWidth: 180 }}>
              Stage
            </th>
            <th colSpan={2} className="px-2 py-2 border-b border-r border-slate-200 text-center text-[10px] uppercase tracking-[0.7px] text-slate-500 font-semibold">
              Total
            </th>
            {advisors.map(({ advisor }) => (
              <th key={advisor} colSpan={2} className="px-2 py-2 border-b border-r border-slate-200 text-center text-[10px] tracking-[0.4px] text-slate-700 font-semibold">
                {advisor}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 border-b border-r border-slate-200" />
            <SubHeader label="Count" border={false} />
            <SubHeader label="%" border={true} />
            {advisors.map(({ advisor }) => (
              <Fragment key={advisor}>
                <SubHeader label="Count" border={false} />
                <SubHeader label="%" border={true} />
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedStages.map((stage) => {
            const rowBg = stage.highlight === 'blue' ? 'bg-blue-50/50' : stage.highlight === 'green' ? 'bg-emerald-50/50' : 'bg-white'
            const labelCls = stage.highlight === 'blue'
              ? 'text-blue-700 font-semibold'
              : stage.highlight === 'green'
              ? 'text-emerald-700 font-semibold'
              : stage.subtract
              ? 'text-slate-400 pl-6'
              : 'text-slate-700'

            const totalPct = stage.percentKey ? total.percents[stage.percentKey] : null

            return (
              <Fragment key={stage.key}>
                {stage.isGroupFirst && (
                  <tr>
                    <td
                      colSpan={2 + (advisors.length + 1) * 2}
                      className="px-4 py-1 text-[9px] uppercase tracking-[0.9px] text-slate-500 font-bold bg-slate-100 border-b border-slate-200"
                    >
                      {GROUP_LABELS[stage.group]}
                    </td>
                  </tr>
                )}
                <tr className={`${rowBg} border-b border-slate-100 hover:bg-slate-50/50`}>
                  <td className={`sticky left-0 ${rowBg} px-4 py-2 border-r border-slate-200 text-[11px] ${labelCls}`}>
                    {stage.subtract && <span className="text-slate-400 mr-1">−</span>}
                    {stage.label}
                  </td>
                  <Num val={total.counts[stage.key]} />
                  <PctCell val={pctStr(totalPct)} border />
                  {advisors.map(({ advisor, counts, percents }) => {
                    const pct = stage.percentKey ? percents[stage.percentKey] : null
                    return (
                      <Fragment key={advisor}>
                        <Num val={counts[stage.key]} />
                        <PctCell val={pctStr(pct)} border />
                      </Fragment>
                    )
                  })}
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SubHeader({ label, border }: { label: string; border: boolean }) {
  return (
    <th className={`px-3 py-1.5 border-b text-right text-[9px] text-slate-400 font-medium ${border ? 'border-r border-slate-200' : 'border-slate-200'}`} style={{ width: 52 }}>
      {label}
    </th>
  )
}

function Num({ val }: { val: number }) {
  return (
    <td className="px-3 py-2 text-right font-mono text-slate-600 text-[11px]">
      {val > 0 ? val.toLocaleString() : <span className="text-slate-200">—</span>}
    </td>
  )
}

function PctCell({ val, border }: { val: string | null; border?: boolean }) {
  return (
    <td className={`px-3 py-2 text-right font-mono text-slate-400 text-[11px] ${border ? 'border-r border-slate-200' : ''}`}>
      {val ?? <span className="text-slate-200">—</span>}
    </td>
  )
}
