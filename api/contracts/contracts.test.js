import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    contract: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
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

describe('contracts endpoints', () => {
  it('GET returns the org-scoped contract list', async () => {
    prisma.contract.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(prisma.contract.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { createdAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST coerces yyyy-mm-dd dates to Date objects', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.contract.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      {
        method: 'POST',
        auth: { userId: 'user_test', orgId: 'org_test' },
        body: { title: 'Deal', supplierId: 'sup_1', value: 1000, startDate: '2026-01-12', endDate: '' },
      },
      res
    )
    const created = prisma.contract.create.mock.calls[0][0].data
    expect(created.startDate).toBeInstanceOf(Date)
    expect('endDate' in created).toBe(false)
    expect(created.id).toMatch(/^con_/)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing title/supplierId/value with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { title: 'No supplier' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH coerces dates and updates by id', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_1' }, body: { endDate: '2026-07-22' } }, res)
    expect(prisma.contract.findFirst).toHaveBeenCalledWith({
      where: { id: 'con_1', orgId: 'org_test' },
    })
    const data = prisma.contract.update.mock.calls[0][0].data
    expect(data.endDate).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when the id does not exist in the org', async () => {
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_other_org' }, body: { endDate: '2026-07-22' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('ignores client-supplied orgId and id on PATCH (cannot move records across orgs)', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'con_1' }, body: { orgId: 'evil_org', id: 'hijack', status: 'active' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    const data = prisma.contract.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('orgId')
    expect(data).not.toHaveProperty('id')
    expect(data.status).toBe('active')
  })

  it('POST rejects a supplierId that is not in the org with 400', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler(
      { method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { title: 'Deal', supplierId: 'sup_foreign', value: 1000 } },
      res
    )
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_foreign', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('PATCH rejects reassigning to a supplierId not in the org with 400', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_1' }, body: { supplierId: 'sup_foreign' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('PATCH without a supplierId does not run the supplier check', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_1' }, body: { status: 'active' } },
      res
    )
    expect(prisma.supplier.findFirst).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
