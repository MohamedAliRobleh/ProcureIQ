import { cn } from '../../utils/cn'

export default function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-xl border border-border bg-bg-card shadow-lg', className)} {...props}>
      {children}
    </div>
  )
}
