import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatPercent, daysUntil, timeAgo } from './formatters'

describe('formatCurrency', () => {
  it('formats USD with no decimals', () => {
    expect(formatCurrency(125000)).toBe('$125,000')
  })
})

describe('formatDate', () => {
  it('formats a date as "Mon D, YYYY"', () => {
    expect(formatDate('2026-03-15')).toBe('Mar 15, 2026')
  })
})

describe('formatPercent', () => {
  it('formats a number as a percentage string', () => {
    expect(formatPercent(42)).toBe('42%')
  })

  it('respects the decimals argument', () => {
    expect(formatPercent(42.567, 1)).toBe('42.6%')
  })
})

describe('daysUntil', () => {
  it('returns a positive number of days for a future date', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    expect(daysUntil(future)).toBe(5)
  })

  it('returns a negative number of days for a past date', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(daysUntil(past)).toBe(-3)
  })
})

describe('timeAgo', () => {
  it('renders days for dates more than a day old', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(timeAgo(past)).toBe('2d ago')
  })

  it('renders "just now" for the current moment', () => {
    expect(timeAgo(new Date())).toBe('just now')
  })
})
