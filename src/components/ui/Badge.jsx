import { cn } from '../../utils/cn'

const VARIANT_CLASSES = {
  blue: 'bg-accent-blue/15 text-accent-blue-light border-accent-blue/30',
  green: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  amber: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  red: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/30',
  muted: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
}

export default function Badge({ variant = 'blue', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.blue,
        className
      )}
    >
      {children}
    </span>
  )
}
