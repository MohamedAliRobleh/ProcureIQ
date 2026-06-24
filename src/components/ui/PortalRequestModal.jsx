import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { PORTAL_REQUEST_TYPES, PORTAL_TYPE_LABEL } from '../../utils/portalSelectors'

const EMPTY = { supplierId: '', type: 'general', title: '', message: '', dueDate: '' }

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent'

export default function PortalRequestModal({ isOpen, onClose, suppliers, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const canSubmit = form.supplierId && form.title.trim()

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({ ...form, title: form.title.trim(), message: form.message.trim() })
    setForm(EMPTY)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New supplier request">
      <div className="space-y-3">
        <label className="block text-sm text-text-secondary">
          Supplier
          <select className={inputClass} value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">Select a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          Type
          <select className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {PORTAL_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>{PORTAL_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          Title
          <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>

        <label className="block text-sm text-text-secondary">
          Message
          <textarea className={inputClass} rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} />
        </label>

        <label className="block text-sm text-text-secondary">
          Due date
          <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>Create request</Button>
      </div>
    </Modal>
  )
}
