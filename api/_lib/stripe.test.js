import { describe, it, expect, afterEach } from 'vitest'
import { isBillingConfigured, priceIdForPlan } from './stripe.js'

const ENV = { ...process.env }
afterEach(() => {
  process.env = { ...ENV }
})

describe('stripe lib config helpers', () => {
  it('isBillingConfigured reflects STRIPE_SECRET_KEY', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(isBillingConfigured()).toBe(false)
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    expect(isBillingConfigured()).toBe(true)
  })

  it('priceIdForPlan maps pro/enterprise to their env price ids and others to undefined', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro'
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_ent'
    expect(priceIdForPlan('pro')).toBe('price_pro')
    expect(priceIdForPlan('enterprise')).toBe('price_ent')
    expect(priceIdForPlan('free')).toBeUndefined()
    expect(priceIdForPlan('bogus')).toBeUndefined()
  })
})
