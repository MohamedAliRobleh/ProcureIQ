import { ChevronRight } from 'lucide-react'

export default function PageHeader({ title, description, breadcrumb, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-text-secondary">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={12} />}
                {crumb}
              </span>
            ))}
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
