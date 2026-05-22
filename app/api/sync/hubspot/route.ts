import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllContacts } from '@/lib/hubspot/contacts'
import { fetchEnrolledContactIds } from '@/lib/hubspot/deals'
import { fetchOwnerMap } from '@/lib/hubspot/owners'
import { mapUniversity, mapCourse, mapSegment, isEnrolled, isViable, mapSource, formatMonth } from '@/lib/hubspot/mappers'
import { recomputeCacMetrics, recomputeRollingMetrics } from '@/lib/metrics/compute-cac'

export async function GET(req: NextRequest) {
  // Validate cron secret (skip in dev)
  const secret = req.headers.get('x-cron-secret')
  if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()
  const isFullRefresh = req.nextUrl.searchParams.get('full') === '1'

  let recordsSynced = 0
  let errorMessage: string | null = null

  try {
    // Determine incremental cutoff
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

    // Fetch owners and enrolled deal contact IDs in parallel
    const [ownerMap, enrolledDealContactIds] = await Promise.all([
      fetchOwnerMap(),
      fetchEnrolledContactIds(),
    ])

    // Fetch contacts
    const contacts = await fetchAllContacts(afterDate)

    if (!contacts.length) {
      await writeSyncLog(supabase, startedAt, 0, 'success', null)
      return NextResponse.json({ synced: 0, message: 'No contacts to sync' })
    }

    // Map contacts to DB rows
    const rows = contacts.map((c) => {
      const p = c.properties
      const { segment, salesSegment } = mapSegment(p.b2he)
      const enrolled = isEnrolled(p.hs_lead_status) || enrolledDealContactIds.has(c.id)
      const viable = isViable(p.hs_lead_status)
      const university = mapUniversity(p.pick_university ?? p.university)
      const course = mapCourse(p.program)
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

    // Upsert in batches of 500
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('contacts')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'hubspot_id' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }
    recordsSynced = rows.length

    // Upsert enrollments for newly enrolled contacts
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
      // Need contact UUIDs — fetch them back
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

    // Recompute CAC metrics for affected months
    const monthSet = new Set<string>()
    for (const r of rows) {
      if (r.create_date) monthSet.add(formatMonth(r.create_date))
    }
    const months = Array.from(monthSet)
    await recomputeCacMetrics(months)

    // Full nightly refresh also recomputes rolling metrics
    if (isFullRefresh) await recomputeRollingMetrics()

    await writeSyncLog(supabase, startedAt, recordsSynced, 'success', null)
    return NextResponse.json({ synced: recordsSynced, months })

  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
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
