import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { createMockFetch } from './mockApi'

beforeEach(() => {
  vi.stubGlobal('fetch', createMockFetch())
})
