import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { recomputeCacMetrics } from '@/lib/metrics/compute-cac'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]}-${String(year).slice(2)}`
}

// Generates all month labels between two inclusive labels e.g. "Jul-25" → "Feb-26"
function monthRange(from: string, to: string): string[] {
  const [fMon, fYr] = from.split('-')
  const [tMon, tYr] = to.split('-')
  let y = 2000 + Number(fYr)
  let m = MONTH_LABELS.indexOf(fMon)
  const endY = 2000 + Number(tYr)
  const endM = MONTH_LABELS.indexOf(tMon)

  const months: string[] = []
  while (y < endY || (y === endY && m <= endM)) {
    months.push(toLabel(y, m))
    m++
    if (m > 11) { m = 0; y++ }
  }
  return months
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: ?from=Jul-25&to=Feb-26 — defaults to the known gap
  const from = req.nextUrl.searchParams.get('from') ?? 'Jul-25'
  const to   = req.nextUrl.searchParams.get('to')   ?? 'Feb-26'

  const months = monthRange(from, to)
  if (!months.length) {
    return NextResponse.json({ error: 'Invalid month range' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Show what data exists in contacts for these months before recomputing
  const { data: contactCounts } = await supabase
    .from('contacts')
    .select('month')
    .in('month', months)

  const countByMonth: Record<string, number> = {}
  for (const row of contactCounts ?? []) {
    const m = row.month ?? 'null'
    countByMonth[m] = (countByMonth[m] ?? 0) + 1
  }

  // Run recomputation for all months in range
  const errors: string[] = []
  try {
    await recomputeCacMetrics(months)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  // Check what cac_metrics rows now exist
  const { data: cacRows } = await supabase
    .from('cac_metrics')
    .select('month, leads, enrollments')
    .in('month', months)
    .order('month')

  const cacByMonth: Record<string, { leads: number; enrollments: number }> = {}
  for (const row of cacRows ?? []) {
    const m = row.month ?? 'null'
    if (!cacByMonth[m]) cacByMonth[m] = { leads: 0, enrollments: 0 }
    cacByMonth[m].leads += row.leads
    cacByMonth[m].enrollments += row.enrollments
  }

  return NextResponse.json({
    months_requested: months,
    contacts_found: countByMonth,
    cac_metrics_after: cacByMonth,
    errors,
  })
}
