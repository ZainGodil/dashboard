import { hubspotFetch } from './client'

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
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
  total: number
}

export async function fetchAllContacts(afterDate?: Date): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  const filters = afterDate
    ? [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: afterDate.toISOString() }]
    : []

  do {
    const body: Record<string, unknown> = {
      limit: 100,
      properties: CONTACT_PROPERTIES,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    }
    if (filters.length) body.filterGroups = [{ filters }]
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...data.results)
    after = data.paging?.next?.after
  } while (after)

  return all
}
