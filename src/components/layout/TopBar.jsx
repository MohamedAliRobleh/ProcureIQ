import { useOrganization, useUser } from '../../lib/mockAuth'

export default function TopBar() {
  const { user } = useUser()
  const { organization } = useOrganization()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <div>
        <p className="text-sm font-medium text-text-primary">{organization.name}</p>
        <p className="text-xs text-text-secondary">{organization.membersCount} members</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">{user.fullName}</p>
          <p className="text-xs capitalize text-text-secondary">{user.publicMetadata.role.replace('_', ' ')}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-blue font-display text-sm font-semibold text-white">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
      </div>
    </header>
  )
}
