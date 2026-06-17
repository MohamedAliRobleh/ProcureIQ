import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

import { requireAuth } from './auth.js'
import { verifyToken } from '@clerk/backend'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
    expect(verifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 when the header is not a Bearer token', async () => {
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Token abc' } }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when verification fails', async () => {
    verifyToken.mockRejectedValue(new Error('invalid'))
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Bearer bad' } }, res)
    expect(verifyToken).toHaveBeenCalledWith('bad', { secretKey: process.env.CLERK_SECRET_KEY })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('attaches req.auth and calls the handler when the token has an active org', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth).toEqual({ userId: 'user_123', orgId: 'org_abc' })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when the verified token has no active organization', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123' })
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })
})
