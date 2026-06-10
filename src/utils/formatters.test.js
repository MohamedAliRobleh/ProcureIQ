import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatPercent, daysUntil, timeAgo, riskColor, formatCompactCurrency, esgColor, formatDateToInput } from './formatters'

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

describe('riskColor', () => {
  it('returns green for scores ≤33', () => {
    expect(riskColor(0)).toBe('text-accent-green')
    expect(riskColor(33)).toBe('text-accent-green')
  })
  it('returns amber for scores 34–66', () => {
    expect(riskColor(34)).toBe('text-accent-amber')
    expect(riskColor(66)).toBe('text-accent-amber')
  })
  it('returns red for scores >66', () => {
    expect(riskColor(67)).toBe('text-accent-red')
    expect(riskColor(100)).toBe('text-accent-red')
  })
})

describe('formatCompactCurrency', () => {
  it('formats millions as $X.XM', () => {
    expect(formatCompactCurrency(4200000)).toBe('$4.2M')
  })
  it('formats thousands as $XXXk', () => {
    expect(formatCompactCurrency(637000)).toBe('$637k')
  })
  it('formats small amounts as $X', () => {
    expect(formatCompactCurrency(500)).toBe('$500')
  })
})

describe('esgColor', () => {
  it('returns red for scores below 34', () => {
    expect(esgColor(0)).toBe('text-accent-red')
    expect(esgColor(33)).toBe('text-accent-red')
  })
  it('returns amber for scores 34–66', () => {
    expect(esgColor(34)).toBe('text-accent-amber')
    expect(esgColor(66)).toBe('text-accent-amber')
  })
  it('returns green for scores 67 and above', () => {
    expect(esgColor(67)).toBe('text-accent-green')
    expect(esgColor(100)).toBe('text-accent-green')
  })
})

describe('formatDateToInput', () => {
  it('formats a Date as YYYY-MM-DD using local date parts', () => {
    const d = new Date(2026, 2, 5) // March 5, 2026
    expect(formatDateToInput(d)).toBe('2026-03-05')
  })
})
