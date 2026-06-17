import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { recomputeCacMetrics } from '@/lib/metrics/compute-cac'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTH_LABELS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Fetch all contacts missing a month label but with a known create_date
  const { data: nullMonthContacts, error: fetchErr } = await supabase
    .from('contacts')
    .select('id, create_date')
    .is('month', null)
    .not('create_date', 'is', null)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const contacts = nullMonthContacts ?? []
  if (contacts.length === 0) {
    return NextResponse.json({ message: 'No contacts with null month found — nothing to do.' })
  }

  // 2. Group by computed month label
  const byMonth = new Map<string, string[]>()
  for (const c of contacts) {
    if (!c.create_date) continue
    const label = toMonthLabel(c.create_date)
    const ids = byMonth.get(label) ?? []
    ids.push(c.id)
    byMonth.set(label, ids)
  }

  // 3. Bulk-update per month group
  const updateResults: Record<string, { updated: number; error?: string }> = {}
  for (const [month, ids] of byMonth) {
    const { error: updateErr } = await supabase
      .from('contacts')
      .update({ month })
      .in('id', ids)

    updateResults[month] = updateErr
      ? { updated: 0, error: updateErr.message }
      : { updated: ids.length }
  }

  // 4. Recompute cac_metrics for all affected months
  const affectedMonths = Array.from(byMonth.keys()).sort()
  let recomputeError: string | null = null
  try {
    await recomputeCacMetrics(affectedMonths)
  } catch (e) {
    recomputeError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    contacts_found: contacts.length,
    months_affected: affectedMonths,
    updates: updateResults,
    recompute_error: recomputeError,
  })
}
