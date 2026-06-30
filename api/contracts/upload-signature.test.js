import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn() } },
}))
vi.mock('../_lib/cloudinary.js', () => ({
  isUploadConfigured: vi.fn(),
  uploadConfig: vi.fn(),
  signUpload: vi.fn(),
}))

import { uploadSignature as handler } from '../_handlers/contracts.js'
import { prisma } from '../_lib/prisma.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'

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

describe('POST /api/contracts/upload-signature', () => {
  it('returns signed upload params for a contract in the org', async () => {
    isUploadConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    uploadConfig.mockReturnValue({ cloudName: 'democloud', apiKey: '999' })
    signUpload.mockReturnValue('SIGNATURE')
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)

    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_test' } })
    const signedParams = signUpload.mock.calls[0][0]
    expect(signedParams.folder).toBe('procureiq/org_test/contracts')
    expect(typeof signedParams.timestamp).toBe('number')
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toMatchObject({
      cloudName: 'democloud',
      apiKey: '999',
      folder: 'procureiq/org_test/contracts',
      signature: 'SIGNATURE',
    })
    expect(typeof payload.timestamp).toBe('number')
  })

  it('returns 404 when the contract is not in the org', async () => {
    isUploadConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(signUpload).not.toHaveBeenCalled()
  })

  it('returns 503 when uploads are not configured (before any DB call)', async () => {
    isUploadConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {}, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 403 for a member', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { id: 'con_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(signUpload).not.toHaveBeenCalled()
  })
})
