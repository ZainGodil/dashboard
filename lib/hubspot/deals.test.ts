import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hubspotFetch } from './client'
import { fetchDealStageLabelMap, fetchAllDeals } from './deals'

vi.mock('./client', () => ({ hubspotFetch: vi.fn() }))

beforeEach(() => {
  vi.mocked(hubspotFetch).mockReset()
})

describe('fetchDealStageLabelMap', () => {
  it('builds a pipelineId:stageId -> label map across all pipelines', async () => {
    vi.mocked(hubspotFetch).mockResolvedValueOnce({
      results: [
        { id: 'p1', stages: [{ id: 's1', label: 'Invoice Sent' }, { id: 's2', label: 'Student' }] },
        { id: 'p2', stages: [{ id: 's1', label: 'Open Deal' }] },
      ],
    })

    const map = await fetchDealStageLabelMap()

    expect(map.get('p1:s1')).toBe('Invoice Sent')
    expect(map.get('p1:s2')).toBe('Student')
    expect(map.get('p2:s1')).toBe('Open Deal') // disambiguated by pipeline, not a collision with p1:s1
  })
})

describe('fetchAllDeals', () => {
  it('resolves advisor name and stage label, and paginates until "after" is absent', async () => {
    const ownerMap = new Map([['999', 'Shawn Miller']])
    const stageLabelMap = new Map([['p1:s1', 'Invoice Sent']])

    vi.mocked(hubspotFetch)
      .mockResolvedValueOnce({
        results: [{
          id: 'd1',
          properties: {
            dealstage: 's1',
            pipeline: 'p1',
            closedate: '2026-06-16T00:00:00.000Z',
            amount: '4500',
            payment_frequency: 'One Time',
            hubspot_owner_id: '999',
          },
          associations: { contacts: { results: [{ id: 'c1' }] } },
        }],
        paging: { next: { after: 'abc' } },
      })
      .mockResolvedValueOnce({ results: [] })

    const deals = await fetchAllDeals(ownerMap, stageLabelMap)

    expect(deals).toEqual([{
      hubspot_deal_id: 'd1',
      contact_hubspot_id: 'c1',
      advisor: 'Shawn Miller',
      stage_label: 'Invoice Sent',
      amount: 4500,
      payment_frequency: 'One Time',
      close_date_raw: '2026-06-16T00:00:00.000Z',
    }])
    expect(hubspotFetch).toHaveBeenCalledTimes(2)
  })

  it('leaves advisor and stage_label null when lookups miss', async () => {
    vi.mocked(hubspotFetch).mockResolvedValueOnce({
      results: [{
        id: 'd2',
        properties: { dealstage: 'unknown', pipeline: 'p9', closedate: null, amount: null, payment_frequency: null, hubspot_owner_id: null },
        associations: { contacts: { results: [] } },
      }],
    })

    const deals = await fetchAllDeals(new Map(), new Map())

    expect(deals).toEqual([{
      hubspot_deal_id: 'd2',
      contact_hubspot_id: null,
      advisor: null,
      stage_label: null,
      amount: null,
      payment_frequency: null,
      close_date_raw: null,
    }])
  })
})
