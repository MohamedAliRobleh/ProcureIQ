import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'

// A destructive-action confirmation: the confirm button stays disabled until
// the user types `confirmWord` exactly. The typed phrase is cleared whenever
// the dialog closes, so reopening always starts disabled — even when the
// parent closes it directly (e.g. after a failed action) rather than via Cancel.
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmWord, confirmLabel, busy }) {
  const [text, setText] = useState('')
  const matches = text.trim() === confirmWord

  useEffect(() => {
    if (!isOpen) setText('')
  }, [isOpen])

  function handleClose() {
    setText('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <p className="text-sm text-text-secondary">{description}</p>
      <label className="mt-4 block text-sm text-text-secondary">
        Type <span className="font-mono font-semibold text-text-primary">{confirmWord}</span> to confirm:
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent"
        />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        <Button variant="danger" disabled={!matches || busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
