import { describe, it, expect } from 'vitest'
import { buildPlansView, planLabel, type PlanDeal, type PlanPayment } from './plans'

const TODAY = '2026-10-09'

const deal = (p: Partial<PlanDeal> = {}): PlanDeal => ({
  id: 1, name: 'UI/UX Design', status: 'Open', student_name: 'Student A', student_email: 'a@example.com', total_amount: 1200, remaining_balance: null, ...p,
})
const pay = (p: Partial<PlanPayment> = {}): PlanPayment => ({ deal_id: 1, number: 1, due_on: '2026-08-15', amount: 100, is_paid: true, payable: true, ...p })

// 12 monthly installments Jan–Dec 2026, Jan–Jul paid, Aug and Sep missed, Oct–Dec upcoming
const twelve = Array.from({ length: 12 }, (_, i) => pay({
  number: i + 1,
  due_on: `2026-${String(i + 1).padStart(2, '0')}-15`,
  is_paid: i < 7,
}))

describe('buildPlansView', () => {
  it('counts paid, remaining and overdue installments month by month', () => {
    const v = buildPlansView([deal()], twelve, TODAY)
    const s = v.byKey.get('a@example.com')!
    expect(s).toMatchObject({ installments: 12, paid: 7, remaining: 5, remainingAmount: 500, overdue: 2, overdueAmount: 200, oldestOverdue: '2026-08-15' })
    expect(s.nextDue).toEqual({ on: '2026-10-15', amount: 100 })
    expect(v).toMatchObject({ remainingTotal: 500, activePlans: 1, overdueCount: 2, overdueAmount: 200, dueNext30: 100 })
  })

  it('prefers Paycove’s remaining balance when it has one', () => {
    expect(buildPlansView([deal({ remaining_balance: 455.5 })], twelve, TODAY).remainingTotal).toBe(455.5)
  })

  it('flags overdue installments with the count, amount and oldest date', () => {
    const [e] = buildPlansView([deal()], twelve, TODAY).exceptions
    expect(e).toMatchObject({ key: 'a@example.com', kind: 'overdue', since: '2026-08-15T12:00:00Z' })
    expect(e.reason).toBe('2 installments overdue, $200 (oldest due Aug 15, 2026)')
  })

  it('flags a dropped student with a balance even before anything is overdue, and skips graduates', () => {
    const upcomingOnly = [pay({ due_on: '2026-11-15', is_paid: false })]
    const dropped = buildPlansView([deal()], upcomingOnly, TODAY, new Map([['a@example.com', 'Dropped' as const]])).exceptions
    expect(dropped[0].reason).toBe('Dropped with $100 still owed on the plan')
    expect(buildPlansView([deal()], twelve, TODAY, new Map([['a@example.com', 'Graduated' as const]])).exceptions).toHaveLength(0)
  })

  it('ignores installments that are not payable and has no flag for a plan on track', () => {
    const v = buildPlansView([deal()], [pay({ is_paid: false, due_on: '2026-09-01', payable: false }), pay({ due_on: '2026-11-01', is_paid: false })], TODAY)
    expect(v.byKey.get('a@example.com')).toMatchObject({ installments: 1, overdue: 0 })
    expect(v.exceptions).toHaveLength(0)
  })

  it('adds up several plans for the same student', () => {
    const v = buildPlansView([deal(), deal({ id: 2, student_email: 'A@Example.com' })], [pay({ is_paid: false, due_on: '2026-11-01' }), pay({ deal_id: 2, is_paid: false, due_on: '2026-12-01' })], TODAY)
    expect(v.students).toHaveLength(1)
    expect(v.students[0]).toMatchObject({ plans: 2, remaining: 2, remainingAmount: 200 })
  })
})

describe('planLabel', () => {
  it('summarises a plan for the grid', () => {
    const v = buildPlansView([deal()], twelve, TODAY)
    expect(planLabel(v.byKey.get('a@example.com'))).toBe('7 of 12 paid · $500 left · 2 overdue')
    const onTrack = buildPlansView([deal()], [pay(), pay({ number: 2, due_on: '2026-11-15', is_paid: false })], TODAY)
    expect(planLabel(onTrack.byKey.get('a@example.com'))).toBe('1 of 2 paid · $100 left · next Nov 15')
    expect(planLabel(undefined)).toBe('—')
  })
})
