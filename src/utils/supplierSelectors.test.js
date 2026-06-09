import { describe, it, expect } from 'vitest'
import { filterSuppliers, sortSuppliers } from './supplierSelectors'

const suppliers = [
  { id: 's1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active', riskScore: 30 },
  { id: 's2', name: 'Nordic Freight', category: 'Logistics', country: 'Germany', status: 'active', riskScore: 55 },
  { id: 's3', name: 'Brightline Energy', category: 'Energy', country: 'Japan', status: 'suspended', riskScore: 80 },
  { id: 's4', name: 'ArcLight Tech', category: 'Logistics', country: 'Brazil', status: 'pending', riskScore: 20 },
]

describe('filterSuppliers', () => {
  it('returns all suppliers when no filters are set', () => {
    expect(filterSuppliers(suppliers, {})).toHaveLength(4)
  })

  it('filters by name search (case-insensitive)', () => {
    expect(filterSuppliers(suppliers, { search: 'atlas' })).toHaveLength(1)
    expect(filterSuppliers(suppliers, { search: 'ATLAS' })).toHaveLength(1)
    expect(filterSuppliers(suppliers, { search: 'ATLAS' })[0].id).toBe('s1')
  })

  it('filters by category', () => {
    expect(filterSuppliers(suppliers, { category: 'Logistics' })).toHaveLength(2)
    expect(filterSuppliers(suppliers, { category: 'Energy' })).toHaveLength(1)
  })

  it('filters by status', () => {
    expect(filterSuppliers(suppliers, { status: 'active' })).toHaveLength(2)
    expect(filterSuppliers(suppliers, { status: 'suspended' })).toHaveLength(1)
  })

  it('applies all three filters simultaneously', () => {
    const result = filterSuppliers(suppliers, { search: 'arc', category: 'Logistics', status: 'pending' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s4')
  })

  it('returns empty array when no suppliers match', () => {
    expect(filterSuppliers(suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortSuppliers', () => {
  it('sorts by name ascending', () => {
    const result = sortSuppliers(suppliers, { key: 'name', direction: 'asc' })
    expect(result[0].name).toBe('ArcLight Tech')
    expect(result[3].name).toBe('Nordic Freight')
  })

  it('sorts by name descending', () => {
    const result = sortSuppliers(suppliers, { key: 'name', direction: 'desc' })
    expect(result[0].name).toBe('Nordic Freight')
    expect(result[3].name).toBe('ArcLight Tech')
  })

  it('sorts by riskScore ascending', () => {
    const result = sortSuppliers(suppliers, { key: 'riskScore', direction: 'asc' })
    expect(result[0].riskScore).toBe(20)
    expect(result[3].riskScore).toBe(80)
  })

  it('does not mutate the original array', () => {
    const original = [suppliers[0], suppliers[1], suppliers[2], suppliers[3]]
    sortSuppliers(suppliers, { key: 'name', direction: 'desc' })
    expect(suppliers[0]).toBe(original[0])
    expect(suppliers[1]).toBe(original[1])
  })
})
