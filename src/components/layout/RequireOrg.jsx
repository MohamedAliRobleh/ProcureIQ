import LoadingSpinner from '../ui/LoadingSpinner'
import { useOrganization, OrganizationSwitcher } from '../../lib/auth'

// Gates the app behind having an active organization. Renders inside
// ProtectedRoute, so by this point the user is already signed in.
export default function RequireOrg({ children }) {
  const { isLoaded, organization } = useOrganization()
  if (!isLoaded) return <LoadingSpinner className="min-h-screen" />
  if (!organization) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Select or create an organization
          </h1>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            ProcureIQ workspaces are scoped to an organization. Choose one or create a new one to continue.
          </p>
        </div>
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </div>
    )
  }
  return children
}
