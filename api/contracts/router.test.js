import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/contracts.js', () => ({
  list: vi.fn(), byId: vi.fn(), summarize: vi.fn(), uploadSignature: vi.fn(), notify: vi.fn(),
}))

import router from './[[...path]].js'
import * as h from '../_handlers/contracts.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('contracts catch-all router', () => {
  it('routes base path to list', async () => {
    await router({ method: 'GET', query: {}, auth: { orgId: 'org_test' } }, mockRes())
    expect(h.list).toHaveBeenCalledTimes(1)
  })

  it('routes summarize / upload-signature / notify to their handlers', async () => {
    await router({ method: 'POST', query: { path: ['summarize'] }, auth: {} }, mockRes())
    await router({ method: 'POST', query: { path: ['upload-signature'] }, auth: {} }, mockRes())
    await router({ method: 'POST', query: { path: ['notify'] }, auth: {} }, mockRes())
    expect(h.summarize).toHaveBeenCalledTimes(1)
    expect(h.uploadSignature).toHaveBeenCalledTimes(1)
    expect(h.notify).toHaveBeenCalledTimes(1)
    expect(h.byId).not.toHaveBeenCalled()
  })

  it('routes any other first segment to byId as the id', async () => {
    const req = { method: 'PATCH', query: { path: ['con_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('con_1')
    expect(h.byId).toHaveBeenCalledTimes(1)
  })
})
