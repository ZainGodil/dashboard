import { hubspotFetch } from './client'

const ENROLLED_STAGE = 'Signed Promissory Note / Closed Won'

interface Deal {
  id: string
  properties: { dealstage: string | null }
  associations?: { contacts?: { results: { id: string }[] } }
}

interface DealsResponse {
  results: Deal[]
  paging?: { next?: { after: string } }
}

export async function fetchEnrolledContactIds(): Promise<Set<string>> {
  const contactIds = new Set<string>()
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: 'dealstage',
      associations: 'contacts',
      ...(after ? { after } : {}),
    })

    const data = await hubspotFetch<DealsResponse>(`/crm/v3/objects/deals?${params}`)

    for (const deal of data.results) {
      if (deal.properties.dealstage === ENROLLED_STAGE) {
        const contacts = deal.associations?.contacts?.results ?? []
        for (const c of contacts) contactIds.add(c.id)
      }
    }

    after = data.paging?.next?.after
  } while (after)

  return contactIds
}
