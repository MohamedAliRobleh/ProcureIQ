import { describe, it, expect } from 'vitest'
import { filterRiskAssessments, sortRiskAssessments, RISK_LEVEL_BADGE } from './riskSelectors'

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
  { id: 'sup_3', name: 'Quantum IT Partners' },
]

const assessments = [
  { id: 'r1', supplierId: 'sup_1', score: 78, level: 'high' },
  { id: 'r2', supplierId: 'sup_2', score: 22, level: 'low' },
  { id: 'r3', supplierId: 'sup_3', score: 91, level: 'critical' },
]

describe('filterRiskAssessments', () => {
  it('returns all assessments when no filters are applied', () => {
    expect(filterRiskAssessments(assessments, suppliers)).toHaveLength(3)
  })

  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterRiskAssessments(assessments, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('filters by exact level', () => {
    expect(filterRiskAssessments(assessments, suppliers, { level: 'low' })).toHaveLength(1)
  })

  it('applies search and level together', () => {
    const result = filterRiskAssessments(assessments, suppliers, { search: 'quantum', level: 'critical' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r3')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterRiskAssessments(assessments, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortRiskAssessments', () => {
  it('sorts by score descending by default', () => {
    const result = sortRiskAssessments(assessments)
    expect(result[0].id).toBe('r3')
    expect(result[2].id).toBe('r2')
  })

  it('sorts by score ascending', () => {
    const result = sortRiskAssessments(assessments, { key: 'score', direction: 'asc' })
    expect(result[0].id).toBe('r2')
  })

  it('does not mutate the input array', () => {
    const firstId = assessments[0].id
    sortRiskAssessments(assessments)
    expect(assessments[0].id).toBe(firstId)
  })
})

describe('RISK_LEVEL_BADGE', () => {
  it('maps all four levels to badge variants', () => {
    expect(RISK_LEVEL_BADGE.low).toBe('green')
    expect(RISK_LEVEL_BADGE.medium).toBe('amber')
    expect(RISK_LEVEL_BADGE.high).toBe('red')
    expect(RISK_LEVEL_BADGE.critical).toBe('purple')
  })
})
