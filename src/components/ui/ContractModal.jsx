import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'

const STATUSES = ['active', 'draft', 'expired']

const EMPTY_FORM = {
  title: '',
  supplierId: '',
  value: '',
  currency: 'USD',
  startDate: '',
  endDate: '',
  status: 'active',
  autoRenew: false,
  terms: '',
}

export default function ContractModal({ isOpen, onClose, contract, onSubmit }) {
  const { suppliers } = useSupplierContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      contract
        ? {
            title: contract.title,
            supplierId: contract.supplierId,
            value: String(contract.value),
            currency: contract.currency,
            startDate: contract.startDate
              ? new Date(contract.startDate).toISOString().split('T')[0]
              : '',
            endDate: contract.endDate
              ? new Date(contract.endDate).toISOString().split('T')[0]
              : '',
            status: contract.status,
            autoRenew: contract.autoRenew ?? false,
            terms: contract.terms ?? '',
          }
        : EMPTY_FORM
    )
  }, [isOpen, contract])

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    if (!form.value || isNaN(Number(form.value))) errs.value = 'Value is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit({ ...form, value: Number(form.value) })
    onClose()
  }

  function field(key, label, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`cm-${key}`} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <input
          id={`cm-${key}`}
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        {errors[key] && <p className="text-xs text-accent-red">{errors[key]}</p>}
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contract ? 'Edit Contract' : 'Add Contract'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {field('title', 'Contract Title')}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="cm-supplierId" className="text-xs font-medium text-text-secondary">
              Supplier
            </label>
            <select
              id="cm-supplierId"
              value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.supplierId && <p className="text-xs text-accent-red">{errors.supplierId}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cm-status" className="text-xs font-medium text-text-secondary">
              Status
            </label>
            <select
              id="cm-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {field('value', 'Value (USD)', 'number')}
          {field('currency', 'Currency')}
          {field('startDate', 'Start Date', 'date')}
          {field('endDate', 'End Date', 'date')}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="cm-autoRenew"
            type="checkbox"
            checked={form.autoRenew}
            onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))}
            className="h-4 w-4 rounded border-border bg-bg-primary"
          />
          <label htmlFor="cm-autoRenew" className="text-sm text-text-secondary">
            Auto-renew
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cm-terms" className="text-xs font-medium text-text-secondary">
            Terms
          </label>
          <textarea
            id="cm-terms"
            value={form.terms}
            onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
            rows={3}
            className="resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {contract ? 'Save Changes' : 'Add Contract'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
