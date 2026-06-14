import { describe, it, expect, vi, afterEach } from 'vitest'
import { uploadToCloudinary } from './cloudinaryUpload'

const sig = {
  cloudName: 'democloud',
  apiKey: '999',
  timestamp: 1700000000,
  folder: 'procureiq/org_demo/contracts',
  signature: 'SIGNATURE',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadToCloudinary', () => {
  it('POSTs the file with the signed params and returns secure_url', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/democloud/x.pdf' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['pdf-bytes'], 'contract.pdf', { type: 'application/pdf' })
    const url = await uploadToCloudinary(file, sig)

    expect(url).toBe('https://res.cloudinary.com/democloud/x.pdf')
    const [calledUrl, options] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.cloudinary.com/v1_1/democloud/auto/upload')
    expect(options.method).toBe('POST')
    const form = options.body
    expect(form.get('signature')).toBe('SIGNATURE')
    expect(form.get('timestamp')).toBe('1700000000')
    expect(form.get('folder')).toBe('procureiq/org_demo/contracts')
    expect(form.get('api_key')).toBe('999')
    expect(form.get('file')).toBe(file)
  })

  it('throws when Cloudinary responds non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: { message: 'bad' } }) })))
    const file = new File(['x'], 'c.pdf', { type: 'application/pdf' })
    await expect(uploadToCloudinary(file, sig)).rejects.toThrow('Upload failed')
  })
})
