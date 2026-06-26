'use client'

import { useEffect, useState, useCallback } from 'react'

interface Goal {
  id: string
  period_type: 'monthly' | 'yearly'
  period: string
  spend_target: number | null
  leads_target: number | null
  enrollments_target: number | null
}

interface RowState {
  spend_target: string
  leads_target: string
  enrollments_target: string
  saving: boolean
  saved: boolean
  error: string | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS = ['2024', '2025', '2026', '2027']

function makeMonthlyPeriods(year: string): string[] {
  const yr = year.slice(2)
  return MONTHS.map((m) => `${m}-${yr}`)
}

function emptyRow(): RowState {
  return { spend_target: '', leads_target: '', enrollments_target: '', saving: false, saved: false, error: null }
}

function goalToRow(g: Goal | undefined): RowState {
  if (!g) return emptyRow()
  return {
    spend_target: g.spend_target != null ? String(g.spend_target) : '',
    leads_target: g.leads_target != null ? String(g.leads_target) : '',
    enrollments_target: g.enrollments_target != null ? String(g.enrollments_target) : '',
    saving: false,
    saved: false,
    error: null,
  }
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('2026')
  const [rows, setRows] = useState<Record<string, RowState>>({})

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/goals')
    const data: Goal[] = await res.json()
    setGoals(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  // Re-initialise rows whenever goals or year changes
  useEffect(() => {
    const goalMap = new Map(goals.map((g) => [`${g.period_type}:${g.period}`, g]))
    const next: Record<string, RowState> = {}

    // Yearly row
    next[`yearly:${year}`] = goalToRow(goalMap.get(`yearly:${year}`))

    // Monthly rows for selected year
    for (const period of makeMonthlyPeriods(year)) {
      next[`monthly:${period}`] = goalToRow(goalMap.get(`monthly:${period}`))
    }

    setRows(next)
  }, [goals, year])

  function setField(key: string, field: keyof RowState, value: string) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value, saved: false, error: null } }))
  }

  async function save(period_type: 'monthly' | 'yearly', period: string) {
    const key = `${period_type}:${period}`
    const row = rows[key]
    if (!row) return

    setRows((prev) => ({ ...prev, [key]: { ...prev[key], saving: true, error: null } }))

    const payload = {
      period_type,
      period,
      spend_target: row.spend_target !== '' ? Number(row.spend_target) : null,
      leads_target: row.leads_target !== '' ? Number(row.leads_target) : null,
      enrollments_target: row.enrollments_target !== '' ? Number(row.enrollments_target) : null,
    }

    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      setRows((prev) => ({ ...prev, [key]: { ...prev[key], saving: false, error: err.error ?? 'Save failed' } }))
      return
    }

    const updated: Goal = await res.json()
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.period_type === period_type && g.period === period)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated]
    })
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], saving: false, saved: true } }))
    setTimeout(() => setRows((prev) => ({ ...prev, [key]: { ...prev[key], saved: false } })), 2000)
  }

  const inputCls = 'w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 tabular-nums'

  function GoalRow({ period_type, period, label }: { period_type: 'monthly' | 'yearly'; period: string; label: string }) {
    const key = `${period_type}:${period}`
    const row = rows[key] ?? emptyRow()

    return (
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-4 py-2.5 text-[13px] font-medium text-slate-700 w-24">{label}</td>
        <td className="px-3 py-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]">$</span>
            <input
              type="number"
              min="0"
              step="100"
              className={`${inputCls} pl-6`}
              placeholder="—"
              value={row.spend_target}
              onChange={(e) => setField(key, 'spend_target', e.target.value)}
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            min="0"
            className={inputCls}
            placeholder="—"
            value={row.leads_target}
            onChange={(e) => setField(key, 'leads_target', e.target.value)}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            min="0"
            className={inputCls}
            placeholder="—"
            value={row.enrollments_target}
            onChange={(e) => setField(key, 'enrollments_target', e.target.value)}
          />
        </td>
        <td className="px-4 py-2 text-right">
          {row.error && <span className="text-[11px] text-red-500 mr-2">{row.error}</span>}
          {row.saved && (
            <span className="text-[11px] text-emerald-600 mr-2 flex items-center gap-1 inline-flex">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
              Saved
            </span>
          )}
          <button
            onClick={() => save(period_type, period)}
            disabled={row.saving}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {row.saving ? 'Saving…' : 'Save'}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-3 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Goals</h1>
        <div className="flex-1" />
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Loading…</div>
      ) : (
        <div className="p-6 space-y-6">

          {/* Yearly goal */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Yearly Target — {year}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold w-24">Period</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Spend Target</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Leads Target</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Enrollments Target</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                <GoalRow period_type="yearly" period={year} label={year} />
              </tbody>
            </table>
          </div>

          {/* Monthly goals */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Monthly Targets — {year}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold w-24">Month</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Spend Target</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Leads Target</th>
                  <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Enrollments Target</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {makeMonthlyPeriods(year).map((period) => (
                  <GoalRow key={period} period_type="monthly" period={period} label={period} />
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}
