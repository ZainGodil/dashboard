import { hubspotFetch } from './client'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'createdate',
  'hs_lead_status',
  'hubspot_owner_id',
  'program',
  'pick_university',
  'university',
  'b2he',
  'hs_analytics_source',
  'lastmodifieddate',
]

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface SearchResponse {
  total: number
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

// Incremental sync: contacts modified since a given date (lastmodifieddate filter)
async function fetchContactsSince(afterDate: Date): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      limit: 100,
      properties: CONTACT_PROPERTIES,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      filterGroups: [{
        filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: String(afterDate.getTime()) }],
      }],
    }
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...data.results)
    after = data.paging?.next?.after
    if (after) await sleep(150)
  } while (after)

  return all
}

// Date-range fetch: contacts with createdate between from and to (used for monthly chunks)
async function fetchContactsInRange(from: Date, to: Date): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      limit: 100,
      properties: CONTACT_PROPERTIES,
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: String(from.getTime()) },
          { propertyName: 'createdate', operator: 'LTE', value: String(to.getTime()) },
        ],
      }],
    }
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...data.results)
    after = data.paging?.next?.after
    if (after) await sleep(150)
  } while (after)

  return all
}

export async function fetchAllContacts(afterDate?: Date): Promise<HubSpotContact[]> {
  if (afterDate) return fetchContactsSince(afterDate)

  // Full refresh: chunk by month to stay under HubSpot search API's 10,000-result limit.
  // ~1,700 contacts/month avg for this portal, well under the limit per chunk.
  const all: HubSpotContact[] = []
  const now = new Date()

  for (let monthsBack = 24; monthsBack >= 0; monthsBack--) {
    const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const to = monthsBack === 0
      ? now
      : new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59, 999)

    const batch = await fetchContactsInRange(from, to)
    all.push(...batch)
  }

  return all
}
