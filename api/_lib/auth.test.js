import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

import { requireAuth, requireOrgAdmin } from './auth.js'
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

  it('attaches req.auth (incl. orgRole) and calls the handler when the token has an active org', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:admin' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth).toEqual({ userId: 'user_123', orgId: 'org_abc', orgRole: 'org:admin' })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('sets orgRole to null when the token has an org but no role claim', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth.orgRole).toBeNull()
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

describe('requireOrgAdmin', () => {
  it('calls the handler for an org admin', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:admin' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireOrgAdmin(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin member', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:member' })
    const handler = vi.fn()
    const res = mockRes()
    await requireOrgAdmin(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when the org role is missing', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    await requireOrgAdmin(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })
})
