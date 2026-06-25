import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import listHandler from './index.js'
import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/suppliers', () => {
  it('returns the org-scoped supplier list', async () => {
    const rows = [{ id: 'sup_1', name: 'Atlas Steelworks' }]
    prisma.supplier.findMany.mockResolvedValue(rows)
    const res = mockRes()
    await listHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { createdAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(rows)
  })
})

describe('POST /api/suppliers', () => {
  it('creates a supplier with generated id, orgId, and defaults', async () => {
    prisma.supplier.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }, body: { name: 'New Co', email: 'a@b.com', country: 'France', category: 'Logistics', status: 'active' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(201)
    const created = prisma.supplier.create.mock.calls[0][0].data
    expect(created.id).toMatch(/^sup_/)
    expect(created.orgId).toBe('org_test')
    expect(created.riskScore).toBe(0)
    expect(created.name).toBe('New Co')
  })

  it('rejects a body missing name or email with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }, body: { name: 'No Email' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.supplier.create).not.toHaveBeenCalled()
  })

  it('POST returns 403 for a member (read-only)', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { name: 'X', email: 'x@y.com' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.supplier.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/suppliers/:id', () => {
  it('updates the supplier and returns the updated record', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.supplier.update.mockResolvedValue({ id: 'sup_1', status: 'suspended' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }, query: { id: 'sup_1' }, body: { status: 'suspended' } }, res)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: 'sup_1', orgId: 'org_test' },
    })
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup_1' },
      data: { status: 'suspended' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when the id does not exist in the org', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }, query: { id: 'sup_other_org' }, body: { status: 'suspended' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.supplier.update).not.toHaveBeenCalled()
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'sup_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('ignores client-supplied orgId and id on PATCH (cannot move records across orgs)', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.supplier.update.mockResolvedValue({ id: 'sup_1', status: 'suspended' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'sup_1' }, body: { orgId: 'evil_org', id: 'hijack', status: 'suspended' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } },
      res
    )
    const data = prisma.supplier.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('orgId')
    expect(data).not.toHaveProperty('id')
    expect(data.status).toBe('suspended')
  })

  it('PATCH returns 403 for a member (read-only)', async () => {
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'sup_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { name: 'X' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.supplier.update).not.toHaveBeenCalled()
  })
})
