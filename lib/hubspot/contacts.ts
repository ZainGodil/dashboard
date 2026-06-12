import { hubspotFetch } from './client'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// HubSpot list that contains all B2C + WFD leads (maintained in HubSpot UI)
export const LEADS_LIST_ID = '3314' // v1 list ID (ILS segment ID: 5711)

export const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'createdate',
  'hs_lead_status',
  'hubspot_owner_id',
  'course_validation',
  'pick_university',
  'university',
  'hs_analytics_source',
  'hs_analytics_source_data_2',
  'viable_non_viable_leads',
  'lastmodifieddate',
]

export interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface V1Contact {
  vid: number
  properties: Record<string, { value: string | null }>
}

interface ListContactsResponse {
  contacts: V1Contact[]
  'has-more': boolean
  'vid-offset': number
}

function normalizeContact(c: V1Contact): HubSpotContact {
  const properties: Record<string, string | null> = {}
  for (const [key, val] of Object.entries(c.properties)) {
    properties[key] = val?.value ?? null
  }
  return { id: String(c.vid), properties }
}

export async function fetchAllContacts(): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let vidOffset: number | undefined
  const propertyParams = CONTACT_PROPERTIES.map((p) => `property=${encodeURIComponent(p)}`).join('&')

  do {
    const offsetParam = vidOffset !== undefined ? `&vidOffset=${vidOffset}` : ''
    const url = `/contacts/v1/lists/${LEADS_LIST_ID}/contacts/all?count=100&${propertyParams}${offsetParam}`

    const data = await hubspotFetch<ListContactsResponse>(url)
    all.push(...data.contacts.map(normalizeContact))

    if (data['has-more']) {
      vidOffset = data['vid-offset']
      await sleep(150)
    } else {
      vidOffset = undefined
    }
  } while (vidOffset !== undefined)

  return all
}
