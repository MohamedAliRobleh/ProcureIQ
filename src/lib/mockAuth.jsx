import { createContext, useContext } from 'react'

const mockUser = {
  id: 'user_demo_admin',
  firstName: 'Amara',
  lastName: 'Chen',
  fullName: 'Amara Chen',
  emailAddresses: [{ emailAddress: 'amara.chen@procureiq-demo.com' }],
  imageUrl: null,
  publicMetadata: { role: 'org_admin' },
}

const mockOrganization = {
  id: 'org_demo',
  name: 'Procure IQ Demo Org',
  slug: 'procureiq-demo',
  imageUrl: null,
  membersCount: 12,
}

const AuthContext = createContext({ user: mockUser, organization: mockOrganization })

export function MockAuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{ user: mockUser, organization: mockOrganization }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useUser() {
  const { user } = useContext(AuthContext)
  return { isLoaded: true, isSignedIn: true, user }
}

export function useOrganization() {
  const { organization } = useContext(AuthContext)
  return { isLoaded: true, organization }
}
