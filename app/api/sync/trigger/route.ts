// app/api/sync/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

type Source = 'ads' | 'hubspot'

export async function POST(req: NextRequest) {
  // Validate user session — no CRON_SECRET exposed to browser
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const source: Source = body.source

  if (source !== 'ads' && source !== 'hubspot') {
    return NextResponse.json({ error: 'Invalid source. Must be "ads" or "hubspot".' }, { status: 400 })
  }

  // Call the existing sync route internally, passing CRON_SECRET so its auth check passes
  const origin = new URL(req.url).origin
  const path = source === 'ads' ? '/api/sync/ads' : '/api/sync/hubspot'

  const upstream = await fetch(`${origin}${path}`, {
    headers: {
      'x-cron-secret': process.env.CRON_SECRET ?? '',
    },
  })

  const data = await upstream.json().catch(() => ({}))

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.error ?? 'Sync failed' },
      { status: upstream.status }
    )
  }

  return NextResponse.json(data)
}
