import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/org.js', () => ({
  seed: vi.fn(), clear: vi.fn(), reset: vi.fn(), exportData: vi.fn(), audit: vi.fn(),
}))

import router from './[[...path]].js'
import * as h from '../_handlers/org.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('org catch-all router', () => {
  it('routes seed for any member', async () => {
    await router({ method: 'POST', query: { path: ['seed'] }, auth: { orgRole: 'org:member' } }, mockRes())
    expect(h.seed).toHaveBeenCalledTimes(1)
  })

  it('403s a member on an admin-only route and does not call the handler', async () => {
    const res = mockRes()
    await router({ method: 'POST', query: { path: ['clear'] }, auth: { orgRole: 'org:member' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
    expect(h.clear).not.toHaveBeenCalled()
  })

  it('routes admin-only segments for an admin', async () => {
    await router({ method: 'POST', query: { path: ['clear'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'POST', query: { path: ['reset'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'GET', query: { path: ['export'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'GET', query: { path: ['audit'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    expect(h.clear).toHaveBeenCalledTimes(1)
    expect(h.reset).toHaveBeenCalledTimes(1)
    expect(h.exportData).toHaveBeenCalledTimes(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown segment', async () => {
    const res = mockRes()
    await router({ method: 'GET', query: { path: ['nope'] }, auth: { orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })
})
