import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import PortalRequestModal from '../components/ui/PortalRequestModal'
import PortalRequestSlideOver from '../components/ui/PortalRequestSlideOver'
import { usePortalContext } from '../context/PortalContext'
import { useSupplierContext } from '../context/SupplierContext'
import { filterRequests, PORTAL_STATUS_BADGE, PORTAL_TYPE_LABEL, PORTAL_STATUSES } from '../utils/portalSelectors'
import { formatDate } from '../utils/formatters'

export default function Portal() {
  const { requests, isLoading, createRequest, updateRequest, deleteRequest, notifyRequest } = usePortalContext()
  const { suppliers } = useSupplierContext()
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const displayed = filterRequests(requests, { status })
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? '—'

  function openSlideOver(request) {
    setSelectedId(request.id)
    setSlideOverOpen(true)
  }

  const liveSelected = selectedId ? requests.find((r) => r.id === selectedId) ?? null : null
  const liveSupplier = liveSelected ? suppliers.find((s) => s.id === liveSelected.supplierId) ?? null : null

  const columns = [
    {
      key: 'title',
      header: 'Request',
      render: (row) => (
        <button onClick={() => openSlideOver(row)} className="text-left font-medium text-accent-blue-light hover:underline">
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
          <Link to={`/suppliers/${s.id}`} className="text-accent-blue-light hover:underline">{s.name}</Link>
        ) : (
          '—'
        )
      },
    },
    { key: 'type', header: 'Type', render: (row) => PORTAL_TYPE_LABEL[row.type] ?? row.type },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={PORTAL_STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Due',
      render: (row) => (row.dueDate ? formatDate(row.dueDate) : <span className="text-text-muted">—</span>),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Supplier Portal"
        description="Create and track requests to your suppliers"
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <PlusCircle size={16} />
            New request
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-text-secondary">
          <span className="sr-only">Status</span>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
          >
            <option value="">All Statuses</option>
            {PORTAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        data={displayed}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No requests match your filters"
      />

      <PortalRequestSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        request={liveSelected}
        supplier={liveSupplier}
        onUpdate={liveSelected ? (patch) => updateRequest(liveSelected.id, patch) : undefined}
        onNotify={liveSelected ? () => notifyRequest(liveSelected.id) : undefined}
        onDelete={
          liveSelected
            ? () => {
                deleteRequest(liveSelected.id)
                setSlideOverOpen(false)
              }
            : undefined
        }
      />

      <PortalRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        suppliers={suppliers}
        onSubmit={createRequest}
      />
    </div>
  )
}
