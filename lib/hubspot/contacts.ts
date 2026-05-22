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

interface ListResponse {
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

interface SearchResponse extends ListResponse {
  total: number
}

// Full refresh: use the list endpoint (higher rate limit than search)
async function fetchAllContactsList(): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({ limit: '100' })
    for (const p of CONTACT_PROPERTIES) params.append('properties', p)
    if (after) params.set('after', after)

    const data = await hubspotFetch<ListResponse>(`/crm/v3/objects/contacts?${params}`)
    all.push(...data.results)
    after = data.paging?.next?.after
  } while (after)

  return all
}

// Incremental sync: use search to filter by lastmodifieddate
async function fetchContactsSince(afterDate: Date): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      limit: 100,
      properties: CONTACT_PROPERTIES,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      filterGroups: [{
        filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: afterDate.toISOString() }],
      }],
    }
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...data.results)
    after = data.paging?.next?.after
    if (after) await sleep(300)
  } while (after)

  return all
}

export async function fetchAllContacts(afterDate?: Date): Promise<HubSpotContact[]> {
  return afterDate ? fetchContactsSince(afterDate) : fetchAllContactsList()
}
