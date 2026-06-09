import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ContractModal from '../components/ui/ContractModal'
import ContractSlideOver from '../components/ui/ContractSlideOver'
import { useContractContext } from '../context/ContractContext'
import { useSupplierContext } from '../context/SupplierContext'
import { filterContracts, sortContracts, CONTRACT_STATUS_BADGE } from '../utils/contractSelectors'
import { formatCurrency, formatCompactCurrency, daysUntil } from '../utils/formatters'
import { cn } from '../utils/cn'

export default function Contracts() {
  const { contracts, addContract, updateContract } = useContractContext()
  const { suppliers } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)

  const displayed = sortContracts(filterContracts(contracts, { search, status, supplierId }), {
    key: 'title',
    direction: 'asc',
  })

  const activeContracts = contracts.filter((c) => c.status === 'active')
  const totalValue = activeContracts.reduce((sum, c) => sum + c.value, 0)
  const expiringSoon = activeContracts.filter((c) => {
    const d = daysUntil(c.endDate)
    return d >= 0 && d <= 30
  }).length
  const expiredCount = contracts.filter((c) => c.status === 'expired').length

  function openAdd() {
    setEditingContract(null)
    setModalOpen(true)
  }

  function openEdit(contract) {
    setEditingContract(contract)
    setSlideOverOpen(false)
    setModalOpen(true)
  }

  function openSlideOver(contract) {
    setSelectedContract(contract)
    setSlideOverOpen(true)
  }

  function handleSubmit(data) {
    if (editingContract) {
      updateContract(editingContract.id, data)
    } else {
      addContract(data)
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Contract',
      render: (row) => (
        <button
          onClick={() => openSlideOver(row)}
          className="text-left font-medium text-accent-blue-light hover:underline"
        >
          {row.title}
        </button>
      ),
    },
    {
      key: 'supplierId',
      header: 'Supplier',
      render: (row) => {
        const s = suppliers.find((s) => s.id === row.supplierId)
        return s ? (
          <Link to={`/suppliers/${s.id}`} className="text-accent-blue-light hover:underline">
            {s.name}
          </Link>
        ) : (
          '—'
        )
      },
    },
    {
      key: 'value',
      header: 'Value',
      render: (row) => formatCurrency(row.value, row.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={CONTRACT_STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>
      ),
    },
    {
      key: 'endDate',
      header: 'Expires',
      render: (row) => {
        if (!row.endDate) return <span className="text-text-muted">—</span>
        const d = daysUntil(row.endDate)
        const cls =
          d < 0 ? 'text-accent-red' : d <= 30 ? 'text-accent-amber' : 'text-text-primary'
        return (
          <span className={cn('font-medium', cls)}>
            {d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" onClick={() => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Manage your supplier contracts"
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusCircle size={16} />
            Add Contract
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Total Value</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{formatCompactCurrency(totalValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Active</p>
          <p className="mt-1 text-xl font-bold text-accent-green">{activeContracts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Expiring &lt;30d</p>
          <p className="mt-1 text-xl font-bold text-accent-amber">{expiringSoon}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Expired</p>
          <p className="mt-1 text-xl font-bold text-accent-red">{expiredCount}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search contracts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="expired">expired</option>
        </select>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={displayed}
        rowKey={(row) => row.id}
        emptyMessage="No contracts match your filters"
      />

      <ContractSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        contract={selectedContract}
        supplier={selectedContract ? suppliers.find((s) => s.id === selectedContract.supplierId) : null}
        onEdit={() => openEdit(selectedContract)}
      />

      <ContractModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contract={editingContract}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
