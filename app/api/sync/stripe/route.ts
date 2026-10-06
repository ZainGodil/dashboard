import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchChargesSince, toPaymentRecord } from '@/lib/stripe/charges'

export const maxDuration = 300

const BATCH = 500
// Charges change after they're created (pending → succeeded, refunds), so each run re-reads a recent window
const RECENT_DAYS = 60
// Where a full sync starts; the Collections report covers 2026 onwards
const FULL_SYNC_START = '2026-01-01T06:00:00Z' // midnight, America/Chicago

type Supabase = ReturnType<typeof createServiceClient>

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const s = process.env.CRON_SECRET
  if (!s) return false
  if (req.headers.get('authorization') === `Bearer ${s}`) return true
  if (req.headers.get('x-cron-secret') === s) return true
  return false
}

// GET /api/sync/stripe            → re-reads charges from the last 60 days (nightly cron, Sync button)
// GET /api/sync/stripe?mode=full  → re-reads every charge since Jan 1, 2026 (also used automatically on the first run)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()

  try {
    const { count, error: countError } = await supabase
      .from('stripe_payments')
      .select('id', { count: 'exact', head: true })
    if (countError) throw new Error(`stripe_payments: ${countError.message}`)

    const full = req.nextUrl.searchParams.get('mode') === 'full' || !count
    const since = full ? new Date(FULL_SYNC_START) : new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)

    const records = (await fetchChargesSince(since)).map(toPaymentRecord)
    const syncedAt = new Date().toISOString()

    for (let i = 0; i < records.length; i += BATCH) {
      const chunk = records.slice(i, i + BATCH).map((r) => ({ ...r, synced_at: syncedAt }))
      const { error } = await supabase.from('stripe_payments').upsert(chunk, { onConflict: 'id' })
      if (error) throw new Error(`upsert: ${error.message}`)
    }

    await writeSyncLog(supabase, startedAt, records.length, 'success', null)
    return NextResponse.json({ mode: full ? 'full' : 'recent', since: since.toISOString(), synced: records.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync/stripe] failed:', message)
    await writeSyncLog(supabase, startedAt, 0, 'error', message).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function writeSyncLog(supabase: Supabase, startedAt: string, records: number, status: 'success' | 'error', error: string | null) {
  await supabase.from('sync_log').insert({
    source: 'stripe',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_synced: records,
    status,
    error_message: error,
  })
}
