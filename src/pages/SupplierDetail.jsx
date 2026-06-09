import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SupplierModal from '../components/ui/SupplierModal'
import PageHeader from '../components/layout/PageHeader'
import { useSupplierContext } from '../context/SupplierContext'
import { formatDate } from '../utils/formatters'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const TAB_PHASE = { Contracts: 'Phase 3', Risk: 'Phase 3', ESG: 'Phase 4', Spend: 'Phase 4' }
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }

function riskColor(score) {
  if (score <= 33) return 'text-accent-green'
  if (score <= 66) return 'text-accent-amber'
  return 'text-accent-red'
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { suppliers, updateSupplier, setSupplierStatus } = useSupplierContext()
  const [activeTab, setActiveTab] = useState('Overview')
  const [modalOpen, setModalOpen] = useState(false)

  const supplier = suppliers.find((s) => s.id === id)

  if (!supplier) {
    return (
      <div>
        <PageHeader title="Supplier not found" description="This supplier does not exist or has been removed." />
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-accent-blue-light hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Suppliers
        </Link>
      </div>
    )
  }

  const isActive = supplier.status === 'active'

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/suppliers"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Suppliers
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-primary">{supplier.name}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={STATUS_BADGE[supplier.status] ?? 'muted'}>{supplier.status}</Badge>
            <span className="text-sm text-text-secondary">
              {supplier.category} · {supplier.country}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Edit</Button>
          <Button
            variant={isActive ? 'danger' : 'primary'}
            onClick={() => setSupplierStatus(supplier.id, isActive ? 'suspended' : 'active')}
          >
            {isActive ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="mb-6 border-b border-border">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-accent-blue text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Risk Score</p>
              <p className={cn('mt-1 text-2xl font-bold', riskColor(supplier.riskScore))}>{supplier.riskScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">ESG Score</p>
              <p className="mt-1 text-2xl font-bold text-accent-blue">{supplier.esgScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Onboarded</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(supplier.onboardedAt)}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Contact Information</h3>
            <div className="space-y-1.5 text-sm text-text-secondary">
              <p>
                Email:{' '}
                <a href={`mailto:${supplier.email}`} className="text-accent-blue-light hover:underline">
                  {supplier.email}
                </a>
              </p>
              <p>Phone: {supplier.phone}</p>
              <p>
                Website:{' '}
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue-light hover:underline"
                >
                  {supplier.website}
                </a>
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">About</h3>
            <p className="text-sm text-text-secondary">{supplier.description}</p>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-semibold text-text-primary">{activeTab} is under construction</p>
          <p className="mt-1 text-sm text-text-secondary">
            This module is coming in {TAB_PHASE[activeTab]}.
          </p>
        </Card>
      )}

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={supplier}
        onSubmit={(data) => updateSupplier(supplier.id, data)}
      />
    </div>
  )
}
