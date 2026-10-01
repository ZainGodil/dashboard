import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllContacts, type HubSpotContact } from '@/lib/hubspot/contacts'
import {
  fetchDealStageLabelMap,
  fetchAllRawDeals,
  buildEnrolledMap,
  toDealRecord,
  type EnrolledDealData,
  type FullDeal,
} from '@/lib/hubspot/deals'
import {
  IncrementalUnavailableError,
  fetchListMemberIds,
  searchModifiedContacts,
  searchModifiedDeals,
  batchReadContacts,
  batchReadDeals,
  batchReadAssociations,
} from '@/lib/hubspot/incremental'
import { fetchOwnerMap } from '@/lib/hubspot/owners'
import { mapUniversity, mapCourse, mapSegment, mapViable, mapSource, formatMonth } from '@/lib/hubspot/mappers'
import { recomputeCacMetrics, recomputeRollingMetrics } from '@/lib/metrics/compute-cac'

export const maxDuration = 300

type Supabase = ReturnType<typeof createServiceClient>
type ContactRow = ReturnType<typeof buildContactRows>['rows'][number]

const BATCH = 500
// Re-read a little before the last sync started so edits made while it ran aren't missed
const INCREMENTAL_OVERLAP_MS = 10 * 60 * 1000

interface SyncResult {
  mode: 'full' | 'incremental'
  synced: number
  months: string[]
  unknownUniversityValues: Record<string, number>
  message?: string
  fallbackReason?: string
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const s = process.env.CRON_SECRET
  // Vercel cron sends: Authorization: Bearer <secret>
  if (req.headers.get('authorization') === `Bearer ${s}`) return true
  // Manual curl trigger: x-cron-secret header
  if (req.headers.get('x-cron-secret') === s) return true
  return false
}

// GET /api/sync/hubspot              → full sync (nightly cron): re-reads the whole list and every deal
// GET /api/sync/hubspot?mode=incremental → only contacts/deals modified since the last successful sync
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()
  const ctx = { step: 'init', recordsSynced: 0 }

  try {
    let result: SyncResult | null = null
    let fallbackReason: string | undefined

    if (req.nextUrl.searchParams.get('mode') === 'incremental') {
      ctx.step = 'last-sync'
      const since = await lastSuccessfulSyncStart(supabase)
      if (since === null) {
        fallbackReason = 'no previous successful sync'
      } else {
        try {
          result = await runIncrementalSync(supabase, ctx, since - INCREMENTAL_OVERLAP_MS)
        } catch (err) {
          if (!(err instanceof IncrementalUnavailableError)) throw err
          fallbackReason = err.message
        }
      }
      if (fallbackReason) console.warn('[hubspot sync] falling back to full sync:', fallbackReason)
    }

    if (!result) result = { ...(await runFullSync(supabase, ctx)), fallbackReason }

    await writeSyncLog(supabase, startedAt, result.synced, 'success', null)
    return NextResponse.json(result)
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err)
    const errorMessage = `[step=${ctx.step}] ${base}`
    await writeSyncLog(supabase, startedAt, ctx.recordsSynced, 'error', errorMessage)
    console.error('[hubspot sync]', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

async function runFullSync(supabase: Supabase, ctx: { step: string; recordsSynced: number }): Promise<SyncResult> {
  ctx.step = 'fetch'
  // Independent HubSpot reads run concurrently; deals are fetched once and used for
  // both the enrollment map and the deals table.
  const [ownerMap, stageLabelMap, rawDeals, contacts] = await Promise.all([
    tagStep('owners', fetchOwnerMap()),
    tagStep('deal-stages', fetchDealStageLabelMap()),
    tagStep('deals', fetchAllRawDeals()),
    // All members of HubSpot list 5711 (maintained in HubSpot UI)
    tagStep('contacts', fetchAllContacts()),
  ])
  const enrolledDealContactIds = buildEnrolledMap(rawDeals)

  if (!contacts.length) {
    return { mode: 'full', synced: 0, months: [], unknownUniversityValues: {}, message: 'No contacts to sync' }
  }

  const { rows, unknownUniValues } = buildContactRows(contacts, ownerMap, enrolledDealContactIds)

  ctx.step = 'contacts-upsert'
  await upsertContacts(supabase, rows)
  ctx.recordsSynced = rows.length

  await deleteEnrollmentsFor(supabase, rows.filter((r) => !r.enrolled).map((r) => r.hubspot_id))

  // Remove contacts that are no longer in the list (orphans from previous syncs)
  ctx.step = 'orphans'
  const syncedIds = new Set(rows.map((r) => r.hubspot_id))
  const affectedMonths = Array.from(new Set(rows.map((r) => r.month).filter(Boolean))) as string[]
  for (const month of affectedMonths) {
    const { data: existing } = await supabase.from('contacts').select('hubspot_id').eq('month', month)
    const orphans = (existing ?? []).map((r) => r.hubspot_id).filter((id) => !syncedIds.has(id))
    if (orphans.length) {
      await supabase.from('contacts').delete().in('hubspot_id', orphans)
    }
  }

  ctx.step = 'enrollments'
  const enrolledRows = await upsertEnrollments(supabase, rows, enrolledDealContactIds)

  ctx.step = 'metrics'
  const monthSet = new Set<string>()
  for (const r of rows) {
    if (r.create_date) monthSet.add(formatMonth(r.create_date))
  }
  // Also include enrollment months so deal-close months get recomputed even
  // when no new leads were created that month.
  for (const r of enrolledRows) {
    if (r.month) monthSet.add(r.month)
  }
  await recomputeCacMetrics(Array.from(monthSet))
  await recomputeRollingMetrics()

  ctx.step = 'deals-upsert'
  await upsertDeals(supabase, rawDeals, ownerMap, stageLabelMap)

  return {
    mode: 'full',
    synced: rows.length,
    months: Array.from(monthSet),
    unknownUniversityValues: Object.fromEntries(unknownUniValues),
  }
}

// ---------------------------------------------------------------------------
// Incremental sync
// ---------------------------------------------------------------------------

async function runIncrementalSync(
  supabase: Supabase,
  ctx: { step: string; recordsSynced: number },
  sinceMs: number
): Promise<SyncResult> {
  ctx.step = 'fetch'
  const [ownerMap, stageLabelMap, memberIds, modifiedContacts, modifiedDeals, dbContacts] = await Promise.all([
    tagStep('owners', fetchOwnerMap()),
    tagStep('deal-stages', fetchDealStageLabelMap()),
    tagStep('memberships', fetchListMemberIds()),
    tagStep('modified-contacts', searchModifiedContacts(sinceMs)),
    tagStep('modified-deals', searchModifiedDeals(sinceMs)),
    tagStep('db-contacts', loadDbContactMonths(supabase)),
  ])

  // Sanity check before trusting membership for deletes: an empty or mostly-disjoint
  // member set means we're looking at the wrong list, so let the full sync handle it.
  if (memberIds.size === 0) throw new IncrementalUnavailableError('list membership came back empty')
  if (dbContacts.size > 0) {
    let overlap = 0
    for (const id of dbContacts.keys()) if (memberIds.has(id)) overlap++
    if (overlap < dbContacts.size * 0.5) {
      throw new IncrementalUnavailableError('list membership does not match stored contacts')
    }
  }

  // Attach contact associations to modified deals (search results don't include them)
  ctx.step = 'deal-associations'
  const modifiedDealAssoc = await batchReadAssociations('deals', 'contacts', modifiedDeals.map((d) => d.id))
  for (const d of modifiedDeals) {
    d.associations = { contacts: { results: (modifiedDealAssoc.get(d.id) ?? []).map((id) => ({ id })) } }
  }

  // Contacts whose stored row may be stale: edited contacts, contacts on edited deals,
  // and list members we don't have yet.
  const touchedIds = new Set<string>(modifiedContacts.map((c) => c.id))
  for (const ids of modifiedDealAssoc.values()) for (const id of ids) touchedIds.add(id)
  for (const id of memberIds) if (!dbContacts.has(id)) touchedIds.add(id)

  const processIds = Array.from(touchedIds).filter((id) => memberIds.has(id))
  // Stored contacts that were touched but have left the list — same rule as the
  // full sync's orphan cleanup.
  const removedIds = Array.from(touchedIds).filter((id) => !memberIds.has(id) && dbContacts.has(id))

  // Properties: reuse search results, batch-read the rest
  ctx.step = 'contact-details'
  const contactById = new Map(modifiedContacts.map((c) => [c.id, c]))
  const missing = processIds.filter((id) => !contactById.has(id))
  for (const c of await batchReadContacts(missing)) contactById.set(c.id, c)
  const contacts = processIds.map((id) => contactById.get(id)).filter((c): c is HubSpotContact => !!c)

  // Enrollment status needs every deal on each contact, not just the edited ones
  ctx.step = 'contact-deals'
  const contactDealAssoc = await batchReadAssociations('contacts', 'deals', contacts.map((c) => c.id))
  const dealById = new Map(modifiedDeals.map((d) => [d.id, d]))
  const dealIdsToRead = new Set<string>()
  for (const ids of contactDealAssoc.values()) for (const id of ids) if (!dealById.has(id)) dealIdsToRead.add(id)
  for (const d of await batchReadDeals(Array.from(dealIdsToRead))) dealById.set(d.id, d)

  // Rebuild each relevant deal's contact list from the contact side, then derive the
  // enrollment map exactly as the full sync does (deals in ascending id order).
  const dealContacts = new Map<string, string[]>()
  for (const [contactId, dealIds] of contactDealAssoc) {
    for (const dealId of dealIds) {
      const list = dealContacts.get(dealId) ?? []
      list.push(contactId)
      dealContacts.set(dealId, list)
    }
  }
  const relevantDeals: FullDeal[] = Array.from(dealContacts.keys())
    .map((id) => dealById.get(id))
    .filter((d): d is FullDeal => !!d)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((d) => ({ ...d, associations: { contacts: { results: dealContacts.get(d.id)!.map((id) => ({ id })) } } }))
  const enrolledMap = buildEnrolledMap(relevantDeals)

  const { rows, unknownUniValues } = buildContactRows(contacts, ownerMap, enrolledMap)

  // Months an enrollment is leaving (re-dated or removed) must be recomputed too
  ctx.step = 'previous-enrollments'
  const previousEnrollmentMonths = await loadEnrollmentMonths(supabase, [...processIds, ...removedIds])

  ctx.step = 'contacts-upsert'
  await upsertContacts(supabase, rows)
  ctx.recordsSynced = rows.length

  await deleteEnrollmentsFor(supabase, rows.filter((r) => !r.enrolled).map((r) => r.hubspot_id))

  ctx.step = 'orphans'
  for (let i = 0; i < removedIds.length; i += BATCH) {
    await supabase.from('contacts').delete().in('hubspot_id', removedIds.slice(i, i + BATCH))
  }

  ctx.step = 'enrollments'
  const enrolledRows = await upsertEnrollments(supabase, rows, enrolledMap)

  ctx.step = 'deals-upsert'
  await upsertDeals(supabase, modifiedDeals, ownerMap, stageLabelMap)

  ctx.step = 'metrics'
  const monthSet = new Set<string>()
  for (const r of rows) if (r.month) monthSet.add(r.month)
  for (const r of enrolledRows) if (r.month) monthSet.add(r.month)
  for (const id of [...processIds, ...removedIds]) {
    const previous = dbContacts.get(id)
    if (previous) monthSet.add(previous)
  }
  for (const m of previousEnrollmentMonths) monthSet.add(m)

  if (monthSet.size > 0) {
    await recomputeCacMetrics(Array.from(monthSet))
    await recomputeRollingMetrics()
  }

  return {
    mode: 'incremental',
    synced: rows.length,
    months: Array.from(monthSet),
    unknownUniversityValues: Object.fromEntries(unknownUniValues),
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function tagStep<T>(step: string, p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    if (err instanceof IncrementalUnavailableError) throw err
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${step}: ${msg}`)
  })
}

function buildContactRows(
  contacts: HubSpotContact[],
  ownerMap: Map<string, string>,
  enrolledDealContactIds: Map<string, EnrolledDealData>
) {
  // Collect unrecognised university raw values for diagnostics
  const unknownUniValues = new Map<string, number>()

  const rows = contacts.map((c) => {
    const p = c.properties
    const { segment, salesSegment } = mapSegment(p.hs_analytics_source_data_2)
    const enrolled = enrolledDealContactIds.has(c.id)
    const viable = mapViable(p.viable_non_viable_leads)
    const rawUni = p.pick_university ?? p.university ?? null
    const university = mapUniversity(rawUni)
    if (rawUni && !university) unknownUniValues.set(rawUni, (unknownUniValues.get(rawUni) ?? 0) + 1)
    const course = mapCourse(p.course_validation ?? p.program)
    // Use Chicago time (portal timezone) so dates match HubSpot's MTD filter
    const createDate = p.createdate
      ? new Date(Number(p.createdate)).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      : null

    return {
      hubspot_id: c.id,
      first_name: p.firstname ?? null,
      last_name: p.lastname ?? null,
      create_date: createDate,
      course,
      original_source: mapSource(p.hs_analytics_source),
      viable,
      lead_status: p.hs_lead_status ?? null,
      qualified: null,
      university,
      advisor: p.hubspot_owner_id ? (ownerMap.get(p.hubspot_owner_id) ?? null) : null,
      segment,
      sales_segment: salesSegment,
      enrolled,
      month: createDate ? formatMonth(createDate) : null,
      synced_at: new Date().toISOString(),
    }
  })

  return { rows, unknownUniValues }
}

async function upsertContacts(supabase: Supabase, rows: ContactRow[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('contacts')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'hubspot_id' })
    if (error) throw new Error(`Upsert error: ${error.message}`)
  }
}

// Remove enrollment rows for contacts that no longer have a deal in an enrolled stage
async function deleteEnrollmentsFor(supabase: Supabase, hubspotIds: string[]) {
  for (let i = 0; i < hubspotIds.length; i += BATCH) {
    await supabase.from('enrollments').delete().in('hubspot_contact_id', hubspotIds.slice(i, i + BATCH))
  }
}

async function upsertEnrollments(
  supabase: Supabase,
  rows: ContactRow[],
  enrolledDealContactIds: Map<string, EnrolledDealData>
) {
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
        payment_frequency: dealData?.payment_frequency ?? null,
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

  return enrolledRows
}

async function upsertDeals(
  supabase: Supabase,
  deals: FullDeal[],
  ownerMap: Map<string, string>,
  stageLabelMap: Map<string, string>
) {
  const dealRows = deals.map((deal) => {
    const d = toDealRecord(deal, ownerMap, stageLabelMap)
    const closeDate = d.close_date_raw
      ? new Date(d.close_date_raw).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      : null
    return {
      hubspot_deal_id: d.hubspot_deal_id,
      contact_hubspot_id: d.contact_hubspot_id,
      advisor: d.advisor,
      stage_label: d.stage_label,
      amount: d.amount,
      payment_frequency: d.payment_frequency,
      close_date: closeDate,
      month: closeDate ? formatMonth(closeDate) : null,
      synced_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < dealRows.length; i += BATCH) {
    const { error } = await supabase
      .from('deals')
      .upsert(dealRows.slice(i, i + BATCH), { onConflict: 'hubspot_deal_id' })
    if (error) throw new Error(`Deals upsert error: ${error.message}`)
  }
}

async function lastSuccessfulSyncStart(supabase: Supabase): Promise<number | null> {
  const { data, error } = await supabase
    .from('sync_log')
    .select('started_at')
    .eq('source', 'hubspot')
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`sync_log read error: ${error.message}`)
  const startedAt = data?.[0]?.started_at
  return startedAt ? new Date(startedAt).getTime() : null
}

// Map<hubspot_id, month> for every stored contact (paged — PostgREST caps at 1000 rows)
async function loadDbContactMonths(supabase: Supabase): Promise<Map<string, string | null>> {
  const PAGE = 1000
  const map = new Map<string, string | null>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('contacts')
      .select('hubspot_id, month')
      .order('hubspot_id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`contacts read error: ${error.message}`)
    for (const r of data ?? []) map.set(r.hubspot_id, r.month)
    if (!data || data.length < PAGE) break
  }
  return map
}

async function loadEnrollmentMonths(supabase: Supabase, hubspotIds: string[]): Promise<Set<string>> {
  const months = new Set<string>()
  for (let i = 0; i < hubspotIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('month')
      .in('hubspot_contact_id', hubspotIds.slice(i, i + BATCH))
    if (error) throw new Error(`enrollments read error: ${error.message}`)
    for (const r of data ?? []) if (r.month) months.add(r.month)
  }
  return months
}

async function writeSyncLog(
  supabase: Supabase,
  startedAt: string,
  records: number,
  status: 'success' | 'error',
  error: string | null
) {
  await supabase.from('sync_log').insert({
    source: 'hubspot',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_synced: records,
    status,
    error_message: error,
  })
}
