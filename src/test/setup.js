import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { createMockFetch } from './mockApi'
import { resetAuthState } from './authState'

// Global Clerk-free mock of the auth seam. Tests simulate loading/signed-out
// by mutating authState (reset before every test).
vi.mock('../lib/auth.jsx', async () => {
  const { createElement } = await import('react')
  const { authState, DEMO_ORG } = await import('./authState')
  return {
    AuthProvider: ({ children }) => children,
    useUser: () => ({
      isLoaded: authState.isLoaded,
      isSignedIn: authState.isSignedIn,
      user: authState.isSignedIn ? authState.user : null,
    }),
    useOrganization: () => ({ isLoaded: true, organization: DEMO_ORG }),
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
})

beforeEach(() => {
  vi.stubGlobal('fetch', createMockFetch())
  resetAuthState()
})
