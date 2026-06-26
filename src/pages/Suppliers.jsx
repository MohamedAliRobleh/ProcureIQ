import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SupplierModal from '../components/ui/SupplierModal'
import { useSupplierContext } from '../context/SupplierContext'
import { usePermissions } from '../lib/permissions'
import { filterSuppliers, sortSuppliers } from '../utils/supplierSelectors'
import { cn } from '../utils/cn'
import { riskColor } from '../utils/formatters'

const CATEGORIES = [
  'Raw Materials', 'Manufacturing', 'IT Services', 'Logistics',
  'Packaging', 'Professional Services', 'Energy', 'Components',
]

const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier } = useSupplierContext()
  const { canManage } = usePermissions()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)

  const displayed = sortSuppliers(filterSuppliers(suppliers, { search, category, status }), { key: 'name', direction: 'asc' })

  function handleSubmit(data) {
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, data)
    } else {
      addSupplier(data)
    }
  }

  function openEdit(supplier) {
    setEditingSupplier(supplier)
    setModalOpen(true)
  }

  function openAdd() {
    setEditingSupplier(null)
    setModalOpen(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Supplier',
      render: (row) => (
        <Link to={`/suppliers/${row.id}`} className="font-medium text-accent-blue-light hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'country', header: 'Country' },
    {
      key: 'riskScore',
      header: 'Risk Score',
      render: (row) => <span className={cn('font-medium', riskColor(row.riskScore))}>{row.riskScore}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        canManage('suppliers') && (
          <Button variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage your supplier portfolio"
        actions={
          canManage('suppliers') && (
            <Button variant="primary" onClick={openAdd}>
              <PlusCircle size={16} />
              Add Supplier
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={displayed}
        rowKey={(row) => row.id}
        emptyMessage="No suppliers match your filters"
      />

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={editingSupplier}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
