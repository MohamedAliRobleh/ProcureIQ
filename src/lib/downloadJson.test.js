import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadJson } from './downloadJson'

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake-url'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downloadJson', () => {
  it('creates a blob url, clicks a download anchor with the filename, and revokes the url', () => {
    const clicked = []
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => clicked.push({ href: el.href, download: el.download }))
      return el
    })

    downloadJson({ a: 1 }, 'backup.json')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('backup.json')
    expect(clicked[0].href).toContain('blob:fake-url')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
