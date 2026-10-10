import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hubspotFetch } from '../hubspot/client'
import { bookingsByEmail, fetchContactEmails } from './bookings'

vi.mock('../hubspot/client', () => ({ hubspotFetch: vi.fn() }))

beforeEach(() => vi.mocked(hubspotFetch).mockReset())

describe('bookingsByEmail', () => {
  it('matches enrollments to emails and adds up a student with several enrollments', () => {
    const totals = bookingsByEmail(
      [
        { hubspot_contact_id: '1', deal_amount: 5000 },
        { hubspot_contact_id: '2', deal_amount: '4500.50' },
        { hubspot_contact_id: '3', deal_amount: 1000 },
        { hubspot_contact_id: '4', deal_amount: null },
        { hubspot_contact_id: '9', deal_amount: 700 }, // no email on file
      ],
      [
        { hubspot_id: '1', email: 'A@Example.com ' },
        { hubspot_id: '2', email: 'b@example.com' },
        { hubspot_id: '3', email: 'a@example.com' },
        { hubspot_id: '4', email: 'c@example.com' },
      ],
    )
    expect(Object.fromEntries(totals)).toEqual({ 'a@example.com': 6000, 'b@example.com': 4500.5 })
  })
})

describe('fetchContactEmails', () => {
  it('reads only the email property, 100 contacts per request', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1))
    vi.mocked(hubspotFetch)
      .mockResolvedValueOnce({ results: ids.slice(0, 100).map((id) => ({ id, properties: { email: ` User${id}@Example.com ` } })) })
      .mockResolvedValueOnce({ results: ids.slice(100).map((id) => ({ id, properties: { email: null } })) })

    const emails = await fetchContactEmails(ids)

    expect(hubspotFetch).toHaveBeenCalledTimes(2)
    const body = JSON.parse(String(vi.mocked(hubspotFetch).mock.calls[0][1]?.body))
    expect(body.properties).toEqual(['email'])
    expect(body.inputs).toHaveLength(100)
    expect(emails.get('1')).toBe('user1@example.com')
    expect(emails.get('150')).toBeNull()
  })
})
