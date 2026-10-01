import { hubspotFetch } from './client'
import { CONTACT_PROPERTIES, type HubSpotContact } from './contacts'
import { DEAL_PROPERTIES, type FullDeal } from './deals'

// Helpers for the incremental HubSpot sync: fetch only records modified since the
// last successful sync instead of re-reading the whole list and every deal.

// ILS id of the leads list (v1 id 3314, see LEADS_LIST_ID in contacts.ts)
export const LEADS_ILS_LIST_ID = '5711'

// HubSpot's search API stops paging at 10,000 results
const SEARCH_RESULT_CAP = 10000
const BATCH_SIZE = 100

// Thrown when the incremental path can't produce a complete answer, so the caller
// falls back to a full sync rather than writing partial data.
export class IncrementalUnavailableError extends Error {}

interface V3Object {
  id: string
  properties: Record<string, string | null>
}

interface SearchResponse {
  total: number
  results: V3Object[]
  paging?: { next?: { after: string } }
}

interface BatchResponse {
  results: V3Object[]
}

// v1 list contacts return createdate as epoch ms; v3 returns ISO. Normalise to the
// v1 shape so the row mapping in the sync route treats both the same way.
function toV1Shape(o: V3Object): HubSpotContact {
  const properties = { ...o.properties }
  if (properties.createdate && !/^\d+$/.test(properties.createdate)) {
    properties.createdate = String(new Date(properties.createdate).getTime())
  }
  return { id: o.id, properties }
}

async function searchModifiedSince(
  objectType: 'contacts' | 'deals',
  modifiedProperty: string,
  sinceMs: number,
  properties: string[]
): Promise<V3Object[]> {
  const all: V3Object[] = []
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      filterGroups: [{ filters: [{ propertyName: modifiedProperty, operator: 'GTE', value: String(sinceMs) }] }],
      sorts: [{ propertyName: modifiedProperty, direction: 'ASCENDING' }],
      properties,
      limit: 200,
    }
    if (after) body.after = after

    const data = await hubspotFetch<SearchResponse>(`/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data.total > SEARCH_RESULT_CAP) {
      throw new IncrementalUnavailableError(`${data.total} modified ${objectType} exceeds search cap`)
    }
    all.push(...data.results)
    after = data.paging?.next?.after
  } while (after)

  return all
}

export async function searchModifiedContacts(sinceMs: number): Promise<HubSpotContact[]> {
  const results = await searchModifiedSince('contacts', 'lastmodifieddate', sinceMs, CONTACT_PROPERTIES)
  return results.map(toV1Shape)
}

export async function searchModifiedDeals(sinceMs: number): Promise<FullDeal[]> {
  const results = await searchModifiedSince('deals', 'hs_lastmodifieddate', sinceMs, DEAL_PROPERTIES)
  return results.map((r) => ({ id: r.id, properties: r.properties as FullDeal['properties'] }))
}

async function batchRead(objectType: 'contacts' | 'deals', ids: string[], properties: string[]): Promise<V3Object[]> {
  const all: V3Object[] = []
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const data = await hubspotFetch<BatchResponse>(`/crm/v3/objects/${objectType}/batch/read`, {
      method: 'POST',
      body: JSON.stringify({ properties, inputs: ids.slice(i, i + BATCH_SIZE).map((id) => ({ id })) }),
    })
    all.push(...data.results)
  }
  return all
}

export async function batchReadContacts(ids: string[]): Promise<HubSpotContact[]> {
  return (await batchRead('contacts', ids, CONTACT_PROPERTIES)).map(toV1Shape)
}

export async function batchReadDeals(ids: string[]): Promise<FullDeal[]> {
  const results = await batchRead('deals', ids, DEAL_PROPERTIES)
  return results.map((r) => ({ id: r.id, properties: r.properties as FullDeal['properties'] }))
}

interface AssociationBatchResponse {
  results: { from: { id: string }; to: { toObjectId: string | number }[] }[]
}

// Returns Map<fromId, toIds sorted ascending> — ascending id matches the order the
// v3 deals list API embeds associations in, so "first contact" stays consistent.
export async function batchReadAssociations(
  from: 'contacts' | 'deals',
  to: 'contacts' | 'deals',
  ids: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const data = await hubspotFetch<AssociationBatchResponse>(`/crm/v4/associations/${from}/${to}/batch/read`, {
      method: 'POST',
      body: JSON.stringify({ inputs: ids.slice(i, i + BATCH_SIZE).map((id) => ({ id })) }),
    })
    for (const r of data.results) {
      const toIds = Array.from(new Set(r.to.map((t) => String(t.toObjectId))))
      toIds.sort((a, b) => Number(a) - Number(b))
      map.set(String(r.from.id), toIds)
    }
  }
  return map
}

interface MembershipsResponse {
  results: (string | { recordId: string | number })[]
  paging?: { next?: { after: string } }
}

// All contact ids currently in the leads list. IDs only, 250 per page — far lighter
// than paging the list with properties.
export async function fetchListMemberIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  let after: string | undefined

  try {
    do {
      const params = new URLSearchParams({ limit: '250', ...(after ? { after } : {}) })
      const data = await hubspotFetch<MembershipsResponse>(`/crm/v3/lists/${LEADS_ILS_LIST_ID}/memberships?${params}`)
      for (const r of data.results) ids.add(typeof r === 'object' ? String(r.recordId) : String(r))
      after = data.paging?.next?.after
    } while (after)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new IncrementalUnavailableError(`list memberships unavailable: ${msg}`)
  }

  return ids
}
