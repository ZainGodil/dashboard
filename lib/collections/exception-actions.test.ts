import { describe, it, expect } from 'vitest'
import { applyActions, chicagoToday, parseActionInput, type ExceptionAction } from './exception-actions'
import type { ExceptionRow } from './stripe-view'

const flag = (p: Partial<ExceptionRow> = {}): ExceptionRow => ({
  key: 'a@example.com',
  name: 'Student A',
  email: 'a@example.com',
  status: 'Active',
  lastPaidAt: '2026-08-01T15:00:00Z',
  flag: 'review',
  reason: 'Last payment failed',
  kind: 'failed',
  since: '2026-10-01T15:00:00Z',
  ...p,
})

const action = (p: Partial<ExceptionAction> = {}): ExceptionAction => ({
  id: 'act-1',
  student_key: 'a@example.com',
  flag_kind: 'failed',
  flag_since: '2026-10-01T15:00:00+00:00', // Postgres formats timestamps differently; matched by instant
  note: 'Called, card updated',
  follow_up_on: null,
  created_by: 'finance@example.com',
  created_at: '2026-10-02T15:00:00Z',
  ...p,
})

describe('applyActions', () => {
  it('moves a handled flag out of the open queue', () => {
    const { open, handled } = applyActions([flag()], [action()], '2026-10-06')
    expect(open).toHaveLength(0)
    expect(handled[0].action.note).toBe('Called, card updated')
  })

  it('keeps the flag open when the action was for an earlier event', () => {
    const { open } = applyActions([flag({ since: '2026-10-05T15:00:00Z' })], [action()], '2026-10-06')
    expect(open).toHaveLength(1)
    expect(open[0].followUpDue).toBeNull()
  })

  it('does not mix up flag kinds or students', () => {
    const { open } = applyActions(
      [flag({ kind: 'quiet' }), flag({ key: 'b@example.com' })],
      [action()],
      '2026-10-06',
    )
    expect(open).toHaveLength(2)
  })

  it('brings a flag back on its follow-up date and lists it first', () => {
    const { open, handled } = applyActions(
      [flag({ key: 'b@example.com' }), flag()],
      [action({ follow_up_on: '2026-10-06' })],
      '2026-10-06',
    )
    expect(handled).toHaveLength(0)
    expect(open.map((o) => o.key)).toEqual(['a@example.com', 'b@example.com'])
    expect(open[0].followUpDue?.note).toBe('Called, card updated')
  })

  it('stays handled until the follow-up date', () => {
    expect(applyActions([flag()], [action({ follow_up_on: '2026-10-15' })], '2026-10-06').handled).toHaveLength(1)
  })

  it('uses the newest action when there are several', () => {
    const { handled } = applyActions([flag()], [
      action({ id: 'old', note: 'Left voicemail', created_at: '2026-10-02T15:00:00Z' }),
      action({ id: 'new', note: 'Paid by phone', created_at: '2026-10-03T15:00:00Z' }),
    ], '2026-10-06')
    expect(handled[0].action.id).toBe('new')
  })
})

describe('chicagoToday', () => {
  it('uses the Chicago calendar date', () => {
    expect(chicagoToday(new Date('2026-10-07T03:00:00Z'))).toBe('2026-10-06')
  })
})

describe('parseActionInput', () => {
  const valid = { student_key: ' a@example.com ', flag_kind: 'failed', flag_since: '2026-10-01T15:00:00Z', note: ' Called ', follow_up_on: '2026-10-15' }

  it('accepts and cleans a valid action', () => {
    expect(parseActionInput(valid, '2026-10-06')).toEqual({
      student_key: 'a@example.com', flag_kind: 'failed', flag_since: '2026-10-01T15:00:00.000Z', note: 'Called', follow_up_on: '2026-10-15',
    })
    expect(parseActionInput({ ...valid, follow_up_on: '' }, '2026-10-06')).toMatchObject({ follow_up_on: null })
  })

  it.each([
    [{ note: '  ' }, 'Add a note saying what was done.'],
    [{ flag_kind: 'other' }, 'Unknown flag.'],
    [{ flag_since: 'yesterday' }, 'Missing flag date.'],
    [{ follow_up_on: '2026-10-06' }, 'Follow-up date must be after today.'],
    [{ follow_up_on: '15/10/2026' }, 'Follow-up date is not a valid date.'],
  ])('rejects %o', (patch, message) => {
    expect(parseActionInput({ ...valid, ...patch }, '2026-10-06')).toEqual({ error: message })
  })
})
