import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { hubspotFetch } from '@/lib/hubspot/client'
import { fetchEnrolledContactIds } from '@/lib/hubspot/deals'
import { fetchOwnerMap } from '@/lib/hubspot/owners'
import {
  mapUniversity,
  mapCourse,
  mapSegment,
  mapViable,
  mapSource,
  formatMonth,
} from '@/lib/hubspot/mappers'
import { recomputeCacMetrics } from '@/lib/metrics/compute-cac'
import { CONTACT_PROPERTIES } from '@/lib/hubspot/contacts'

export const maxDuration = 300

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabelToDate(label: string): Date {
  const [mon, yr] = label.split('-')
  const m = MONTH_LABELS.indexOf(mon)
  const y = 2000 + Number(yr)
  return new Date(Date.UTC(y, m, 1))
}

interface SearchContact {
  id: string
  properties: Record<string, string | null>
}

interface SearchResponse {
  results: SearchContact[]
  paging?: { next?: { after: string } }
  total?: number
}

async function fetchContactsByDateRange(
  fromMs: number,
  toMs: number
): Promise<SearchContact[]> {
  const all: SearchContact[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: String(fromMs) },
          { propertyName: 'createdate', operator: 'LT',  value: String(toMs) },
        ],
      }],
      properties: CONTACT_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    }
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...data.results)
    after = data.paging?.next?.after
  } while (after)

  return all
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  // Accept Authorization: Bearer header (preferred) or x-cron-secret header
  const fromBearer = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const fromHeader = req.headers.get('x-cron-secret') ?? ''
  // Also accept ?s= for backward compatibility with other admin endpoints
  const fromQuery = req.nextUrl.searchParams.get('s') ?? ''
  const candidate = fromBearer || fromHeader || fromQuery
  if (!candidate || candidate.length !== cronSecret.length) return false
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(cronSecret))
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Default range: Jul-25 to Feb-26 (the known gap)
  const fromLabel = req.nextUrl.searchParams.get('from') ?? 'Jul-25'
  const toLabel   = req.nextUrl.searchParams.get('to')   ?? 'Feb-26'

  const fromDate  = monthLabelToDate(fromLabel)
  const [tMon, tYr] = toLabel.split('-')
  const toMonthIndex = MONTH_LABELS.indexOf(tMon)
  const toYear = 2000 + Number(tYr)
  // End is the first day of the month AFTER toLabel (exclusive upper bound)
  const toDate = new Date(Date.UTC(
    toMonthIndex === 11 ? toYear + 1 : toYear,
    toMonthIndex === 11 ? 0 : toMonthIndex + 1,
    1
  ))

  const fromMs = fromDate.getTime()
  const toMs   = toDate.getTime()

  const supabase = createServiceClient()

  try {
    const [contacts, enrolledDealContactIds, ownerMap] = await Promise.all([
      fetchContactsByDateRange(fromMs, toMs),
      fetchEnrolledContactIds(),
      fetchOwnerMap(),
    ])

    if (!contacts.length) {
      return NextResponse.json({
        message: `No contacts found in HubSpot for ${fromLabel}–${toLabel}`,
        contacts_fetched: 0,
      })
    }

    const rows = contacts.map((c) => {
      const p = c.properties
      const { segment, salesSegment } = mapSegment(p.hs_analytics_source_data_2)
      const enrolled = enrolledDealContactIds.has(c.id)
      // v3 Search API returns ISO strings; v1 List API returns ms timestamps — handle both
      const rawCreated = p.createdate
      const createTs = rawCreated
        ? (isNaN(Number(rawCreated)) ? Date.parse(rawCreated) : Number(rawCreated))
        : null
      const createDate = createTs && !isNaN(createTs)
        ? new Date(createTs).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        : null

      return {
        hubspot_id: c.id,
        first_name: p.firstname ?? null,
        last_name: p.lastname ?? null,
        create_date: createDate,
        course: mapCourse(p.course_validation),
        original_source: mapSource(p.hs_analytics_source),
        viable: mapViable(p.viable_non_viable_leads),
        lead_status: p.hs_lead_status ?? null,
        qualified: null,
        university: mapUniversity(p.pick_university ?? p.university),
        advisor: p.hubspot_owner_id ? (ownerMap.get(p.hubspot_owner_id) ?? null) : null,
        segment,
        sales_segment: salesSegment,
        enrolled,
        month: createDate ? formatMonth(createDate) : null,
        synced_at: new Date().toISOString(),
      }
    })

    // Upsert contacts in batches (never delete — these may not be in the list)
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('contacts')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'hubspot_id' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }

    // Build enrollments for enrolled contacts
    const enrolledRows = rows
      .filter((r) => r.enrolled)
      .map((r) => {
        const dealData = enrolledDealContactIds.get(r.hubspot_id) ?? null
        const rawCloseDate = dealData?.closedate ?? null
        const enrolledAt = rawCloseDate
          ? new Date(rawCloseDate).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
          : r.create_date
        return {
          hubspot_contact_id: r.hubspot_id,
          course: r.course,
          university: r.university,
          segment: r.segment,
          source: r.original_source,
          enrolled_at: enrolledAt,
          month: enrolledAt ? formatMonth(enrolledAt) : null,
          deal_amount: dealData?.amount ?? null,
        }
      })

    if (enrolledRows.length) {
      const hubspotIds = enrolledRows.map((r) => r.hubspot_contact_id)
      const { data: contactRecords } = await supabase
        .from('contacts')
        .select('id, hubspot_id')
        .in('hubspot_id', hubspotIds)

      const idMap = new Map((contactRecords ?? []).map((r) => [r.hubspot_id, r.id]))

      const enrollmentUpserts = enrolledRows
        .filter((r) => idMap.has(r.hubspot_contact_id))
        .map((r) => ({ contact_id: idMap.get(r.hubspot_contact_id)!, ...r }))

      if (enrollmentUpserts.length) {
        await supabase
          .from('enrollments')
          .upsert(enrollmentUpserts, { onConflict: 'hubspot_contact_id' })
      }
    }

    // Recompute cac_metrics for all affected months
    const monthSet = new Set<string>()
    for (const r of rows) {
      if (r.month) monthSet.add(r.month)
    }
    for (const r of enrolledRows) {
      if (r.month) monthSet.add(r.month)
    }
    const affectedMonths = Array.from(monthSet).sort()
    await recomputeCacMetrics(affectedMonths)

    return NextResponse.json({
      range: `${fromLabel}–${toLabel}`,
      contacts_fetched: contacts.length,
      contacts_upserted: rows.length,
      enrollments_upserted: enrolledRows.length,
      months_recomputed: affectedMonths,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const cause = err instanceof Error ? String((err as NodeJS.ErrnoException).cause ?? '') : ''
    console.error('[backfill-historical]', msg, cause)
    return NextResponse.json({ error: 'Internal error — check server logs' }, { status: 500 })
  }
}
