import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

type Source = 'ads' | 'hubspot' | 'stripe' | 'paycove'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const source = body.source as string | undefined

  if (source !== 'ads' && source !== 'hubspot' && source !== 'stripe' && source !== 'paycove') {
    return NextResponse.json({ error: 'Invalid source. Must be "ads", "hubspot", "stripe" or "paycove".' }, { status: 400 })
  }

  const validSource: Source = source
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  // Dashboard-initiated HubSpot syncs only pull what changed; the nightly cron does the full pass
  const path =
    validSource === 'ads' ? '/api/sync/ads'
    : validSource === 'stripe' ? '/api/sync/stripe'
    : validSource === 'paycove' ? '/api/sync/paycove'
    : '/api/sync/hubspot?mode=incremental'

  const upstream = await fetch(`${origin}${path}`, {
    method: 'GET',
    headers: {
      'x-cron-secret': secret,
    },
  })

  const data = await upstream.json().catch(() => ({}))

  if (!upstream.ok) {
    console.error(`[sync/trigger] upstream ${path} failed:`, upstream.status, data.error)
    return NextResponse.json(
      { error: data.error ?? 'Sync failed' },
      { status: upstream.status }
    )
  }

  return NextResponse.json(data)
}
