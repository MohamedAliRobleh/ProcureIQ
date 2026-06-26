import { describe, it, expect } from 'vitest'
import { BILLING_PLANS, CURRENT_PLAN } from './billingPlans'

describe('billingPlans', () => {
  it('defines the three tiers with non-empty name/price/features', () => {
    expect(BILLING_PLANS.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise'])
    for (const p of BILLING_PLANS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.price.length).toBeGreaterThan(0)
      expect(p.features.length).toBeGreaterThan(0)
    }
  })

  it('the current demo plan is free', () => {
    expect(CURRENT_PLAN).toBe('free')
    expect(BILLING_PLANS.some((p) => p.id === CURRENT_PLAN)).toBe(true)
  })
})
