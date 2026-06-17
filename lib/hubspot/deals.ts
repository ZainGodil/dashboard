import { hubspotFetch } from './client'

const ENROLLED_STAGES = new Set([
  // B2C Interview pipeline — "Signed Promissory Note / Closed Won"
  '124944662',
  // Hidden Talent B2C pipeline — "Signed Promissory Note / Closed Won"
  '1335758964',
])

interface Deal {
  id: string
  properties: { dealstage: string | null; closedate: string | null; amount?: string | null }
  associations?: { contacts?: { results: { id: string }[] } }
}

interface DealsResponse {
  results: Deal[]
  paging?: { next?: { after: string } }
}

// Fetches total deal revenue for deals closed in the current calendar month
// using HubSpot search API to avoid paginating all deals.
export async function fetchMtdBookingRevenue(): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`

  let total = 0
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      filterGroups: Array.from(ENROLLED_STAGES).map((stageId) => ({
        filters: [
          { propertyName: 'dealstage', operator: 'EQ', value: stageId },
          { propertyName: 'closedate', operator: 'GTE', value: monthStart },
          { propertyName: 'closedate', operator: 'LT', value: nextMonthStart },
        ],
      })),
      properties: ['dealstage', 'closedate', 'amount'],
      limit: 100,
    }
    if (after) body.after = after

    const data = await hubspotFetch<DealsResponse>('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    for (const deal of data.results) {
      total += Number(deal.properties.amount ?? 0)
    }

    after = data.paging?.next?.after
  } while (after)

  return total
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
