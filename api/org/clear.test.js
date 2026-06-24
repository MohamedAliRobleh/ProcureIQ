import { describe, it, expect, vi, beforeEach } from 'vitest'

// Each deleteMany returns a tagged token so the test can assert the exact
// order of operations passed to $transaction.
vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    contract: { deleteMany: vi.fn((a) => ({ op: 'contract', ...a })) },
    riskAssessment: { deleteMany: vi.fn((a) => ({ op: 'riskAssessment', ...a })) },
    esgResponse: { deleteMany: vi.fn((a) => ({ op: 'esgResponse', ...a })) },
    spendRecord: { deleteMany: vi.fn((a) => ({ op: 'spendRecord', ...a })) },
    portalRequest: { deleteMany: vi.fn((a) => ({ op: 'portalRequest', ...a })) },
    supplier: { deleteMany: vi.fn((a) => ({ op: 'supplier', ...a })) },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))

import handler from './clear.js'
import { prisma } from '../_lib/prisma.js'

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
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/clear', () => {
  it('deletes all six entities child-first in one transaction', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    for (const model of ['contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'portalRequest', 'supplier']) {
      expect(prisma[model].deleteMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const ops = prisma.$transaction.mock.calls[0][0].map((o) => o.op)
    expect(ops).toEqual(['contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'portalRequest', 'supplier'])
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ cleared: true })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
