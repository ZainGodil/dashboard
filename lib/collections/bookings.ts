// Booking amount per student for the Collections grid: enrollments.deal_amount (the CAC report's
// Bookings), matched to students by email. HubSpot is only read here, and only the email property.
import { hubspotFetch } from '../hubspot/client'
import { fetchAllRows } from '../supabase/paginate'
import type { createServiceClient } from '@/lib/supabase/server'

const BATCH = 100 // HubSpot batch-read limit

interface BatchResponse {
  results: { id: string; properties: { email?: string | null } }[]
}

export async function fetchContactEmails(ids: string[]): Promise<Map<string, string | null>> {
  const emails = new Map<string, string | null>()
  for (let i = 0; i < ids.length; i += BATCH) {
    const data = await hubspotFetch<BatchResponse>('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: JSON.stringify({ properties: ['email'], inputs: ids.slice(i, i + BATCH).map((id) => ({ id })) }),
    })
    for (const r of data.results) emails.set(String(r.id), r.properties.email?.trim().toLowerCase() || null)
  }
  return emails
}

// Looks up the email of every enrolled contact and stores it. Returns how many were stored.
export async function refreshEnrollmentEmails(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const enrollments = await fetchAllRows<{ hubspot_contact_id: string }>((from, to) =>
    supabase.from('enrollments').select('hubspot_contact_id').order('hubspot_contact_id').range(from, to)
  )
  const ids = Array.from(new Set(enrollments.map((e) => e.hubspot_contact_id).filter(Boolean)))
  if (!ids.length) return 0

  const emails = await fetchContactEmails(ids)
  const syncedAt = new Date().toISOString()
  const rows = ids.filter((id) => emails.has(id)).map((id) => ({ hubspot_id: id, email: emails.get(id) ?? null, synced_at: syncedAt }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('hubspot_contact_emails').upsert(rows.slice(i, i + 500), { onConflict: 'hubspot_id' })
    if (error) throw new Error(`hubspot_contact_emails: ${error.message}`)
  }
  return rows.length
}

// Booking amount per lower-cased email; a student with several enrollments gets the sum
export function bookingsByEmail(
  enrollments: { hubspot_contact_id: string; deal_amount: number | string | null }[],
  emails: { hubspot_id: string; email: string | null }[],
): Map<string, number> {
  const emailById = new Map<string, string>()
  for (const e of emails) if (e.email) emailById.set(e.hubspot_id, e.email.trim().toLowerCase())

  const totals = new Map<string, number>()
  for (const en of enrollments) {
    const email = emailById.get(en.hubspot_contact_id)
    const amount = Number(en.deal_amount)
    if (!email || en.deal_amount === null || !Number.isFinite(amount)) continue
    totals.set(email, (totals.get(email) ?? 0) + amount)
  }
  return totals
}
