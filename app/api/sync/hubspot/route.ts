import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllContacts } from '@/lib/hubspot/contacts'
import { fetchEnrolledContactIds } from '@/lib/hubspot/deals'
import { fetchOwnerMap } from '@/lib/hubspot/owners'
import { mapUniversity, mapCourse, mapSegment, isEnrolled, isViable, mapSource, formatMonth } from '@/lib/hubspot/mappers'
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
  const isFullRefresh = req.nextUrl.searchParams.get('full') === '1'

  let recordsSynced = 0
  let errorMessage: string | null = null
  let step = 'init'

  try {
    let afterDate: Date | undefined
    if (!isFullRefresh) {
      const { data: lastLog } = await supabase
        .from('sync_log')
        .select('completed_at')
        .eq('source', 'hubspot')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()
      if (lastLog?.completed_at) afterDate = new Date(lastLog.completed_at)
    }

    step = 'owners'
    const ownerMap = await fetchOwnerMap()
    step = 'deals'
    const enrolledDealContactIds = await fetchEnrolledContactIds()
    step = 'contacts'
    // fetchAllContacts already filters by advisor owner list and excludes b2b=true at the API level
    const contacts = await fetchAllContacts(afterDate)

    if (!contacts.length) {
      await writeSyncLog(supabase, startedAt, 0, 'success', null)
      return NextResponse.json({ synced: 0, message: 'No contacts to sync' })
    }

    const rows = contacts.map((c) => {
      const p = c.properties
      const { segment, salesSegment } = mapSegment(p.hs_analytics_source_data_2)
      const enrolled = isEnrolled(p.hs_lead_status) || enrolledDealContactIds.has(c.id)
      const viable = isViable(p.hs_lead_status)
      const university = mapUniversity(p.pick_university ?? p.university)
      const course = mapCourse(p.course_validation)
      const createDate = p.createdate ? new Date(p.createdate).toISOString().split('T')[0] : null

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

    const enrolledRows = rows
      .filter((r) => r.enrolled)
      .map((r) => ({
        hubspot_contact_id: r.hubspot_id,
        course: r.course,
        university: r.university,
        segment: r.segment,
        source: r.original_source,
        enrolled_at: r.create_date,
        month: r.create_date ? formatMonth(r.create_date) : null,
      }))

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
    await recomputeCacMetrics(Array.from(monthSet))

    if (isFullRefresh) await recomputeRollingMetrics()

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
