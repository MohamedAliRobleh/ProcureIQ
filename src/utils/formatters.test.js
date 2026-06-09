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
  it('returns the ceiling number of days until a future date', () => {
    const ref = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-01-06T00:00:00.000Z')
    expect(daysUntil(future, ref)).toBe(5)
  })

  it('returns a negative number of days for a past date', () => {
    const ref = new Date('2026-01-04T00:00:00.000Z')
    const past = new Date('2026-01-01T00:00:00.000Z')
    expect(daysUntil(past, ref)).toBe(-3)
  })

  it('uses the current time when no referenceDate is supplied', () => {
    const ref = new Date()
    const future = new Date(ref.getTime() + 2 * 24 * 60 * 60 * 1000)
    expect(daysUntil(future)).toBe(2)
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
