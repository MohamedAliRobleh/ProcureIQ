import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'

const CATEGORIES = [
  'Raw Materials', 'Manufacturing', 'IT Services', 'Logistics',
  'Packaging', 'Professional Services', 'Energy', 'Components',
]

const COUNTRIES = [
  'United States', 'Germany', 'Japan', 'United Kingdom',
  'Singapore', 'Brazil', 'India', 'Netherlands', 'Australia', 'South Korea',
]

const STATUSES = ['active', 'pending', 'suspended']

const EMPTY_FORM = {
  name: '', email: '', phone: '', country: 'United States',
  category: 'Logistics', status: 'active', website: '', description: '',
}

export default function SupplierModal({ isOpen, onClose, supplier, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      supplier
        ? {
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone ?? '',
            country: supplier.country,
            category: supplier.category,
            status: supplier.status,
            website: supplier.website ?? '',
            description: supplier.description ?? '',
          }
        : EMPTY_FORM
    )
  }, [isOpen, supplier])

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit(form)
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
    <Modal isOpen={isOpen} onClose={onClose} title={supplier ? 'Edit Supplier' : 'Add Supplier'} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {field('name', 'Supplier Name')}
          {field('email', 'Email')}
          {field('phone', 'Phone')}
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-country" className="text-xs font-medium text-text-secondary">Country</label>
            <select
              id="sm-country"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-category" className="text-xs font-medium text-text-secondary">Category</label>
            <select
              id="sm-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-status" className="text-xs font-medium text-text-secondary">Status</label>
            <select
              id="sm-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        {field('website', 'Website')}
        <div className="flex flex-col gap-1">
          <label htmlFor="sm-description" className="text-xs font-medium text-text-secondary">Description</label>
          <textarea
            id="sm-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {supplier ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
