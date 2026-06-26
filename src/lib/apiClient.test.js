import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, setTokenGetter } from './apiClient'

afterEach(() => {
  setTokenGetter(null)
})

describe('apiClient', () => {
  it('GET parses JSON from the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: 1 }] })))
    expect(await api.get('/api/suppliers')).toEqual([{ id: 1 }])
  })

  it('POST sends a JSON body with content-type header', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'x' }) }))
    vi.stubGlobal('fetch', fetchMock)
    await api.post('/api/suppliers', { name: 'A' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/suppliers')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ name: 'A' })
  })

  it('throws instead of silently returning null when a 200 response is not JSON (e.g. the Vite SPA fallback HTML when /api is unrouted)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <') },
    })))
    await expect(api.get('/api/suppliers')).rejects.toThrow(/did not return JSON/)
  })

  it('throws the server error message on non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'name is required' }) })))
    await expect(api.post('/api/suppliers', {})).rejects.toThrow('name is required')
  })

  it('attaches a Bearer token when a token getter is registered', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    vi.stubGlobal('fetch', fetchMock)
    setTokenGetter(async () => 'tok_123')
    await api.get('/api/suppliers')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok_123')
  })

  it('sends no Authorization header when no getter is registered', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    vi.stubGlobal('fetch', fetchMock)
    await api.get('/api/suppliers')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('DELETE issues a request with method DELETE and parses the JSON response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ deleted: true }) }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await api.del('/api/portal-requests/preq_1')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/portal-requests/preq_1')
    expect(options.method).toBe('DELETE')
    expect(result).toEqual({ deleted: true })
  })
})
