import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
    spendRecord: { findMany: vi.fn() },
    portalRequest: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))

import handler from './export.js'
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

beforeEach(() => {
  vi.clearAllMocks()
  prisma.supplier.findMany.mockResolvedValue([{ id: 'sup_1' }])
  prisma.contract.findMany.mockResolvedValue([{ id: 'con_1' }])
  prisma.riskAssessment.findMany.mockResolvedValue([{ id: 'risk_1' }])
  prisma.esgResponse.findMany.mockResolvedValue([{ id: 'esg_1' }])
  prisma.spendRecord.findMany.mockResolvedValue([{ id: 'spend_1' }])
  prisma.portalRequest.findMany.mockResolvedValue([{ id: 'preq_1' }])
  prisma.auditLog.create.mockResolvedValue({})
})

describe('GET /api/org/export', () => {
  it('returns all six models org-scoped in one payload', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    for (const model of ['supplier', 'contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'portalRequest']) {
      expect(prisma[model].findMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    }
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'org.export', orgId: 'org_test', actorId: 'user_test' }) })
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.orgId).toBe('org_test')
    expect(typeof payload.exportedAt).toBe('string')
    expect(payload.data).toEqual({
      suppliers: [{ id: 'sup_1' }],
      contracts: [{ id: 'con_1' }],
      riskAssessments: [{ id: 'risk_1' }],
      esgResponses: [{ id: 'esg_1' }],
      spendRecords: [{ id: 'spend_1' }],
      portalRequests: [{ id: 'preq_1' }],
    })
  })

  it('rejects non-GET with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'POST' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.supplier.findMany).not.toHaveBeenCalled()
  })

  it('still returns the export when the audit insert fails', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('audit down'))
    const res = mockRes()
    await handler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json.mock.calls[0][0].data.suppliers).toEqual([{ id: 'sup_1' }])
  })
})
