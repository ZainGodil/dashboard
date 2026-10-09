import { describe, it, expect, vi, afterEach } from 'vitest'
import { toIsoDate, toDealRows, fetchDeals, authorizeUrl, type PaycoveDeal } from './client'

afterEach(() => vi.unstubAllGlobals())

const deal = (p: Partial<PaycoveDeal> = {}): PaycoveDeal => ({
  id: 3921,
  name: 'UI/UX Design plan',
  deal_type: 'invoice',
  status: 'Overdue',
  total_amount: '186.83',
  total_amount_paid: 0,
  remaining_balance: 186.83,
  payments_paid: 0,
  payments_unpaid: 2,
  payments_scheduled: 2,
  days_overdue: 12,
  crm_deal_id: '5557',
  crm_contact_id: '2525',
  created_at: '2026-06-17 23:36:06',
  payments: [
    { id: 6746, deal_id: 3921, number: 1, description: null, due: '2026-08-10', paid_at_date: null, is_paid: 0, value: 93.42, payable: 1 },
    { id: 6747, deal_id: 3921, number: 2, description: null, due: null, paid_at_date: null, is_paid: 0, value: '93.41', payable: 1 },
  ],
  ...p,
})

describe('toIsoDate', () => {
  it('reads the date formats Paycove uses', () => {
    expect(toIsoDate('2026-08-15')).toBe('2026-08-15')
    expect(toIsoDate('2026-08-15T00:00:00.000000Z')).toBe('2026-08-15')
    expect(toIsoDate('2026-08-15 16:40:38')).toBe('2026-08-15')
    expect(toIsoDate('08.23.21')).toBe('2021-08-23')
    expect(toIsoDate(null)).toBeNull()
    expect(toIsoDate('soon')).toBeNull()
  })
})

describe('toDealRows', () => {
  it('joins the student email through the CRM contact id and maps installments', () => {
    const { dealRows, paymentRows } = toDealRows(
      [deal()],
      [{ crm_contact_id: '2525', name: ' Sample Student ', email: ' Sample@Example.com ' }],
      '2026-10-09T12:00:00Z',
    )
    expect(dealRows[0]).toMatchObject({ id: 3921, student_name: 'Sample Student', student_email: 'sample@example.com', total_amount: 186.83, payments_unpaid: 2 })
    expect(paymentRows).toEqual([
      expect.objectContaining({ id: 6746, deal_id: 3921, due_on: '2026-08-10', amount: 93.42, is_paid: false, payable: true }),
      expect.objectContaining({ id: 6747, due_on: null, amount: 93.41 }),
    ])
  })

  it('skips quotes and leaves the email empty when the contact is unknown', () => {
    const { dealRows } = toDealRows([deal(), deal({ id: 1, deal_type: 'quote' })], [], '2026-10-09T12:00:00Z')
    expect(dealRows.map((d) => d.id)).toEqual([3921])
    expect(dealRows[0].student_email).toBeNull()
  })
})

describe('fetchDeals', () => {
  it('reads every page with payments included, using the bearer token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [deal({ id: 1 })], current_page: 1, last_page: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [deal({ id: 2 })], current_page: 2, last_page: 2 }) })
    vi.stubGlobal('fetch', fetchMock)

    const deals = await fetchDeals('tok_123')

    expect(deals.map((d) => d.id)).toEqual([1, 2])
    expect(String(fetchMock.mock.calls[0][0])).toContain('include_payments=true')
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok_123')
  })

  it('reports Paycove errors with the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Unauthenticated.' }) }))
    await expect(fetchDeals('bad')).rejects.toThrow('Paycove 401 on /api/v1/deals: Unauthenticated.')
  })
})

describe('authorizeUrl', () => {
  it('builds the Paycove consent URL', () => {
    const url = new URL(authorizeUrl('27', 'https://app.example/api/paycove/callback', 'abc'))
    expect(url.origin + url.pathname).toBe('https://paycove.io/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('27')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('abc')
  })
})
