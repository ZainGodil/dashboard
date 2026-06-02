import { NextRequest, NextResponse } from 'next/server'
import { hubspotFetch } from '@/lib/hubspot/client'

// Temporary debug route — remove after confirming search endpoint works
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 24)
  const results: Record<string, unknown> = {}

  // Test 1: minimal search, no filters, no sorts
  try {
    const r = await hubspotFetch<{ total: number }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({ limit: 1, properties: ['firstname'] }),
    })
    results.test1_no_filters = { ok: true, total: r.total }
  } catch (e) {
    results.test1_no_filters = { ok: false, error: String(e) }
  }

  // Test 2: with sorts only (no filter)
  try {
    const r = await hubspotFetch<{ total: number }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        limit: 1,
        properties: ['firstname'],
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      }),
    })
    results.test2_sorts_only = { ok: true, total: r.total }
  } catch (e) {
    results.test2_sorts_only = { ok: false, error: String(e) }
  }

  // Test 3: with lastmodifieddate filter (Unix ms)
  try {
    const r = await hubspotFetch<{ total: number }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        limit: 1,
        properties: ['firstname'],
        filterGroups: [{
          filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: String(cutoff.getTime()) }],
        }],
      }),
    })
    results.test3_lastmodifieddate_filter = { ok: true, total: r.total }
  } catch (e) {
    results.test3_lastmodifieddate_filter = { ok: false, error: String(e) }
  }

  // Test 4: with createdate filter (Unix ms)
  try {
    const r = await hubspotFetch<{ total: number }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        limit: 1,
        properties: ['firstname'],
        filterGroups: [{
          filters: [{ propertyName: 'createdate', operator: 'GTE', value: String(cutoff.getTime()) }],
        }],
      }),
    })
    results.test4_createdate_filter = { ok: true, total: r.total }
  } catch (e) {
    results.test4_createdate_filter = { ok: false, error: String(e) }
  }

  // Test 5: full body (all properties + sorts + lastmodifieddate filter)
  try {
    const r = await hubspotFetch<{ total: number }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        limit: 1,
        properties: ['firstname', 'lastname', 'createdate', 'hs_lead_status', 'hubspot_owner_id',
          'program', 'pick_university', 'university', 'b2he', 'hs_analytics_source', 'lastmodifieddate'],
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
        filterGroups: [{
          filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: String(cutoff.getTime()) }],
        }],
      }),
    })
    results.test5_full_body = { ok: true, total: r.total }
  } catch (e) {
    results.test5_full_body = { ok: false, error: String(e) }
  }

  return NextResponse.json(results)
}
