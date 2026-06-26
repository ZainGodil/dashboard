'use client'

import { useState } from 'react'

const COURSE_OPTIONS = [
  'Digital Marketing',
  'UI/UX Design',
  'Generative AI Data Analyst',
  'General',
] as const

interface Campaign {
  name: string
  university: string | null
  course: string | null
  spend: number
}

interface Props {
  campaigns: Campaign[]
  totalSpend: number
  platform: 'google' | 'meta'
}

export default function CampaignsTable({ campaigns: initial, totalSpend, platform }: Props) {
  const [campaigns, setCampaigns] = useState(initial)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function updateProgram(name: string, course: string | null) {
    setSaving((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: '' }))

    const res = await fetch('/api/campaigns/program', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_name: name, platform, course: course || null }),
    })

    if (res.ok) {
      setCampaigns((prev) =>
        prev.map((c) => (c.name === name ? { ...c, course: course || null } : c))
      )
    } else {
      const err = await res.json() as { error?: string }
      setErrors((prev) => ({ ...prev, [name]: err.error ?? 'Save failed' }))
    }

    setSaving((prev) => ({ ...prev, [name]: false }))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-semibold w-8">#</th>
            <th className="text-left px-4 py-2.5 font-semibold">Campaign</th>
            <th className="text-left px-4 py-2.5 font-semibold">Campus</th>
            <th className="text-left px-4 py-2.5 font-semibold">Program</th>
            <th className="text-right px-4 py-2.5 font-semibold">Spend</th>
            <th className="text-right px-4 py-2.5 font-semibold">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((c, i) => (
            <tr key={c.name} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2.5 text-slate-400 tabular-nums text-[11px]">{i + 1}</td>
              <td className="px-4 py-2.5 text-slate-700 font-mono text-[11px] max-w-[320px] truncate" title={c.name}>
                {c.name}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{c.university ?? '—'}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={c.course ?? ''}
                    onChange={(e) => updateProgram(c.name, e.target.value || null)}
                    disabled={saving[c.name]}
                    className="px-2 py-1 rounded border border-slate-200 text-[12px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">—</option>
                    {COURSE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {saving[c.name] && (
                    <svg className="animate-spin w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  )}
                  {errors[c.name] && (
                    <span className="text-[10px] text-red-500">{errors[c.name]}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-slate-800 font-semibold tabular-nums">
                ${Math.round(c.spend).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                {totalSpend > 0 ? `${((c.spend / totalSpend) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-[12px]">
                No data for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
