import { describe, it, expect } from 'vitest'
import { buildStripeView, type PaymentRow } from './stripe-view'

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
    expect(v.monthly.find((m) => m.month === 'Sep')).toEqual({ month: 'Sep', collected: 400, failed: 250 })
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
})
