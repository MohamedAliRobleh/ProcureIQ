// Mutable state read by the global mock of src/lib/auth.jsx (see setup.js).
// Tests that need loading/signed-out states mutate this, and beforeEach
// resets it to the signed-in demo user.

const DEFAULT_USER = {
  id: 'user_demo_admin',
  firstName: 'Amara',
  lastName: 'Chen',
  fullName: 'Amara Chen',
  emailAddresses: [{ emailAddress: 'amara.chen@procureiq-demo.com' }],
  imageUrl: null,
  publicMetadata: { role: 'org_admin' },
}

export const DEFAULT_ORG = {
  id: 'org_default',
  name: 'Northwind Trading',
  slug: 'northwind-trading',
  imageUrl: null,
  membersCount: 12,
}

export const DEMO_ORG = {
  id: 'org_demo',
  name: 'ProcureIQ Demo',
  slug: 'procureiq-demo',
  imageUrl: null,
  membersCount: 12,
}

export const authState = {
  isLoaded: true,
  isSignedIn: true,
  user: DEFAULT_USER,
  orgLoaded: true,
  organization: DEFAULT_ORG,
  membership: { role: 'org:admin' },
}

export function resetAuthState() {
  authState.isLoaded = true
  authState.isSignedIn = true
  authState.user = DEFAULT_USER
  authState.orgLoaded = true
  authState.organization = DEFAULT_ORG
  authState.membership = { role: 'org:admin' }
}
