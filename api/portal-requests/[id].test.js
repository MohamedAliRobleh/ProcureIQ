import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: { portalRequest: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }

beforeEach(() => vi.clearAllMocks())

describe('portal-requests [id]', () => {
  it('PATCH updates status by id within the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.update.mockResolvedValue({ id: 'preq_1', status: 'approved' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_1' }, body: { status: 'approved' } }, res)
    expect(prisma.portalRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'preq_1', orgId: 'org_test' } })
    expect(prisma.portalRequest.update.mock.calls[0][0].data.status).toBe('approved')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('PATCH coerces dueDate and ignores client id/orgId', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.update.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth, query: { id: 'preq_1' }, body: { orgId: 'evil', id: 'hijack', dueDate: '2026-08-01' } },
      res
    )
    const data = prisma.portalRequest.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('orgId')
    expect(data).not.toHaveProperty('id')
    expect(data.dueDate).toBeInstanceOf(Date)
  })

  it('PATCH rejects an invalid status with 400', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_1' }, body: { status: 'bogus' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.portalRequest.update).not.toHaveBeenCalled()
  })

  it('PATCH returns 404 when the id is not in the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_other' }, body: { status: 'approved' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.update).not.toHaveBeenCalled()
  })

  it('DELETE removes the request within the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.delete.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth, query: { id: 'preq_1' } }, res)
    expect(prisma.portalRequest.delete).toHaveBeenCalledWith({ where: { id: 'preq_1' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ deleted: true })
  })

  it('DELETE returns 404 when not in the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth, query: { id: 'preq_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.delete).not.toHaveBeenCalled()
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await idHandler({ method: 'GET', auth, query: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('PATCH returns 403 for a member', async () => {
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, query: { id: 'preq_1' }, body: { status: 'approved' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('DELETE returns 403 for a member', async () => {
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, query: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
