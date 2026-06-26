import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { NAV_ITEMS } from '../../utils/constants'
import { useOrganization } from '../../lib/auth'

export default function Sidebar() {
  const { membership, organization } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const orgName = organization?.name ?? 'ProcureIQ'

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-bg-secondary px-4 py-6 lg:flex">
      <div className="flex items-center gap-2 px-2">
        {organization?.imageUrl && (
          <img src={organization.imageUrl} alt={orgName} className="h-6 w-6 rounded" />
        )}
        <span className="truncate font-display text-xl font-semibold text-text-primary">{orgName}</span>
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary',
                isActive && 'border border-border-accent bg-bg-hover text-text-primary'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
