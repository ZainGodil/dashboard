import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCampaignPerformance } from '@/lib/google-ads/campaigns'
import { fetchMetaCampaignPerformance } from '@/lib/meta/campaigns'
import { isMetaConfigured } from '@/lib/meta/client'

export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const s = process.env.CRON_SECRET
  if (req.headers.get('authorization') === `Bearer ${s}`) return true
  if (req.headers.get('x-cron-secret') === s) return true
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()
  const isFullRefresh = req.nextUrl.searchParams.get('full') === '1'
  const sinceDays = isFullRefresh ? 90 : 30

  const results = { google: 0, meta: 0, errors: [] as string[] }

  // --- Google Ads ---
  try {
    const rows = await fetchCampaignPerformance(sinceDays)
    const upsertRows = rows.map((r) => ({
      date: r.date,
      platform: 'google' as const,
      campaign_name: r.campaign_name,
      university: r.university,
      course: r.course,
      segment: r.segment,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
      synced_at: new Date().toISOString(),
    }))

    const BATCH = 500
    for (let i = 0; i < upsertRows.length; i += BATCH) {
      const { error } = await supabase
        .from('ad_spend')
        .upsert(upsertRows.slice(i, i + BATCH), { onConflict: 'date,platform,campaign_name' })
      if (error) throw new Error(`Google upsert error: ${error.message}`)
    }

    results.google = upsertRows.length
    await writeSyncLog(supabase, startedAt, 'google_ads', upsertRows.length, 'success', null)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.errors.push(`google: ${msg}`)
    await writeSyncLog(supabase, startedAt, 'google_ads', 0, 'error', msg)
  }

  // --- Meta Ads ---
  if (isMetaConfigured()) {
    try {
      const until = new Date()
      const since = new Date()
      since.setDate(since.getDate() - sinceDays)
      const fmt = (d: Date) => d.toISOString().split('T')[0]

      const rows = await fetchMetaCampaignPerformance(fmt(since), fmt(until))
      const upsertRows = rows.map((r) => ({
        date: r.date,
        platform: 'meta' as const,
        campaign_name: r.campaign_name,
        university: r.university,
        course: r.course,
        segment: r.segment,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        synced_at: new Date().toISOString(),
      }))

      const BATCH = 500
      for (let i = 0; i < upsertRows.length; i += BATCH) {
        const { error } = await supabase
          .from('ad_spend')
          .upsert(upsertRows.slice(i, i + BATCH), { onConflict: 'date,platform,campaign_name' })
        if (error) throw new Error(`Meta upsert error: ${error.message}`)
      }

      results.meta = upsertRows.length
      await writeSyncLog(supabase, startedAt, 'meta', upsertRows.length, 'success', null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`meta: ${msg}`)
      await writeSyncLog(supabase, startedAt, 'meta', 0, 'error', msg)
    }
  } else {
    results.errors.push('meta: skipped (META_ACCESS_TOKEN not configured)')
  }

  const hasErrors = results.errors.length > 0
  return NextResponse.json(results, { status: hasErrors && results.google === 0 ? 500 : 200 })
}

async function writeSyncLog(
  supabase: ReturnType<typeof createServiceClient>,
  startedAt: string,
  source: 'google_ads' | 'meta',
  records: number,
  status: 'success' | 'error',
  error: string | null
) {
  await supabase.from('sync_log').insert({
    source,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_synced: records,
    status,
    error_message: error,
  })
}
