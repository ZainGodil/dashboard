import { describe, it, expect } from 'vitest'
import { parseMonthLabel, sortMonthLabelsDesc, getHalfYearMonths, getHalfYearDateRange } from './periods'

describe('half-year period', () => {
  it('covers Jan 1 – Jun 30 of the current year, even later in the year', () => {
    const oct = new Date(2026, 9, 9)
    expect(getHalfYearMonths(oct)).toEqual(['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'])
    expect(getHalfYearDateRange(oct)).toEqual({ startDate: '2026-01-01', endDate: '2026-06-30' })
  })
})

describe('parseMonthLabel', () => {
  it('parses "Mon-YY" into a Date at the first of that month', () => {
    const d = parseMonthLabel('Jun-26')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June is index 5
  })
})

describe('sortMonthLabelsDesc', () => {
  it('sorts newest first, spanning a year boundary', () => {
    expect(sortMonthLabelsDesc(['Jan-26', 'Dec-25', 'Jun-26'])).toEqual(['Jun-26', 'Jan-26', 'Dec-25'])
  })

  it('does not mutate the input array', () => {
    const input = ['Jan-26', 'Dec-25']
    sortMonthLabelsDesc(input)
    expect(input).toEqual(['Jan-26', 'Dec-25'])
  })
})
