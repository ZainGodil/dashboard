import { hubspotFetch } from './client'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Advisors who handle B2C and WFD leads.
export const ADVISOR_OWNER_IDS = [
  '77266426', // Kevin Shafer
  '80594832',
  '82598427', // Quinn Ali
  '751671020', // Hawama Sattar
  '82724983',
  '86817401',
  '86293470',
  '88207148', // Shawn Miller
]

export const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'createdate',
  'hs_lead_status',
  'hubspot_owner_id',
  'course_validation',
  'pick_university',
  'university',
  'b2b',
  'hs_analytics_source',
  'hs_analytics_source_data_2',
  'lastmodifieddate',
]

const OWNER_FILTER = {
  propertyName: 'hubspot_owner_id',
  operator: 'IN',
  values: ADVISOR_OWNER_IDS,
}

const B2B_EXCLUDE_FILTER = {
  propertyName: 'b2b',
  operator: 'NEQ',
  value: 'true',
}

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
        filters: [
          { propertyName: 'lastmodifieddate', operator: 'GTE', value: String(afterDate.getTime()) },
          OWNER_FILTER,
          B2B_EXCLUDE_FILTER,
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

// Date-range fetch: contacts with createdate between from and to (monthly chunks for full refresh)
async function fetchContactsInRange(from: Date, to: Date): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      limit: 200,
      properties: CONTACT_PROPERTIES,
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: String(from.getTime()) },
          { propertyName: 'createdate', operator: 'LTE', value: String(to.getTime()) },
          OWNER_FILTER,
          B2B_EXCLUDE_FILTER,
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
    if (after) await sleep(100)
  } while (after)

  return all
}

export async function fetchAllContacts(afterDate?: Date): Promise<HubSpotContact[]> {
  if (afterDate) return fetchContactsSince(afterDate)

  // Full refresh: last 6 months in monthly chunks to fit Vercel 60s limit.
  // Incremental cron keeps data current; extend MONTHS_BACK for historical backfill runs.
  const MONTHS_BACK = 6
  const all: HubSpotContact[] = []
  const now = new Date()

  for (let monthsBack = MONTHS_BACK; monthsBack >= 0; monthsBack--) {
    const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const to = monthsBack === 0
      ? now
      : new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59, 999)

    const batch = await fetchContactsInRange(from, to)
    all.push(...batch)
  }

  return all
}
