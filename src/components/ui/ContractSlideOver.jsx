import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import { formatCurrency, formatDate, daysUntil } from '../../utils/formatters'
import { CONTRACT_STATUS_BADGE } from '../../utils/contractSelectors'
import { cn } from '../../utils/cn'

export default function ContractSlideOver({ isOpen, onClose, contract, supplier, onEdit }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!contract) return null

  const days = contract.endDate ? daysUntil(contract.endDate) : null
  const expiryClass =
    days === null
      ? 'text-text-primary'
      : days < 0
      ? 'text-accent-red'
      : days <= 30
      ? 'text-accent-amber'
      : 'text-text-primary'
  const expiryLabel =
    days === null ? '—' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="contract-slide-overlay"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-bg-card shadow-2xl"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">{contract.title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="flex items-center gap-3">
                <Badge variant={CONTRACT_STATUS_BADGE[contract.status] ?? 'muted'}>
                  {contract.status}
                </Badge>
                {supplier && (
                  <Link
                    to={`/suppliers/${supplier.id}`}
                    className="text-sm text-accent-blue-light hover:underline"
                  >
                    {supplier.name}
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-secondary p-3">
                  <p className="text-xs text-text-secondary">Value</p>
                  <p className="mt-1 text-base font-semibold text-text-primary">
                    {formatCurrency(contract.value, contract.currency)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-secondary p-3">
                  <p className="text-xs text-text-secondary">Expires</p>
                  <p className={cn('mt-1 text-base font-semibold', expiryClass)}>{expiryLabel}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-text-secondary">
                {contract.startDate && (
                  <p>
                    Start:{' '}
                    <span className="text-text-primary">{formatDate(contract.startDate)}</span>
                  </p>
                )}
                {contract.endDate && (
                  <p>
                    End:{' '}
                    <span className="text-text-primary">{formatDate(contract.endDate)}</span>
                  </p>
                )}
                {contract.autoRenew && (
                  <span className="inline-block rounded-full bg-accent-blue/10 px-2 py-0.5 text-xs text-accent-blue-light">
                    Auto-renew
                  </span>
                )}
              </div>

              {contract.terms && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Terms</p>
                  <p className="text-sm text-text-primary">{contract.terms}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={onEdit}>
                Edit Contract
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
