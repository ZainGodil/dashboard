import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import type { Period } from '@/lib/metrics/periods'
import StatCard from '@/components/ui/StatCard'
import SpendFilterBar from '../SpendFilterBar'
import CampaignsTable from '@/components/spend/CampaignsTable'

interface PageProps {
  searchParams: { period?: string; university?: string }
}

function getDateRange(period: Period): { startDate: string; endDate: string } {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  if (period === '90d') {
    const s = new Date(today); s.setDate(s.getDate() - 90)
    return { startDate: s.toISOString().split('T')[0], endDate: todayStr }
  }
  if (period === 'ytd') return { startDate: `${today.getFullYear()}-01-01`, endDate: todayStr }
  if (period === 'last_month') {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const e = new Date(today.getFullYear(), today.getMonth(), 0)
    return { startDate: s.toISOString().split('T')[0], endDate: e.toISOString().split('T')[0] }
  }
  return { startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0], endDate: todayStr }
}

const PERIOD_LABELS: Record<Period, string> = { mtd: 'MTD', last_month: 'Last Mo.', '90d': '90-Day', ytd: 'YTD' }

export default async function GoogleSpendPage({ searchParams }: PageProps) {
  const period = (searchParams.period ?? 'mtd') as Period
  const university = searchParams.university ?? ''
  const supabase = createAdminClient()
  const { startDate, endDate } = getDateRange(period)

  let q = supabase
    .from('ad_spend')
    .select('date, campaign_name, university, course, segment, spend, impressions, clicks')
    .eq('platform', 'google')
    .gte('date', startDate)
    .lte('date', endDate)
  if (university) q = q.eq('university', university)

  const [{ data }, { data: overridesData }] = await Promise.all([
    q.order('spend', { ascending: false }),
    supabase.from('campaign_overrides').select('campaign_name, course, university').eq('platform', 'google'),
  ])
  const rows = data ?? []
  const overrideMap = new Map((overridesData ?? []).map((o) => [o.campaign_name, o]))

  const totalSpend = rows.reduce((s, r) => s + Number(r.spend), 0)
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0)
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
  const uniqueCampaigns = new Set(rows.map((r) => r.campaign_name)).size

  // Aggregate by university × course (override takes precedence per campaign)
  const aggMap = new Map<string, { spend: number; impressions: number; clicks: number }>()
  for (const r of rows) {
    const ov = overrideMap.get(r.campaign_name ?? '')
    const uni = ov?.university ?? r.university ?? 'Unknown'
    const course = ov?.course ?? r.course ?? 'General'
    const key = `${uni}|||${course}`
    const cur = aggMap.get(key) ?? { spend: 0, impressions: 0, clicks: 0 }
    aggMap.set(key, {
      spend: cur.spend + Number(r.spend),
      impressions: cur.impressions + (r.impressions ?? 0),
      clicks: cur.clicks + (r.clicks ?? 0),
    })
  }

  const tableRows = Array.from(aggMap.entries())
    .map(([key, d]) => {
      const [uni, course] = key.split('|||')
      return { university: uni, course, ...d, cpc: d.clicks > 0 ? d.spend / d.clicks : 0 }
    })
    .sort((a, b) => b.spend - a.spend)

  // All campaigns (aggregate across dates, overrides applied)
  const campaignMap = new Map<string, { spend: number; university: string | null; course: string | null }>()
  for (const r of rows) {
    const name = r.campaign_name ?? 'Unknown'
    const ov = overrideMap.get(name)
    const cur = campaignMap.get(name) ?? {
      spend: 0,
      university: ov?.university ?? r.university,
      course: ov?.course ?? r.course,
    }
    campaignMap.set(name, { ...cur, spend: cur.spend + Number(r.spend) })
  }
  const allCampaigns = Array.from(campaignMap.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.spend - a.spend)

  const periodLabel = PERIOD_LABELS[period]

  return (
    <div>
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-6 gap-3 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="font-display text-[15px] font-bold text-slate-900 tracking-tight">Google Spend</h1>
        <div className="flex-1" />
        <Suspense>
          <SpendFilterBar />
        </Suspense>
      </header>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label={`Total Spend ${periodLabel}`} value={totalSpend > 0 ? `$${Math.round(totalSpend).toLocaleString()}` : ''} accent="blue" />
          <StatCard label="Active Campaigns" value={uniqueCampaigns.toLocaleString()} accent="teal" />
          <StatCard label="Impressions" value={totalImpressions.toLocaleString()} accent="green" />
          <StatCard label="Avg CPC" value={avgCpc > 0 ? `$${avgCpc.toFixed(2)}` : ''} accent="amber" />
        </div>

        {/* Spend by Campus × Program */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200">
            <span className="font-display text-[13px] font-bold text-slate-900">Spend by Campus × Program</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-semibold">Campus</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Program</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Spend</th>
                  <th className="text-right px-4 py-2.5 font-semibold">% of Total</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Impressions</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Clicks</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Avg CPC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{r.university}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.course}</td>
                    <td className="px-4 py-2.5 text-right text-slate-800 font-semibold tabular-nums">${Math.round(r.spend).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {totalSpend > 0 ? `${((r.spend / totalSpend) * 100).toFixed(1)}%` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{r.cpc > 0 ? `$${r.cpc.toFixed(2)}` : ''}</td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-[12px]">No data for this period</td></tr>
                )}
              </tbody>
              {tableRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-700 text-[12px]">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">${Math.round(totalSpend).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">100%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{totalImpressions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{totalClicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{avgCpc > 0 ? `$${avgCpc.toFixed(2)}` : ''}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* All Campaigns */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="font-display text-[13px] font-bold text-slate-900">Campaigns by Spend</span>
            <span className="text-[11px] text-slate-400">{allCampaigns.length} campaigns</span>
          </div>
          <CampaignsTable campaigns={allCampaigns} totalSpend={totalSpend} platform="google" />
        </div>
      </div>
    </div>
  )
}
