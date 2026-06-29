import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recomputeCacMetrics } from '@/lib/metrics/compute-cac'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function dateToMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTH_SHORT[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    campaign_name: string
    platform: string
    course: string | null
    university: string | null
  }
  const { campaign_name, platform, course, university } = body
  if (!campaign_name || !platform) {
    return NextResponse.json({ error: 'campaign_name and platform are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Save the override record
  const { error: overrideErr } = await admin
    .from('campaign_overrides')
    .upsert(
      { campaign_name, platform, course: course || null, university: university || null, updated_at: new Date().toISOString() },
      { onConflict: 'campaign_name,platform' }
    )
  if (overrideErr) return NextResponse.json({ error: overrideErr.message }, { status: 500 })

  // 2. Apply the override directly to ad_spend so Grand Summary and CAC Report stay in sync
  const { data: updatedRows, error: spendErr } = await admin
    .from('ad_spend')
    .update({ course: course || null, university: university || null })
    .eq('campaign_name', campaign_name)
    .eq('platform', platform)
    .select('date')
  if (spendErr) return NextResponse.json({ error: spendErr.message }, { status: 500 })

  // 3. Recompute cac_metrics for every month that had rows updated
  if (updatedRows && updatedRows.length > 0) {
    const months = [...new Set(updatedRows.map((r) => dateToMonthLabel(r.date)))]
    await recomputeCacMetrics(months)
  }

  return NextResponse.json({ ok: true, rowsUpdated: updatedRows?.length ?? 0 })
}
