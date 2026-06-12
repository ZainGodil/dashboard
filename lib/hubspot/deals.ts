import { hubspotFetch } from './client'

const ENROLLED_STAGES = new Set([
  // B2C Interview pipeline — "Signed Promissory Note / Closed Won"
  '124944662',
  // Hidden Talent B2C pipeline — "Signed Promissory Note / Closed Won"
  '1335758964',
])

interface Deal {
  id: string
  properties: { dealstage: string | null; closedate: string | null }
  associations?: { contacts?: { results: { id: string }[] } }
}

interface DealsResponse {
  results: Deal[]
  paging?: { next?: { after: string } }
}

// Returns Map<contactId, closedate (ISO string or null)>
export async function fetchEnrolledContactIds(): Promise<Map<string, string | null>> {
  const contactDates = new Map<string, string | null>()
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: 'dealstage,closedate',
      associations: 'contacts',
      ...(after ? { after } : {}),
    })

    const data = await hubspotFetch<DealsResponse>(`/crm/v3/objects/deals?${params}`)

    for (const deal of data.results) {
      if (ENROLLED_STAGES.has(deal.properties.dealstage ?? '')) {
        const closedate = deal.properties.closedate ?? null
        const contacts = deal.associations?.contacts?.results ?? []
        for (const c of contacts) {
          if (!contactDates.has(c.id)) contactDates.set(c.id, closedate)
        }
      }
    }

    after = data.paging?.next?.after
  } while (after)

  return contactDates
}
