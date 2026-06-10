import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'
import { formatDateToInput } from '../../utils/formatters'
import { SPEND_CATEGORIES } from '../../lib/mockData'

const EMPTY_FORM = {
  supplierId: '',
  amount: '',
  currency: 'USD',
  category: '',
  description: '',
  date: '',
  invoiceRef: '',
}

export default function SpendModal({ isOpen, onClose, record, onSubmit, defaultSupplierId }) {
  const { suppliers } = useSupplierContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      record
        ? {
            supplierId: record.supplierId,
            amount: String(record.amount),
            currency: record.currency,
            category: record.category,
            description: record.description ?? '',
            date: record.date ? formatDateToInput(record.date) : '',
            invoiceRef: record.invoiceRef ?? '',
          }
        : { ...EMPTY_FORM, supplierId: defaultSupplierId ?? '', date: formatDateToInput(new Date()) }
    )
  }, [isOpen, record, defaultSupplierId])

  function validate() {
    const errs = {}
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    if (form.amount === '' || isNaN(Number(form.amount))) errs.amount = 'Amount is required'
    if (!form.category) errs.category = 'Category is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit({ ...form, amount: Number(form.amount) })
    onClose()
  }

  function field(key, label, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`sm-${key}`} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <input
          id={`sm-${key}`}
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
      title={record ? 'Edit Spend Record' : 'Add Spend Record'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-supplierId" className="text-xs font-medium text-text-secondary">
              Supplier
            </label>
            <select
              id="sm-supplierId"
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
            <label htmlFor="sm-category" className="text-xs font-medium text-text-secondary">
              Category
            </label>
            <select
              id="sm-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="">Select category...</option>
              {SPEND_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-accent-red">{errors.category}</p>}
          </div>
          {field('amount', 'Amount', 'number')}
          {field('currency', 'Currency')}
          {field('date', 'Date', 'date')}
          {field('invoiceRef', 'Invoice Ref')}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sm-description" className="text-xs font-medium text-text-secondary">
            Description
          </label>
          <input
            id="sm-description"
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {record ? 'Save Changes' : 'Add Record'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
