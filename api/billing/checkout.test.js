import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))
vi.mock('../_lib/stripe.js', () => ({
  isBillingConfigured: vi.fn(),
  priceIdForPlan: vi.fn(),
  getStripe: vi.fn(),
}))

import handler from './checkout.js'
import { isBillingConfigured, priceIdForPlan, getStripe } from '../_lib/stripe.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'POST',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  body: { plan: 'pro' },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/billing/checkout', () => {
  it('creates a checkout session and returns the url when configured', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue('price_pro')
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/x' })
    getStripe.mockResolvedValue({ checkout: { sessions: { create } } })
    const res = mockRes()
    await handler(authReq(), res)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      line_items: [{ price: 'price_pro', quantity: 1 }],
      client_reference_id: 'org_test',
    }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.com/x' })
  })

  it('returns 503 when billing is not configured (before any SDK call)', async () => {
    isBillingConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it('returns 503 when the plan has no configured price id', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue(undefined)
    const res = mockRes()
    await handler(authReq({ body: { plan: 'enterprise' } }), res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it('returns 400 for a missing or invalid plan', async () => {
    const res = mockRes()
    await handler(authReq({ body: { plan: 'free' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 502 when Stripe throws', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue('price_pro')
    getStripe.mockResolvedValue({ checkout: { sessions: { create: vi.fn().mockRejectedValue(new Error('stripe down')) } } })
    const res = mockRes()
    await handler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
