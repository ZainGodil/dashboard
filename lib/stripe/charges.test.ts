import { describe, it, expect, vi, afterEach } from 'vitest'
import { chicagoMonth, toPaymentRecord, fetchChargesSince, type StripeCharge } from './charges'

const base: StripeCharge = {
  id: 'ch_1',
  amount: 45455,
  amount_refunded: 0,
  currency: 'usd',
  status: 'succeeded',
  created: Date.UTC(2026, 6, 19, 18, 16) / 1000,
  description: 'Installment 4 of 11',
  payment_intent: 'pi_1',
  customer: { id: 'cus_1', email: ' Student@Example.com ', name: 'Sample Student' },
  billing_details: { email: 'billing@example.com', name: 'Billing Name' },
  receipt_email: null,
  failure_code: null,
  failure_message: null,
  payment_method_details: { type: 'card' },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('chicagoMonth', () => {
  it('buckets by America/Chicago, not UTC', () => {
    // 2026-08-01 03:00 UTC is still July 31 in Chicago
    expect(chicagoMonth(Date.UTC(2026, 7, 1, 3, 0) / 1000)).toBe('Jul-26')
    expect(chicagoMonth(Date.UTC(2026, 7, 1, 12, 0) / 1000)).toBe('Aug-26')
  })
})

describe('toPaymentRecord', () => {
  it('converts cents to dollars and prefers the customer email, lower-cased and trimmed', () => {
    const r = toPaymentRecord(base)
    expect(r.amount).toBe(454.55)
    expect(r.customer_email).toBe('student@example.com')
    expect(r.customer_name).toBe('Sample Student')
    expect(r.customer_id).toBe('cus_1')
    expect(r.month).toBe('Jul-26')
    expect(r.payment_method).toBe('card')
  })

  it('falls back to billing details when the customer is a bare id or deleted', () => {
    expect(toPaymentRecord({ ...base, customer: 'cus_2' }).customer_email).toBe('billing@example.com')
    const deleted = toPaymentRecord({ ...base, customer: { id: 'cus_3', deleted: true } })
    expect(deleted.customer_email).toBe('billing@example.com')
    expect(deleted.customer_name).toBe('Billing Name')
    expect(deleted.customer_id).toBe('cus_3')
  })

  it('keeps the decline reason on failed charges, using the outcome message when failure_message is empty', () => {
    const r = toPaymentRecord({ ...base, status: 'failed', failure_code: 'card_declined', failure_message: null, outcome: { seller_message: 'The bank did not return any further details.' } })
    expect(r.failure_code).toBe('card_declined')
    expect(r.failure_message).toBe('The bank did not return any further details.')
  })
})

describe('fetchChargesSince', () => {
  it('pages with starting_after until has_more is false', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_123')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ ...base, id: 'ch_a' }, { ...base, id: 'ch_b' }], has_more: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ ...base, id: 'ch_c' }], has_more: false }) })
    vi.stubGlobal('fetch', fetchMock)

    const charges = await fetchChargesSince(new Date('2026-01-01T00:00:00Z'))

    expect(charges.map((c) => c.id)).toEqual(['ch_a', 'ch_b', 'ch_c'])
    expect(String(fetchMock.mock.calls[1][0])).toContain('starting_after=ch_b')
    expect(String(fetchMock.mock.calls[0][0])).toContain('expand%5B%5D=data.customer')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer rk_test_123')
  })

  it('throws Stripe’s error message on a failed request', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden', json: async () => ({ error: { message: 'The provided key does not have the required permissions' } }) }))
    await expect(fetchChargesSince(new Date())).rejects.toThrow('Stripe 403: The provided key does not have the required permissions')
  })
})
