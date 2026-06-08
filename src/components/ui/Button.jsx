import { cn } from '../../utils/cn'

const VARIANT_CLASSES = {
  primary: 'bg-gradient-blue text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]',
  secondary: 'bg-bg-hover text-text-primary border border-border hover:border-border-accent',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
  danger: 'bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/25',
}

export default function Button({ variant = 'primary', className, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
