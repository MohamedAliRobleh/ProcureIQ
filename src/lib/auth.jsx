import { useEffect } from 'react'
import {
  ClerkProvider,
  useAuth,
  useUser,
  useOrganization,
  UserButton,
  OrganizationSwitcher,
  OrganizationProfile,
  SignIn,
  SignUp,
} from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { setTokenGetter } from './apiClient'
import { setSandboxActive } from './sandbox'
import { DEMO_ORG_SLUG } from './demoConfig'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const CLERK_APPEARANCE = {
  // Start from Clerk's dark base theme so EVERY internal element (including the
  // OrganizationProfile tables/badges/tabs that aren't in the elements map below)
  // renders dark-with-light-text; the variables + elements then brand it.
  baseTheme: dark,
  variables: {
    colorBackground: '#16181F',
    colorInputBackground: '#0A0B0F',
    colorInputText: '#F1F5F9',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorPrimary: '#3B82F6',
    colorDanger: '#EF4444',
    borderRadius: '0.75rem',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  elements: {
    rootBox: 'font-body',
    card: 'shadow-2xl shadow-black/40 border border-border rounded-2xl px-8 py-10',
    headerTitle: 'font-display text-2xl font-bold tracking-tight text-text-primary',
    headerSubtitle: 'text-text-secondary',
    socialButtonsBlockButton:
      'bg-bg-secondary border border-border hover:bg-bg-hover hover:border-border-accent transition-colors rounded-lg',
    socialButtonsBlockButtonText: 'text-text-primary font-medium',
    dividerLine: 'bg-border',
    dividerText: 'text-text-muted',
    formFieldLabel: 'text-text-secondary font-medium text-sm',
    formFieldInput:
      'bg-bg-primary text-text-primary border border-border focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-lg transition-colors',
    formFieldInputShowPasswordButton: 'text-text-secondary hover:text-text-primary',
    otpCodeFieldInput:
      'bg-bg-primary text-text-primary border border-border focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-lg',
    formResendCodeLink: 'text-accent-blue-light hover:text-accent-blue font-medium',
    formButtonPrimary:
      'bg-gradient-blue hover:opacity-90 transition-opacity rounded-lg font-semibold shadow-lg shadow-accent-blue/20',
    footerActionLink: 'text-accent-blue-light hover:text-accent-blue font-medium',
    identityPreviewText: 'text-text-secondary',
    identityPreviewEditButton: 'text-accent-blue-light hover:text-accent-blue',
    footer: 'opacity-70',
    modalCloseButton: 'text-text-secondary hover:text-text-primary',
    organizationSwitcherTrigger:
      'bg-bg-secondary border border-border rounded-lg hover:bg-bg-hover transition-colors',
    organizationSwitcherPopoverCard: 'bg-bg-card border border-border rounded-2xl shadow-2xl shadow-black/40',
    organizationSwitcherPopoverActionButton: 'hover:bg-bg-hover rounded-lg transition-colors',
    organizationSwitcherPopoverActionButtonText: 'text-text-primary font-medium',
    organizationSwitcherPopoverActionButtonIcon: 'text-accent-blue-light',
    organizationPreviewMainIdentifier: 'text-text-primary',
    organizationPreviewSecondaryIdentifier: 'text-text-secondary',
    fileDropAreaBox: 'bg-bg-secondary border border-border rounded-lg hover:border-border-accent transition-colors',
    fileDropAreaIcon: 'text-text-secondary',
    fileDropAreaHint: 'text-text-muted text-xs',
    fileDropAreaButtonPrimary: 'text-accent-blue-light hover:text-accent-blue font-medium',
    avatarBox: 'bg-bg-secondary border border-border',
    userButtonPopoverCard: 'bg-bg-card border border-border rounded-2xl shadow-2xl shadow-black/40',
    userButtonPopoverActionButton: 'hover:bg-bg-hover rounded-lg transition-colors',
    userButtonPopoverActionButtonText: 'text-text-primary font-medium',
    userButtonPopoverActionButtonIcon: 'text-accent-blue-light',
    userPreviewMainIdentifier: 'text-text-primary',
    userPreviewSecondaryIdentifier: 'text-text-secondary',
  },
}

export function useIsDemoOrg() {
  const { organization } = useOrganization()
  return organization?.slug === DEMO_ORG_SLUG
}

function TokenBridge({ children }) {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(getToken)
    return () => setTokenGetter(null)
  }, [getToken])
  return children
}

function DemoBridge({ children }) {
  const { organization } = useOrganization()
  useEffect(() => {
    setSandboxActive(organization?.slug === DEMO_ORG_SLUG)
    return () => setSandboxActive(false)
  }, [organization?.slug])
  return children
}

export function AuthProvider({ children }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
      <TokenBridge>
        <DemoBridge>{children}</DemoBridge>
      </TokenBridge>
    </ClerkProvider>
  )
}

export { useUser, useOrganization, UserButton, OrganizationSwitcher, OrganizationProfile, SignIn, SignUp }
