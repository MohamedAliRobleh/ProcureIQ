import { cn } from '../../utils/cn'
import Card from './Card'

export default function StatCard({ label, value, icon: Icon, trend, className }) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-text-primary">{value}</p>
          {trend && (
            <p className={cn('mt-1 text-xs font-medium', trend.positive ? 'text-accent-green' : 'text-accent-red')}>
              {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-bg-hover p-2.5">
            <Icon size={20} className="text-accent-blue-light" />
          </div>
        )}
      </div>
    </Card>
  )
}
