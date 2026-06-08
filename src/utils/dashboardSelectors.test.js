import { describe, it, expect } from 'vitest'
import {
  getAverageRiskScore,
  getRiskDistribution,
  getSpendByCategory,
  getTotalSpendYTD,
  getExpiringContracts,
  getTopSuppliersBySpend,
} from './dashboardSelectors'

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks', country: 'United States' },
  { id: 'sup_2', name: 'Nordic Freight Solutions', country: 'Germany' },
]

describe('getAverageRiskScore', () => {
  it('averages and rounds the scores', () => {
    expect(getAverageRiskScore([{ score: 10 }, { score: 25 }])).toBe(18)
  })

  it('returns 0 for an empty list', () => {
    expect(getAverageRiskScore([])).toBe(0)
  })
})

describe('getRiskDistribution', () => {
  it('counts assessments per level, including levels with zero', () => {
    const result = getRiskDistribution([{ level: 'low' }, { level: 'low' }, { level: 'high' }])
    expect(result).toEqual([
      { level: 'low', count: 2 },
      { level: 'medium', count: 0 },
      { level: 'high', count: 1 },
      { level: 'critical', count: 0 },
    ])
  })
})

describe('getSpendByCategory', () => {
  it('sums amounts grouped by category', () => {
    const result = getSpendByCategory([
      { category: 'Logistics', amount: 100 },
      { category: 'Logistics', amount: 50 },
      { category: 'Energy', amount: 75 },
    ])
    expect(result).toEqual([
      { category: 'Logistics', amount: 150 },
      { category: 'Energy', amount: 75 },
    ])
  })
})

describe('getTotalSpendYTD', () => {
  it('sums only records dated in the reference year', () => {
    const reference = new Date('2026-06-01')
    const result = getTotalSpendYTD(
      [
        { amount: 100, date: new Date('2026-01-15') },
        { amount: 200, date: new Date('2025-12-31') },
        { amount: 50, date: new Date('2026-05-01') },
      ],
      reference
    )
    expect(result).toBe(150)
  })
})

describe('getExpiringContracts', () => {
  const reference = new Date('2026-06-01T12:00:00')
  const dayMs = 1000 * 60 * 60 * 24

  it('buckets active contracts into 30/60/90-day windows and excludes inactive ones', () => {
    const contracts = [
      { id: 'a', status: 'active', endDate: new Date(reference.getTime() + 10 * dayMs) },
      { id: 'b', status: 'active', endDate: new Date(reference.getTime() + 45 * dayMs) },
      { id: 'c', status: 'active', endDate: new Date(reference.getTime() + 80 * dayMs) },
      { id: 'd', status: 'active', endDate: new Date(reference.getTime() + 200 * dayMs) },
      { id: 'e', status: 'draft', endDate: new Date(reference.getTime() + 10 * dayMs) },
    ]
    const result = getExpiringContracts(contracts, reference)
    expect(result.within30.map((c) => c.id)).toEqual(['a'])
    expect(result.within60.map((c) => c.id)).toEqual(['b'])
    expect(result.within90.map((c) => c.id)).toEqual(['c'])
  })
})

describe('getTopSuppliersBySpend', () => {
  it('sums spend per supplier, sorts descending, and joins supplier records', () => {
    const result = getTopSuppliersBySpend(
      [
        { supplierId: 'sup_1', amount: 100 },
        { supplierId: 'sup_2', amount: 500 },
        { supplierId: 'sup_1', amount: 50 },
      ],
      suppliers,
      5
    )
    expect(result).toEqual([
      { supplier: suppliers[1], totalSpend: 500 },
      { supplier: suppliers[0], totalSpend: 150 },
    ])
  })

  it('respects the limit', () => {
    const result = getTopSuppliersBySpend(
      [
        { supplierId: 'sup_1', amount: 100 },
        { supplierId: 'sup_2', amount: 500 },
      ],
      suppliers,
      1
    )
    expect(result).toHaveLength(1)
    expect(result[0].supplier.id).toBe('sup_2')
  })
})
