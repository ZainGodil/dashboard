import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hubspotFetch } from './client'
import {
  IncrementalUnavailableError,
  batchReadContacts,
  batchReadAssociations,
  fetchListMemberIds,
  searchModifiedContacts,
} from './incremental'
import { buildEnrolledMap, type FullDeal } from './deals'

vi.mock('./client', () => ({ hubspotFetch: vi.fn() }))

beforeEach(() => {
  vi.mocked(hubspotFetch).mockReset()
})

describe('batchReadContacts', () => {
  it('converts v3 ISO createdate to the epoch-ms string the v1 list API returns', async () => {
    vi.mocked(hubspotFetch).mockResolvedValueOnce({
      results: [{ id: 'c1', properties: { createdate: '2026-08-03T15:00:00.000Z', firstname: 'Ana' } }],
    })

    const [contact] = await batchReadContacts(['c1'])

    expect(contact.properties.createdate).toBe(String(Date.parse('2026-08-03T15:00:00.000Z')))
    expect(contact.properties.firstname).toBe('Ana')
  })

  it('makes no request for an empty id list', async () => {
    expect(await batchReadContacts([])).toEqual([])
    expect(hubspotFetch).not.toHaveBeenCalled()
  })
})

describe('searchModifiedContacts', () => {
  it('bails out to a full sync when results exceed the search cap', async () => {
    vi.mocked(hubspotFetch).mockResolvedValueOnce({ total: 10001, results: [] })

    await expect(searchModifiedContacts(0)).rejects.toBeInstanceOf(IncrementalUnavailableError)
  })

  it('paginates until "after" is absent', async () => {
    vi.mocked(hubspotFetch)
      .mockResolvedValueOnce({ total: 2, results: [{ id: 'c1', properties: {} }], paging: { next: { after: '1' } } })
      .mockResolvedValueOnce({ total: 2, results: [{ id: 'c2', properties: {} }] })

    const contacts = await searchModifiedContacts(0)

    expect(contacts.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('fetchListMemberIds', () => {
  it('accepts both object and bare-string membership results', async () => {
    vi.mocked(hubspotFetch)
      .mockResolvedValueOnce({ results: [{ recordId: 101 }, { recordId: '102' }], paging: { next: { after: 'x' } } })
      .mockResolvedValueOnce({ results: ['103'] })

    const ids = await fetchListMemberIds()

    expect(Array.from(ids)).toEqual(['101', '102', '103'])
  })

  it('reports API failures as IncrementalUnavailableError', async () => {
    vi.mocked(hubspotFetch).mockRejectedValueOnce(new Error('HubSpot API error 403: missing scope'))

    await expect(fetchListMemberIds()).rejects.toBeInstanceOf(IncrementalUnavailableError)
  })
})

describe('batchReadAssociations', () => {
  it('returns target ids de-duplicated and in ascending numeric order', async () => {
    vi.mocked(hubspotFetch).mockResolvedValueOnce({
      results: [{ from: { id: 'd1' }, to: [{ toObjectId: 30 }, { toObjectId: 4 }, { toObjectId: 30 }] }],
    })

    const map = await batchReadAssociations('deals', 'contacts', ['d1'])

    expect(map.get('d1')).toEqual(['4', '30'])
  })
})

describe('buildEnrolledMap', () => {
  const deal = (id: string, dealstage: string, contactIds: string[], closedate: string): FullDeal => ({
    id,
    properties: { dealstage, pipeline: 'p', closedate, amount: '4500', payment_frequency: null, hubspot_owner_id: null },
    associations: { contacts: { results: contactIds.map((c) => ({ id: c })) } },
  })

  it('keeps only enrolled-stage deals and lets the first deal per contact win', () => {
    const map = buildEnrolledMap([
      deal('1', '124944662', ['c1'], '2026-07-01'),
      deal('2', '1335758964', ['c1', 'c2'], '2026-08-01'),
      deal('3', 'other-stage', ['c3'], '2026-08-01'),
    ])

    expect(map.get('c1')?.closedate).toBe('2026-07-01')
    expect(map.get('c2')?.closedate).toBe('2026-08-01')
    expect(map.has('c3')).toBe(false)
  })
})
