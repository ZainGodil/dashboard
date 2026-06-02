'use client'

import { Fragment } from 'react'
import type { AdvisorFunnel } from './page'

interface StageRow {
  key: string
  group: string
  label: string
  highlight?: 'blue' | 'green'
  subtract?: boolean
  computed?: boolean
}

const STAGES: StageRow[] = [
  { key: 'total',           group: 'INTAKE',        label: 'Total Assigned' },
  { key: 'non_viable',      group: 'INTAKE',        label: 'Non Viable',             subtract: true },
  { key: 'unqualified',     group: 'INTAKE',        label: 'Unqualified',            subtract: true },
  { key: 'viable',          group: 'INTAKE',        label: 'Viable Leads',           highlight: 'blue' },
  { key: 'email_text',      group: 'CONTACT',       label: 'Email / Text' },
  { key: 'connected',       group: 'CONTACT',       label: 'Connected' },
  { key: 'bad_timing',      group: 'CONTACT',       label: 'Bad Timing' },
  { key: 'on_hold',         group: 'CONTACT',       label: 'On Hold' },
  { key: 'consult_booked',  group: 'APPOINTMENTS',  label: 'Career Consult Booked' },
  { key: 'no_show',         group: 'APPOINTMENTS',  label: 'Interview No Show',      subtract: true },
  { key: 'appt_attended',   group: 'APPOINTMENTS',  label: 'Appt Attended (net)',    computed: true },
  { key: 'in_progress',     group: 'APPOINTMENTS',  label: 'In Progress' },
  { key: 'booked_decision', group: 'DECISION',      label: 'Booked Decision Appt' },
  { key: 'open_deal',       group: 'DECISION',      label: 'Open Deal' },
  { key: 'enrolled',        group: 'OUTCOME',       label: 'Enrolled',               highlight: 'green' },
]

const GROUP_LABELS: Record<string, string> = {
  INTAKE: 'Intake',
  CONTACT: 'Contact',
  APPOINTMENTS: 'Appointments',
  DECISION: 'Decision',
  OUTCOME: 'Outcome',
}

const NO_PCT_KEYS = new Set(['total', 'non_viable', 'unqualified', 'viable'])

function getCount(counts: Record<string, number>, key: string): number {
  if (key === 'appt_attended') return Math.max(0, (counts.consult_booked ?? 0) - (counts.no_show ?? 0))
  return counts[key] ?? 0
}

function pctStr(n: number, viable: number): string {
  return viable > 0 ? `${Math.round(n / viable * 100)}%` : '—'
}

// Pre-flag first row of each group to avoid mutation in render
const processedStages = STAGES.map((stage, i) => ({
  ...stage,
  isGroupFirst: i === 0 || STAGES[i - 1].group !== stage.group,
}))

export default function FunnelMatrix({ advisors }: { advisors: AdvisorFunnel[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[11px]" style={{ minWidth: `${200 + advisors.length * 140}px` }}>
        <thead>
          {/* Advisor group headers */}
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 text-left px-4 py-2 border-b border-r border-slate-200 text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold" style={{ minWidth: 180 }}>
              Stage
            </th>
            <th colSpan={3} className="px-2 py-2 border-b border-r border-slate-200 text-center text-[10px] uppercase tracking-[0.7px] text-slate-500 font-semibold">
              Total
            </th>
            {advisors.map(({ advisor }) => (
              <th key={advisor} colSpan={3} className="px-2 py-2 border-b border-r border-slate-200 text-center text-[10px] tracking-[0.4px] text-slate-700 font-semibold">
                {advisor}
              </th>
            ))}
          </tr>
          {/* B2C / WFD / % sub-headers */}
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 border-b border-r border-slate-200" />
            <SubHeader label="B2C" border={false} />
            <SubHeader label="WFD" border={false} />
            <SubHeader label="%" border={true} />
            {advisors.map(({ advisor }) => (
              <Fragment key={advisor}>
                <SubHeader label="B2C" border={false} />
                <SubHeader label="WFD" border={false} />
                <SubHeader label="%" border={true} />
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedStages.map((stage) => {
            const totalB2c = advisors.reduce((s, a) => s + getCount(a.b2c, stage.key), 0)
            const totalWfd = advisors.reduce((s, a) => s + getCount(a.wfd, stage.key), 0)
            const totalViable = advisors.reduce((s, a) => s + (a.b2c.viable ?? 0) + (a.wfd.viable ?? 0), 0)
            const totalCount = totalB2c + totalWfd

            const rowBg = stage.highlight === 'blue' ? 'bg-blue-50/50' : stage.highlight === 'green' ? 'bg-emerald-50/50' : 'bg-white'
            const labelCls = stage.highlight === 'blue'
              ? 'text-blue-700 font-semibold'
              : stage.highlight === 'green'
              ? 'text-emerald-700 font-semibold'
              : stage.subtract
              ? 'text-slate-400 pl-6'
              : 'text-slate-700'

            return (
              <Fragment key={stage.key}>
                {stage.isGroupFirst && (
                  <tr>
                    <td
                      colSpan={4 + advisors.length * 3}
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
                  {/* Totals */}
                  <Num val={totalB2c} />
                  <Num val={totalWfd} />
                  <PctCell val={NO_PCT_KEYS.has(stage.key) ? null : pctStr(totalCount, totalViable)} border />
                  {/* Per advisor */}
                  {advisors.map(({ advisor, b2c, wfd }) => {
                    const aB2c = getCount(b2c, stage.key)
                    const aWfd = getCount(wfd, stage.key)
                    const aViable = (b2c.viable ?? 0) + (wfd.viable ?? 0)
                    return (
                      <Fragment key={advisor}>
                        <Num val={aB2c} />
                        <Num val={aWfd} />
                        <PctCell val={NO_PCT_KEYS.has(stage.key) ? null : pctStr(aB2c + aWfd, aViable)} border />
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
    <th className={`px-3 py-1.5 border-b text-right text-[9px] text-slate-400 font-medium ${border ? 'border-r border-slate-200' : 'border-slate-200'}`} style={{ width: 44 }}>
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
