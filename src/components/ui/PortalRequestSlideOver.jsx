import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import ConfirmDialog from './ConfirmDialog'
import { PORTAL_STATUS_BADGE, PORTAL_TYPE_LABEL } from '../../utils/portalSelectors'
import { formatDate } from '../../utils/formatters'

export default function PortalRequestSlideOver({ isOpen, onClose, request, supplier, onUpdate, onNotify, onDelete }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const [responseNote, setResponseNote] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [notifyError, setNotifyError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setResponseNote(request?.responseNote ?? '')
    setNotifySent(false)
    setNotifyError(null)
  }, [request?.id])

  async function handleNotify() {
    setNotifyError(null)
    setIsSending(true)
    try {
      await onNotify()
      setNotifySent(true)
    } catch {
      setNotifyError('Could not send the email. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  if (!request) return null

  const due = request.dueDate ? formatDate(request.dueDate) : '—'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="portal-slide-overlay"
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
              <h2 className="font-display text-lg font-semibold text-text-primary">{request.title}</h2>
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
                <Badge variant={PORTAL_STATUS_BADGE[request.status] ?? 'muted'}>{request.status}</Badge>
                <span className="text-sm text-text-secondary">{PORTAL_TYPE_LABEL[request.type] ?? request.type}</span>
              </div>

              {supplier && (
                <Link to={`/suppliers/${supplier.id}`} className="text-sm text-accent-blue-light hover:underline">
                  {supplier.name}
                </Link>
              )}

              <div className="rounded-lg border border-border bg-bg-secondary p-3">
                <p className="text-xs text-text-secondary">Due date</p>
                <p className="mt-1 text-base font-semibold text-text-primary">{due}</p>
              </div>

              {request.message && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Message</p>
                  <p className="text-sm text-text-primary">{request.message}</p>
                </div>
              )}

              {request.status === 'pending' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Response note
                    <textarea
                      rows={2}
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent"
                    />
                  </label>
                  <Button variant="primary" onClick={() => onUpdate({ status: 'submitted', responseNote })}>
                    Mark submitted
                  </Button>
                </div>
              )}

              {request.status === 'submitted' && (
                <div className="flex gap-3">
                  <Button variant="primary" onClick={() => onUpdate({ status: 'approved' })}>Approve</Button>
                  <Button variant="danger" onClick={() => onUpdate({ status: 'rejected' })}>Reject</Button>
                </div>
              )}

              {(request.status === 'approved' || request.status === 'rejected') && request.responseNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Response note</p>
                  <p className="text-sm text-text-primary">{request.responseNote}</p>
                </div>
              )}

              {onNotify && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Notify supplier</p>
                  <Button variant="secondary" onClick={handleNotify} disabled={isSending}>
                    {isSending ? 'Sending…' : 'Email request'}
                  </Button>
                  {notifySent && <p className="mt-1 text-xs text-accent-green">Email sent ✓</p>}
                  {notifyError && <p className="mt-1 text-xs text-accent-red">{notifyError}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete request</Button>
            </div>
          </motion.div>

          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false)
              onDelete()
            }}
            title="Delete request"
            description="This permanently deletes this supplier request."
            confirmWord="delete"
            confirmLabel="Delete"
          />
        </>
      )}
    </AnimatePresence>
  )
}
