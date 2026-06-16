import { useEffect } from 'react'
import {
  ClerkProvider,
  useAuth,
  useUser,
  useOrganization,
  UserButton,
  OrganizationSwitcher,
  SignIn,
  SignUp,
} from '@clerk/clerk-react'
import { setTokenGetter } from './apiClient'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const CLERK_APPEARANCE = {
  variables: {
    colorBackground: '#16181F',
    colorInputBackground: '#0A0B0F',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorPrimary: '#3B82F6',
    colorDanger: '#EF4444',
    borderRadius: '0.5rem',
  },
}

function TokenBridge({ children }) {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(getToken)
    return () => setTokenGetter(null)
  }, [getToken])
  return children
}

export function AuthProvider({ children }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
      <TokenBridge>{children}</TokenBridge>
    </ClerkProvider>
  )
}

export { useUser, useOrganization, UserButton, OrganizationSwitcher, SignIn, SignUp }
