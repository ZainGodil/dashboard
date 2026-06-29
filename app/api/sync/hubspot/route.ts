import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllContacts } from '@/lib/hubspot/contacts'
import { fetchEnrolledContactIds } from '@/lib/hubspot/deals'
import { fetchOwnerMap } from '@/lib/hubspot/owners'
import { mapUniversity, mapCourse, mapSegment, mapViable, mapSource, formatMonth } from '@/lib/hubspot/mappers'
import { recomputeCacMetrics, recomputeRollingMetrics } from '@/lib/metrics/compute-cac'

export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const s = process.env.CRON_SECRET
  // Vercel cron sends: Authorization: Bearer <secret>
  if (req.headers.get('authorization') === `Bearer ${s}`) return true
  // Manual curl trigger: x-cron-secret header
  if (req.headers.get('x-cron-secret') === s) return true
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()

  let recordsSynced = 0
  let errorMessage: string | null = null
  let step = 'init'

  try {
    step = 'owners'
    const ownerMap = await fetchOwnerMap()
    step = 'deals'
    const enrolledDealContactIds = await fetchEnrolledContactIds()
    step = 'contacts'
    // Fetch all members of HubSpot list 5711 (maintained in HubSpot UI)
    const contacts = await fetchAllContacts()

    if (!contacts.length) {
      await writeSyncLog(supabase, startedAt, 0, 'success', null)
      return NextResponse.json({ synced: 0, message: 'No contacts to sync' })
    }

    const rows = contacts.map((c) => {
      const p = c.properties
      const { segment, salesSegment } = mapSegment(p.hs_analytics_source_data_2)
      const enrolled = enrolledDealContactIds.has(c.id)
      const viable = mapViable(p.viable_non_viable_leads)
      const university = mapUniversity(p.pick_university ?? p.university)
      const course = mapCourse(p.course_validation)
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

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('contacts')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'hubspot_id' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }
    recordsSynced = rows.length

    // Remove enrollment rows for contacts that no longer have a deal in an enrolled stage
    const unenrolledIds = rows.filter((r) => !r.enrolled).map((r) => r.hubspot_id)
    if (unenrolledIds.length > 0) {
      for (let i = 0; i < unenrolledIds.length; i += BATCH) {
        await supabase.from('enrollments').delete().in('hubspot_contact_id', unenrolledIds.slice(i, i + BATCH))
      }
    }

    // Remove contacts that are no longer in the list (orphans from previous syncs)
    const syncedIds = new Set(rows.map((r) => r.hubspot_id))
    const affectedMonths = Array.from(new Set(rows.map((r) => r.month).filter(Boolean))) as string[]
    for (const month of affectedMonths) {
      const { data: existing } = await supabase.from('contacts').select('hubspot_id').eq('month', month)
      const orphans = (existing ?? []).map((r) => r.hubspot_id).filter((id) => !syncedIds.has(id))
      if (orphans.length) {
        await supabase.from('contacts').delete().in('hubspot_id', orphans)
      }
    }

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

    await writeSyncLog(supabase, startedAt, recordsSynced, 'success', null)
    return NextResponse.json({ synced: recordsSynced, months: Array.from(monthSet) })

  } catch (err) {
    const base = err instanceof Error ? err.message : String(err)
    errorMessage = `[step=${step}] ${base}`
    await writeSyncLog(supabase, startedAt, recordsSynced, 'error', errorMessage)
    console.error('[hubspot sync]', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

async function writeSyncLog(
  supabase: ReturnType<typeof createServiceClient>,
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
