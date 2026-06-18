import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const fromBearer = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const fromHeader = req.headers.get('x-cron-secret') ?? ''
  const fromQuery = req.nextUrl.searchParams.get('s') ?? ''
  const candidate = fromBearer || fromHeader || fromQuery
  if (!candidate || candidate.length !== cronSecret.length) return false
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(cronSecret))
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const [{ data: spendRows }, { data: syncLogs }] = await Promise.all([
    supabase
      .from('ad_spend')
      .select('date, platform, spend')
      .gte('date', '2025-01-01')
      .order('date')
      .limit(50000),
    supabase
      .from('sync_log')
      .select('source, completed_at, records_synced, status')
      .order('completed_at', { ascending: false })
      .limit(20),
  ])

  // Aggregate by (year-month, platform)
  type MonthData = { google_rows: number; meta_rows: number; google_spend: number; meta_spend: number }
  const coverage = new Map<string, MonthData>()

  for (const row of spendRows ?? []) {
    const key = row.date.slice(0, 7) // "2026-04"
    const cur = coverage.get(key) ?? { google_rows: 0, meta_rows: 0, google_spend: 0, meta_spend: 0 }
    if (row.platform === 'google') {
      cur.google_rows++
      cur.google_spend += Number(row.spend)
    } else if (row.platform === 'meta') {
      cur.meta_rows++
      cur.meta_spend += Number(row.spend)
    }
    coverage.set(key, cur)
  }

  const months = Array.from(coverage.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      google_rows: d.google_rows,
      meta_rows: d.meta_rows,
      google_spend: Math.round(d.google_spend * 100) / 100,
      meta_spend: Math.round(d.meta_spend * 100) / 100,
      total_spend: Math.round((d.google_spend + d.meta_spend) * 100) / 100,
    }))

  const lastSyncs: Record<string, { completed_at: string; records_synced: number; status: string }> = {}
  for (const log of syncLogs ?? []) {
    if (!lastSyncs[log.source]) {
      lastSyncs[log.source] = {
        completed_at: log.completed_at,
        records_synced: log.records_synced,
        status: log.status,
      }
    }
  }

  return NextResponse.json({ months, last_syncs: lastSyncs })
}
