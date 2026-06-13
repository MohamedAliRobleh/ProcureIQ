import { describe, it, expect } from 'vitest'
import { buildDigest } from './digest.js'

const data = {
  suppliers: [
    { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active', riskScore: 78, esgScore: 41 },
    { id: 'sup_2', name: 'Nordic Freight', category: 'Logistics', country: 'Germany', status: 'pending', riskScore: 22, esgScore: 80 },
  ],
  contracts: [
    { id: 'con_1', supplierId: 'sup_1', title: 'Master Supply Agreement', value: 600000, currency: 'USD', status: 'active', startDate: '2025-01-12', endDate: '2099-01-01', autoRenew: true, terms: 'Net-30' },
  ],
  riskAssessments: [
    { supplierId: 'sup_1', score: 78, level: 'high', financialRisk: 80, complianceRisk: 70, operationalRisk: 60, geopoliticalRisk: 90 },
  ],
  esgResponses: [
    { supplierId: 'sup_2', score: 80, environmental: 82, social: 78, governance: 80 },
  ],
  spendRecords: [
    { supplierId: 'sup_1', amount: 10000, category: 'Raw Materials', date: '2026-01-05' },
    { supplierId: 'sup_2', amount: 5000, category: 'Logistics', date: '2026-01-06' },
  ],
}

describe('buildDigest', () => {
  it('includes suppliers, contracts, risk, esg, and spend sections', () => {
    const digest = buildDigest(data)
    expect(digest).toContain('Atlas Steelworks')
    expect(digest).toContain('Master Supply Agreement')
    expect(digest).toContain('## Risk assessments')
    expect(digest).toContain('## ESG responses')
    expect(digest).toContain('## Spend')
  })

  it('reports the total tracked spend', () => {
    const digest = buildDigest(data)
    expect(digest).toContain('Total tracked spend: 15000')
  })

  it('resolves supplier names for joined rows', () => {
    const digest = buildDigest(data)
    // risk row for sup_1 names the supplier, not the raw id
    expect(digest).toMatch(/Atlas Steelworks: score 78 \(high\)/)
  })
})
