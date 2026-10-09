import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchContacts, fetchDeals, toDealRows } from '@/lib/paycove/client'

export const maxDuration = 300

const BATCH = 500

type Supabase = ReturnType<typeof createServiceClient>

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const s = process.env.CRON_SECRET
  if (!s) return false
  if (req.headers.get('authorization') === `Bearer ${s}`) return true
  if (req.headers.get('x-cron-secret') === s) return true
  return false
}

// GET /api/sync/paycove — reads every Paycove invoice with its installments and replaces the local copy
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()

  try {
    const { data: tokenRow, error: tokenError } = await supabase
      .from('integration_tokens')
      .select('access_token')
      .eq('provider', 'paycove')
      .maybeSingle()
    if (tokenError) throw new Error(`integration_tokens: ${tokenError.message}`)
    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'Paycove is not connected yet. Click Connect Paycove on the Collections page.' }, { status: 400 })
    }

    const [deals, contacts] = await Promise.all([fetchDeals(tokenRow.access_token), fetchContacts(tokenRow.access_token)])
    const syncedAt = new Date().toISOString()
    const { dealRows, paymentRows } = toDealRows(deals, contacts, syncedAt)

    for (let i = 0; i < dealRows.length; i += BATCH) {
      const { error } = await supabase.from('paycove_deals').upsert(dealRows.slice(i, i + BATCH), { onConflict: 'id' })
      if (error) throw new Error(`deals upsert: ${error.message}`)
    }
    for (let i = 0; i < paymentRows.length; i += BATCH) {
      const { error } = await supabase.from('paycove_payments').upsert(paymentRows.slice(i, i + BATCH), { onConflict: 'id' })
      if (error) throw new Error(`payments upsert: ${error.message}`)
    }

    // Each run is a full read, so anything not seen this time was removed or rescheduled in Paycove.
    // Skipped when Paycove returned nothing, so an empty or broken response can't wipe the copy.
    let removed = 0
    if (dealRows.length) {
      const { count: stalePayments, error: pErr } = await supabase.from('paycove_payments').delete({ count: 'exact' }).lt('synced_at', syncedAt)
      if (pErr) throw new Error(`payments cleanup: ${pErr.message}`)
      const { count: staleDeals, error: dErr } = await supabase.from('paycove_deals').delete({ count: 'exact' }).lt('synced_at', syncedAt)
      if (dErr) throw new Error(`deals cleanup: ${dErr.message}`)
      removed = (stalePayments ?? 0) + (staleDeals ?? 0)
    }

    const unmatched = dealRows.filter((d) => !d.student_email).length
    await writeSyncLog(supabase, startedAt, dealRows.length + paymentRows.length, 'success', null)
    return NextResponse.json({ synced: dealRows.length, plans: dealRows.length, installments: paymentRows.length, removed, plansWithoutEmail: unmatched })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync/paycove] failed:', message)
    await writeSyncLog(supabase, startedAt, 0, 'error', message).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function writeSyncLog(supabase: Supabase, startedAt: string, records: number, status: 'success' | 'error', error: string | null) {
  await supabase.from('sync_log').insert({
    source: 'paycove',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_synced: records,
    status,
    error_message: error,
  })
}
