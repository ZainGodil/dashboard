import { describe, it, expect } from 'vitest'
import { buildStripeView, studentKey, type PaymentRow } from './stripe-view'

const NOW = new Date('2026-10-06T17:00:00Z')

function row(p: Partial<PaymentRow>): PaymentRow {
  return {
    status: 'succeeded',
    amount: 500,
    amount_refunded: 0,
    created_at: '2026-09-10T15:00:00Z',
    month: 'Sep-26',
    customer_email: 'a@example.com',
    customer_name: 'Student A',
    failure_message: null,
    ...p,
  }
}

describe('buildStripeView', () => {
  it('totals collected per month net of refunds, and failed amounts separately', () => {
    const v = buildStripeView([
      row({ amount: 500, amount_refunded: 100 }),
      row({ status: 'failed', amount: 250, failure_message: 'Your card was declined.' }),
      row({ status: 'pending', amount: 999 }),
      row({ month: 'Oct-26', created_at: '2026-10-02T15:00:00Z' }),
      row({ month: 'Dec-25', created_at: '2025-12-10T15:00:00Z', amount: 700 }),
    ], NOW)

    expect(v.year).toBe(2026)
    expect(v.monthly.find((m) => m.month === 'Sep')).toEqual({ month: 'Sep', stripe: 400, other: 0, collected: 400, failed: 250 })
    expect(v.collectedYtd).toBe(900) // the Dec-25 payment is outside the year
    expect(v.thisMonthLabel).toBe('Oct')
    expect(v.collectedThisMonth).toBe(500)
  })

  it('marks a month paid when any charge succeeded, missed when only failures, with the decline reason', () => {
    const v = buildStripeView([
      row({ month: 'Aug-26', created_at: '2026-08-05T15:00:00Z', status: 'failed', failure_message: 'Insufficient funds.' }),
      row({ month: 'Aug-26', created_at: '2026-08-07T15:00:00Z' }),
      row({ month: 'Sep-26', created_at: '2026-09-05T15:00:00Z', status: 'failed', failure_message: 'Insufficient funds.' }),
    ], NOW)

    const s = v.students[0]
    expect(s.cells[7]).toEqual({ state: 'paid', amount: 500 })
    expect(s.cells[8]).toEqual({ state: 'missed', reason: 'Insufficient funds.' })
    expect(s.cells[9]).toEqual({ state: 'none' })
  })

  it('flags a student whose latest attempt failed, and one with no payment in 45+ days, but not a long-gone payer', () => {
    const v = buildStripeView([
      row({ customer_email: 'failed@example.com', customer_name: 'Failed Student', created_at: '2026-10-01T15:00:00Z', month: 'Oct-26', status: 'failed', failure_message: 'Your card was declined.' }),
      row({ customer_email: 'quiet@example.com', customer_name: 'Quiet Student', created_at: '2026-07-20T15:00:00Z', month: 'Jul-26' }),
      row({ customer_email: 'old@example.com', customer_name: 'Finished Student', created_at: '2026-03-01T15:00:00Z', month: 'Mar-26' }),
      row({ customer_email: 'ok@example.com', customer_name: 'On Track', created_at: '2026-10-01T15:00:00Z', month: 'Oct-26' }),
    ], NOW)

    expect(v.exceptions.map((e) => e.name).sort()).toEqual(['Failed Student', 'Quiet Student'])
    expect(v.exceptions.find((e) => e.name === 'Failed Student')?.reason).toBe('Last payment failed: Your card was declined.')
    expect(v.exceptions.find((e) => e.name === 'Quiet Student')?.reason).toBe('No payment in 78 days')
    // flagged students sort to the top of the grid
    expect(v.students.slice(0, 2).map((s) => s.name).sort()).toEqual(['Failed Student', 'Quiet Student'])
  })

  it('counts failed charges in the last 30 days and students who paid in the last 60', () => {
    const v = buildStripeView([
      row({ status: 'failed', created_at: '2026-09-20T15:00:00Z', amount: 300 }),
      row({ status: 'failed', created_at: '2026-08-01T15:00:00Z', month: 'Aug-26', amount: 300 }),
      row({ customer_email: 'b@example.com', created_at: '2026-09-01T15:00:00Z' }),
      row({ customer_email: 'c@example.com', created_at: '2026-06-01T15:00:00Z', month: 'Jun-26' }),
    ], NOW)

    expect(v.failedLast30).toEqual({ count: 1, amount: 300 })
    expect(v.payingStudents).toBe(1)
  })

  it('merges manual payments into the same student by email and splits them out in the monthly totals', () => {
    const v = buildStripeView([
      row({ customer_email: 'a@example.com', amount: 500 }),
      row({ customer_email: 'A@Example.com ', customer_name: null, amount: 1000, source: 'WFD' }),
    ], NOW)

    expect(v.students).toHaveLength(1)
    expect(v.students[0].sources).toEqual(['Stripe', 'WFD'])
    expect(v.students[0].cells[8]).toEqual({ state: 'paid', amount: 1500 })
    expect(v.monthly[8]).toMatchObject({ stripe: 500, other: 1000, collected: 1500 })
    expect(v.collectedOtherYtd).toBe(1000)
  })

  it('keys students without an email by name, and applies saved statuses', () => {
    const v = buildStripeView(
      [row({ customer_email: null, customer_name: 'Lender Student', source: 'Sallie Mae' })],
      NOW,
      new Map([[studentKey(null, 'Lender Student'), 'Active' as const]]),
    )
    expect(v.students[0].key).toBe('name:Lender Student')
    expect(v.students[0].status).toBe('Active')
  })

  it('does not flag a graduate for going quiet, but still flags a graduate whose last payment failed', () => {
    const quiet = row({ customer_email: 'grad@example.com', created_at: '2026-07-20T15:00:00Z', month: 'Jul-26' })
    const failed = row({ customer_email: 'grad2@example.com', created_at: '2026-10-01T15:00:00Z', month: 'Oct-26', status: 'failed' })
    const statuses = new Map([['grad@example.com', 'Graduated' as const], ['grad2@example.com', 'Graduated' as const]])

    expect(buildStripeView([quiet, failed], NOW, statuses).exceptions.map((e) => e.email)).toEqual(['grad2@example.com'])
    expect(buildStripeView([quiet], NOW).exceptions).toHaveLength(1)
  })
})
