import { describe, it, expect } from 'vitest'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords, recentActivity } from './mockData'

describe('mockData', () => {
  it('seeds 20 suppliers across 10 countries', () => {
    expect(suppliers).toHaveLength(20)
    const countries = new Set(suppliers.map((s) => s.country))
    expect(countries.size).toBe(10)
  })

  it('gives every supplier the required schema fields', () => {
    for (const supplier of suppliers) {
      expect(supplier).toMatchObject({
        id: expect.any(String),
        orgId: 'org_demo',
        name: expect.any(String),
        email: expect.any(String),
        country: expect.any(String),
        category: expect.any(String),
        status: expect.any(String),
        riskScore: expect.any(Number),
        esgScore: expect.any(Number),
      })
    }
  })

  it('seeds 15 contracts, each linked to a real supplier', () => {
    expect(contracts).toHaveLength(15)
    const supplierIds = new Set(suppliers.map((s) => s.id))
    for (const contract of contracts) {
      expect(supplierIds.has(contract.supplierId)).toBe(true)
      expect(contract.startDate.getTime()).toBeLessThan(contract.endDate.getTime())
    }
  })

  it('seeds one risk assessment and one ESG response per supplier', () => {
    expect(riskAssessments).toHaveLength(suppliers.length)
    expect(esgResponses).toHaveLength(suppliers.length)
    for (const risk of riskAssessments) {
      expect(['low', 'medium', 'high', 'critical']).toContain(risk.level)
      expect(risk.score).toBeGreaterThanOrEqual(0)
      expect(risk.score).toBeLessThanOrEqual(100)
    }
  })

  it('seeds roughly 6 months of spend records', () => {
    expect(spendRecords.length).toBeGreaterThan(0)
    const months = new Set(
      spendRecords.map((r) => `${r.date.getFullYear()}-${r.date.getMonth()}`)
    )
    expect(months.size).toBe(6)
  })

  it('seeds a recent activity feed', () => {
    expect(recentActivity.length).toBeGreaterThan(0)
    for (const activity of recentActivity) {
      expect(activity).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(Date),
      })
    }
  })
})
