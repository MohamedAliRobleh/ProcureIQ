import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    portalRequest: { findMany: vi.fn(), create: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import listHandler from './index.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test' }

beforeEach(() => vi.clearAllMocks())

describe('portal-requests index', () => {
  it('GET returns the org-scoped list including supplier id+name', async () => {
    prisma.portalRequest.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET', auth }, res)
    expect(prisma.portalRequest.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { id: true, name: true } } },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST creates a request, stamping orgId/createdBy and coercing dueDate', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.portalRequest.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', auth, body: { supplierId: 'sup_1', title: 'Submit ESG', type: 'esg_questionnaire', dueDate: '2026-07-01' } },
      res
    )
    const created = prisma.portalRequest.create.mock.calls[0][0].data
    expect(created.orgId).toBe('org_test')
    expect(created.createdBy).toBe('user_test')
    expect(created.status).toBe('pending')
    expect(created.type).toBe('esg_questionnaire')
    expect(created.dueDate).toBeInstanceOf(Date)
    expect(created.id).toMatch(/^preq_/)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing title/supplierId with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { title: 'no supplier' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.portalRequest.create).not.toHaveBeenCalled()
  })

  it('POST rejects an invalid type with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { supplierId: 'sup_1', title: 'x', type: 'bogus' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('POST returns 404 when the supplier is not in the org', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { supplierId: 'sup_other', title: 'x' } }, res)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_other', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.create).not.toHaveBeenCalled()
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await listHandler({ method: 'DELETE', auth }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
