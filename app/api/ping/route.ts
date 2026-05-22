import { NextResponse } from 'next/server'
import { hubspotFetch } from '@/lib/hubspot/client'

export async function GET() {
  try {
    const data = await hubspotFetch<{ results: unknown[] }>('/crm/v3/owners?limit=10')
    return NextResponse.json({ ok: true, ownerCount: data.results.length, ts: Date.now() })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
