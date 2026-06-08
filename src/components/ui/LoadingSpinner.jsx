import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export default function LoadingSpinner({ size = 24, className }) {
  return (
    <div className={cn('flex items-center justify-center p-6', className)} role="status" aria-label="Loading">
      <Loader2 size={size} className="animate-spin text-accent-blue" />
    </div>
  )
}
