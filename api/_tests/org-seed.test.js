import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { count: vi.fn(), createMany: vi.fn() },
    contract: { createMany: vi.fn() },
    riskAssessment: { createMany: vi.fn() },
    esgResponse: { createMany: vi.fn() },
    spendRecord: { createMany: vi.fn() },
    portalRequest: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/seedData.js', () => ({
  buildSeedData: vi.fn(() => ({
    suppliers: [{ id: 'org_test__sup_1' }],
    contracts: [{ id: 'org_test__con_1' }],
    riskAssessments: [{ id: 'org_test__risk_1' }],
    esgResponses: [{ id: 'org_test__esg_1' }],
    spendRecords: [{ id: 'org_test__spend_1' }],
    portalRequests: [{ id: 'org_test__portal_1' }],
  })),
}))

import { seed as handler } from '../_handlers/org.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }, ...over })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/seed', () => {
  it('seeds all six entities for an empty org and returns seeded: true', async () => {
    prisma.supplier.count.mockResolvedValue(0)
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.supplier.count).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    expect(prisma.supplier.createMany).toHaveBeenCalledWith({ data: [{ id: 'org_test__sup_1' }] })
    expect(prisma.contract.createMany).toHaveBeenCalled()
    expect(prisma.riskAssessment.createMany).toHaveBeenCalled()
    expect(prisma.esgResponse.createMany).toHaveBeenCalled()
    expect(prisma.spendRecord.createMany).toHaveBeenCalled()
    expect(prisma.portalRequest.createMany).toHaveBeenCalledWith({ data: [{ id: 'org_test__portal_1' }] })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(7)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'org.seed', orgId: 'org_test', actorId: 'user_test' }) })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ seeded: true })
  })

  it('is a no-op for a non-empty org and returns seeded: false', async () => {
    prisma.supplier.count.mockResolvedValue(20)
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.supplier.createMany).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ seeded: false })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.supplier.count).not.toHaveBeenCalled()
  })

  it('allows a non-admin member to seed (any org member can load demo data)', async () => {
    prisma.supplier.count.mockResolvedValue(0)
    const res = mockRes()
    await handler(authReq({ auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' } }), res)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ seeded: true })
  })
})
