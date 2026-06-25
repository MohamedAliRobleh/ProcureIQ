import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: { auditLog: { findMany: vi.fn() } },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))

import handler from './audit.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'GET',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/org/audit', () => {
  it('returns the org-scoped audit log newest-first, capped at 50', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit_1', action: 'org.clear' }])
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([{ id: 'audit_1', action: 'org.clear' }])
  })

  it('rejects non-GET with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'POST' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })
})
