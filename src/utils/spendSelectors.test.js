import { describe, it, expect } from 'vitest'
import { filterSpendRecords, sortSpendRecords, getMonthlySpendTrend } from './spendSelectors'

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
]

const records = [
  { id: 'spend_1', supplierId: 'sup_1', amount: 10000, category: 'Raw Materials', description: 'Steel order', date: new Date('2026-04-01') },
  { id: 'spend_2', supplierId: 'sup_2', amount: 20000, category: 'Logistics', description: 'Freight charges', date: new Date('2026-05-01') },
  { id: 'spend_3', supplierId: 'sup_1', amount: 5000, category: 'Logistics', description: 'Shipping', date: new Date('2026-03-01') },
]

describe('filterSpendRecords', () => {
  it('returns all records when no filters applied', () => {
    expect(filterSpendRecords(records, suppliers)).toHaveLength(3)
  })
  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterSpendRecords(records, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(2)
  })
  it('filters by description search', () => {
    const result = filterSpendRecords(records, suppliers, { search: 'freight' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('spend_2')
  })
  it('filters by exact category', () => {
    expect(filterSpendRecords(records, suppliers, { category: 'Logistics' })).toHaveLength(2)
  })
  it('filters by supplierId', () => {
    expect(filterSpendRecords(records, suppliers, { supplierId: 'sup_2' })).toHaveLength(1)
  })
  it('applies multiple filters together', () => {
    const result = filterSpendRecords(records, suppliers, { supplierId: 'sup_1', category: 'Logistics' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('spend_3')
  })
  it('returns empty array when nothing matches', () => {
    expect(filterSpendRecords(records, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortSpendRecords', () => {
  it('sorts by date descending by default', () => {
    const result = sortSpendRecords(records)
    expect(result.map((r) => r.id)).toEqual(['spend_2', 'spend_1', 'spend_3'])
  })
  it('sorts by date ascending', () => {
    const result = sortSpendRecords(records, { key: 'date', direction: 'asc' })
    expect(result.map((r) => r.id)).toEqual(['spend_3', 'spend_1', 'spend_2'])
  })
  it('does not mutate the input array', () => {
    const firstId = records[0].id
    sortSpendRecords(records, { key: 'date', direction: 'asc' })
    expect(records[0].id).toBe(firstId)
  })
})

describe('getMonthlySpendTrend', () => {
  it('returns the requested number of monthly buckets', () => {
    const result = getMonthlySpendTrend(records, 6)
    expect(result).toHaveLength(6)
    for (const bucket of result) {
      expect(bucket).toHaveProperty('month')
      expect(bucket).toHaveProperty('total')
    }
  })
  it('sums amounts for the current month bucket', () => {
    const now = new Date()
    const thisMonthRecords = [
      { id: 's1', supplierId: 'sup_1', amount: 1000, category: 'Logistics', description: 'A', date: new Date(now.getFullYear(), now.getMonth(), 5) },
      { id: 's2', supplierId: 'sup_1', amount: 2000, category: 'Logistics', description: 'B', date: new Date(now.getFullYear(), now.getMonth(), 10) },
    ]
    const result = getMonthlySpendTrend(thisMonthRecords, 6)
    expect(result.at(-1).total).toBe(3000)
  })
  it('orders buckets oldest first ending with the current month', () => {
    const now = new Date()
    const expectedLastLabel = now.toLocaleString('en-US', { month: 'short' })
    const result = getMonthlySpendTrend(records, 6)
    expect(result.at(-1).month).toBe(expectedLastLabel)
  })
})
