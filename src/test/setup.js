import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { createMockFetch } from './mockApi'
import { resetAuthState } from './authState'

// Node 25 ships a built-in localStorage stub that lacks the Web Storage API
// (no getItem/setItem/clear). Polyfill it so sandbox tests work under jsdom.
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size },
    key: (i) => [...store.keys()][i] ?? null,
  })
}

// Global Clerk-free mock of the auth seam. Tests simulate loading/signed-out
// by mutating authState (reset before every test).
vi.mock('../lib/auth.jsx', async () => {
  const { createElement } = await import('react')
  const { authState } = await import('./authState')
  return {
    AuthProvider: ({ children }) => children,
    useUser: () => ({
      isLoaded: authState.isLoaded,
      isSignedIn: authState.isSignedIn,
      user: authState.isSignedIn ? authState.user : null,
    }),
    useOrganization: () => ({
      isLoaded: authState.orgLoaded,
      organization: authState.organization,
      membership: authState.membership,
    }),
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    OrganizationSwitcher: () => createElement('div', { 'data-testid': 'org-switcher' }),
    OrganizationProfile: () => createElement('div', { 'data-testid': 'org-profile' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
})

beforeEach(() => {
  vi.stubGlobal('fetch', createMockFetch())
  resetAuthState()
})
