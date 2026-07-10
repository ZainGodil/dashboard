import { describe, it, expect } from 'vitest'
import { parseMonthLabel, sortMonthLabelsDesc } from './periods'

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
