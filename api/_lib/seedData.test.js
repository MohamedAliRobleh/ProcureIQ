import { describe, it, expect } from 'vitest'
import { buildSeedData } from './seedData.js'

describe('buildSeedData', () => {
  const data = buildSeedData('org_x')

  it('namespaces every id with the org prefix and stamps orgId', () => {
    for (const collection of Object.values(data)) {
      for (const row of collection) {
        expect(row.id.startsWith('org_x__')).toBe(true)
        expect(row.orgId).toBe('org_x')
      }
    }
  })

  it('rewrites every foreign key to a supplier id that exists in the dataset', () => {
    const supplierIds = new Set(data.suppliers.map((s) => s.id))
    for (const collection of [data.contracts, data.riskAssessments, data.esgResponses, data.spendRecords]) {
      for (const row of collection) {
        expect(supplierIds.has(row.supplierId)).toBe(true)
      }
    }
  })

  it('returns the full demo dataset (non-empty collections)', () => {
    expect(data.suppliers.length).toBeGreaterThan(0)
    expect(data.contracts.length).toBeGreaterThan(0)
    expect(data.spendRecords.length).toBeGreaterThan(0)
  })

  it('re-keys portalRequests: namespaced id, rewritten supplierId, stamped orgId', () => {
    const data = buildSeedData('org_xyz')
    expect(data.portalRequests.length).toBeGreaterThan(0)
    for (const p of data.portalRequests) {
      expect(p.id.startsWith('org_xyz__')).toBe(true)
      expect(p.supplierId.startsWith('org_xyz__')).toBe(true)
      expect(p.orgId).toBe('org_xyz')
    }
  })
})
