import { describe, it, expect } from 'vitest'
import { esgRating, filterEsgResponses, sortEsgResponses, ESG_RATING_BADGE, ESG_RATING_LABEL } from './esgSelectors'

describe('esgRating', () => {
  it('returns needs-improvement for scores below 34', () => {
    expect(esgRating(0)).toBe('needs-improvement')
    expect(esgRating(33)).toBe('needs-improvement')
  })
  it('returns developing for scores 34–66', () => {
    expect(esgRating(34)).toBe('developing')
    expect(esgRating(66)).toBe('developing')
  })
  it('returns strong for scores 67 and above', () => {
    expect(esgRating(67)).toBe('strong')
    expect(esgRating(100)).toBe('strong')
  })
})

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
]

const responses = [
  { id: 'esg_1', supplierId: 'sup_1', score: 80, environmental: 80, social: 80, governance: 80 },
  { id: 'esg_2', supplierId: 'sup_2', score: 50, environmental: 50, social: 50, governance: 50 },
  { id: 'esg_3', supplierId: 'sup_1', score: 20, environmental: 20, social: 20, governance: 20 },
]

describe('filterEsgResponses', () => {
  it('returns all responses when no filters applied', () => {
    expect(filterEsgResponses(responses, suppliers)).toHaveLength(3)
  })
  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterEsgResponses(responses, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(2)
  })
  it('filters by rating', () => {
    expect(filterEsgResponses(responses, suppliers, { rating: 'strong' })).toHaveLength(1)
    expect(filterEsgResponses(responses, suppliers, { rating: 'needs-improvement' })).toHaveLength(1)
  })
  it('applies search and rating together', () => {
    const result = filterEsgResponses(responses, suppliers, { search: 'atlas', rating: 'strong' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('esg_1')
  })
  it('returns empty array when nothing matches', () => {
    expect(filterEsgResponses(responses, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortEsgResponses', () => {
  it('sorts by score descending by default', () => {
    const result = sortEsgResponses(responses)
    expect(result.map((r) => r.id)).toEqual(['esg_1', 'esg_2', 'esg_3'])
  })
  it('sorts by score ascending', () => {
    const result = sortEsgResponses(responses, { key: 'score', direction: 'asc' })
    expect(result.map((r) => r.id)).toEqual(['esg_3', 'esg_2', 'esg_1'])
  })
  it('does not mutate the input array', () => {
    const firstId = responses[0].id
    sortEsgResponses(responses, { key: 'score', direction: 'asc' })
    expect(responses[0].id).toBe(firstId)
  })
})

describe('ESG_RATING_BADGE and ESG_RATING_LABEL', () => {
  it('have entries for all three ratings', () => {
    for (const rating of ['strong', 'developing', 'needs-improvement']) {
      expect(ESG_RATING_BADGE[rating]).toBeTruthy()
      expect(ESG_RATING_LABEL[rating]).toBeTruthy()
    }
  })
})
