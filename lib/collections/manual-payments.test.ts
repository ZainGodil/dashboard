import { describe, it, expect } from 'vitest'
import { parseManualPayment } from './manual-payments'

const TODAY = new Date('2026-10-06T17:00:00Z')
const valid = { student_name: '  Sample Student ', student_email: ' Sample@Example.com ', payer: 'WFD', amount: '1500.50', paid_on: '2026-09-30', note: ' check #123 ' }

describe('parseManualPayment', () => {
  it('cleans a valid entry and derives the month label', () => {
    expect(parseManualPayment(valid, TODAY)).toEqual({
      student_name: 'Sample Student',
      student_email: 'sample@example.com',
      payer: 'WFD',
      amount: 1500.5,
      paid_on: '2026-09-30',
      month: 'Sep-26',
      note: 'check #123',
    })
  })

  it('allows a missing email and note', () => {
    const r = parseManualPayment({ ...valid, student_email: '', note: '' }, TODAY)
    expect(r).toMatchObject({ student_email: null, note: null })
  })

  it.each([
    [{ student_name: ' ' }, 'Student name is required.'],
    [{ student_email: 'not-an-email' }, 'That email address doesn’t look right.'],
    [{ payer: 'Venmo' }, 'Pick who paid from the list.'],
    [{ amount: 0 }, 'Amount must be more than $0.'],
    [{ amount: 'abc' }, 'Amount must be more than $0.'],
    [{ paid_on: '2026-02-30' }, 'Payment date is not a valid date.'],
    [{ paid_on: '2026-12-01' }, 'Payment date can’t be in the future.'],
  ])('rejects %o', (patch, message) => {
    expect(parseManualPayment({ ...valid, ...patch }, TODAY)).toEqual({ error: message })
  })
})
