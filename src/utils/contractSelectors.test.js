import { describe, it, expect } from 'vitest'
import { filterContracts, sortContracts } from './contractSelectors'

const contracts = [
  { id: 'c1', title: 'Master Supply Agreement', status: 'active', supplierId: 'sup_1', value: 600000 },
  { id: 'c2', title: 'Logistics Contract', status: 'draft', supplierId: 'sup_2', value: 300000 },
  { id: 'c3', title: 'IT Services Retainer', status: 'expired', supplierId: 'sup_1', value: 450000 },
]

describe('filterContracts', () => {
  it('returns all contracts when no filters are applied', () => {
    expect(filterContracts(contracts)).toHaveLength(3)
  })

  it('filters by title search (case-insensitive)', () => {
    const result = filterContracts(contracts, { search: 'logistics' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c2')
  })

  it('filters by exact status', () => {
    expect(filterContracts(contracts, { status: 'active' })).toHaveLength(1)
  })

  it('filters by supplierId', () => {
    expect(filterContracts(contracts, { supplierId: 'sup_1' })).toHaveLength(2)
  })

  it('applies multiple filters together', () => {
    const result = filterContracts(contracts, { supplierId: 'sup_1', status: 'active' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterContracts(contracts, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortContracts', () => {
  it('sorts by value ascending', () => {
    const result = sortContracts(contracts, { key: 'value', direction: 'asc' })
    expect(result[0].id).toBe('c2')
    expect(result[2].id).toBe('c1')
  })

  it('sorts by value descending', () => {
    const result = sortContracts(contracts, { key: 'value', direction: 'desc' })
    expect(result[0].id).toBe('c1')
  })

  it('does not mutate the input array', () => {
    const firstId = contracts[0].id
    sortContracts(contracts, { key: 'value', direction: 'asc' })
    expect(contracts[0].id).toBe(firstId)
  })
})
