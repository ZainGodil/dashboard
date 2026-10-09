import { describe, it, expect } from 'vitest'
import { parseMonthLabel, sortMonthLabelsDesc, getHalfYearMonths, getHalfYearStartDate } from './periods'

describe('getHalfYearMonths', () => {
  it('returns H2 months to date in the second half', () => {
    const oct = new Date(2026, 9, 9)
    expect(getHalfYearMonths(false, oct)).toEqual(['Jul-26', 'Aug-26', 'Sep-26', 'Oct-26'])
    expect(getHalfYearStartDate(oct)).toBe('2026-07-01')
  })

  it('returns all six months of the half when full is set', () => {
    expect(getHalfYearMonths(true, new Date(2026, 1, 15))).toEqual(['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'])
  })

  it('starts H1 in January', () => {
    const jan = new Date(2027, 0, 3)
    expect(getHalfYearMonths(false, jan)).toEqual(['Jan-27'])
    expect(getHalfYearStartDate(jan)).toBe('2027-01-01')
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
