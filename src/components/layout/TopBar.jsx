import { useUser, UserButton, OrganizationSwitcher } from '../../lib/auth'

export default function TopBar() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role ?? 'member'

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <OrganizationSwitcher />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">{user?.fullName ?? ''}</p>
          <p className="text-xs capitalize text-text-secondary">{role.replace('_', ' ')}</p>
        </div>
        <UserButton />
      </div>
    </header>
  )
}
