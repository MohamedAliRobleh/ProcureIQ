import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/portalRequests.js', () => ({ list: vi.fn(), byId: vi.fn(), notify: vi.fn() }))

import router from './[[...path]].js'
import * as h from '../_handlers/portalRequests.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('portal-requests catch-all router', () => {
  it('routes base path to list', async () => {
    await router({ method: 'GET', query: {}, auth: { orgId: 'org_test' } }, mockRes())
    expect(h.list).toHaveBeenCalledTimes(1)
  })

  it('routes notify to the notify handler', async () => {
    await router({ method: 'POST', query: { path: ['notify'] }, auth: {} }, mockRes())
    expect(h.notify).toHaveBeenCalledTimes(1)
    expect(h.byId).not.toHaveBeenCalled()
  })

  it('routes any other first segment to byId as the id', async () => {
    const req = { method: 'DELETE', query: { path: ['por_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('por_1')
    expect(h.byId).toHaveBeenCalledTimes(1)
  })
})
