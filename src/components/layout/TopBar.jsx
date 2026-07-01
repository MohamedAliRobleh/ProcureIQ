import { useUser, UserButton, OrganizationSwitcher, useIsDemoOrg } from '../../lib/auth'
import SandboxBadge from '../demo/SandboxBadge'
import { useTour } from '../tour/TourProvider'
import { Compass } from 'lucide-react'

export default function TopBar() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role ?? 'member'
  const isDemo = useIsDemoOrg()
  const { start } = useTour()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <OrganizationSwitcher />
      <div className="flex items-center gap-3">
        {isDemo && (
          <button
            onClick={start}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            <Compass size={15} />
            Take a tour
          </button>
        )}
        <SandboxBadge />
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">{user?.fullName ?? ''}</p>
          <p className="text-xs capitalize text-text-secondary">{role.replace('_', ' ')}</p>
        </div>
        <UserButton />
      </div>
    </header>
  )
}
