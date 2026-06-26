import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import SupplierModal from '../components/ui/SupplierModal'
import ContractModal from '../components/ui/ContractModal'
import ContractSlideOver from '../components/ui/ContractSlideOver'
import SpendModal from '../components/ui/SpendModal'
import PageHeader from '../components/layout/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSupplierContext } from '../context/SupplierContext'
import { useContractContext } from '../context/ContractContext'
import { useSpendContext } from '../context/SpendContext'
import { useUser } from '../lib/auth'
import { usePermissions } from '../lib/permissions'
import { useRisk } from '../hooks/useRisk'
import { useEsg } from '../hooks/useEsg'
import { formatDate, formatCurrency, daysUntil, riskColor, esgColor } from '../utils/formatters'
import { filterContracts, CONTRACT_STATUS_BADGE } from '../utils/contractSelectors'
import { RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { esgRating, ESG_RATING_BADGE, ESG_RATING_LABEL } from '../utils/esgSelectors'
import { filterSpendRecords } from '../utils/spendSelectors'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }

export default function SupplierDetail() {
  const { id } = useParams()
  const { suppliers, updateSupplier, setSupplierStatus, isLoading } = useSupplierContext()
  const { contracts, addContract, updateContract, summarizeContract, attachContractDocument, notifyContract } = useContractContext()
  const { spendRecords, addSpendRecord, updateSpendRecord } = useSpendContext()
  const { canManage } = usePermissions()
  const canManageContracts = canManage('contracts')
  const canManageSpend = canManage('spend')
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  const { riskAssessments } = useRisk()
  const { esgResponses } = useEsg()
  const [activeTab, setActiveTab] = useState('Overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [contractSlideOpen, setContractSlideOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [spendModalOpen, setSpendModalOpen] = useState(false)
  const [editingSpend, setEditingSpend] = useState(null)

  const supplier = suppliers.find((s) => s.id === id)

  if (isLoading) {
    return <LoadingSpinner className="py-24" />
  }

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
  const supplierContracts = filterContracts(contracts, { supplierId: supplier.id })
  const riskAssessment = (riskAssessments ?? []).find((a) => a.supplierId === supplier.id)

  function openAddContract() {
    setEditingContract(null)
    setContractModalOpen(true)
  }

  function openEditContract(contract) {
    setEditingContract(contract)
    setContractSlideOpen(false)
    setContractModalOpen(true)
  }

  function openContractSlideOver(contract) {
    setSelectedContract(contract)
    setContractSlideOpen(true)
  }

  function handleContractSubmit(data) {
    if (editingContract) {
      updateContract(editingContract.id, data)
    } else {
      addContract({ ...data, supplierId: supplier.id })
    }
  }

  function openAddSpend() {
    setEditingSpend(null)
    setSpendModalOpen(true)
  }

  function openEditSpend(record) {
    setEditingSpend(record)
    setSpendModalOpen(true)
  }

  function handleSpendSubmit(data) {
    if (editingSpend) {
      updateSpendRecord(editingSpend.id, data)
    } else {
      addSpendRecord({ ...data, supplierId: supplier.id })
    }
  }

  const contractColumns = [
    {
      key: 'title',
      header: 'Contract',
      render: (row) => (
        <button
          onClick={() => openContractSlideOver(row)}
          className="text-left font-medium text-accent-blue-light hover:underline"
        >
          {row.title}
        </button>
      ),
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
        const cls = d < 0 ? 'text-accent-red' : d <= 30 ? 'text-accent-amber' : 'text-text-primary'
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
      render: (row) =>
        canManageContracts ? (
          <Button variant="ghost" onClick={() => openEditContract(row)}>
            Edit
          </Button>
        ) : null,
    },
  ]

  const spendColumns = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount, row.currency) },
    { key: 'invoiceRef', header: 'Invoice Ref' },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canManageSpend ? (
          <Button variant="ghost" onClick={() => openEditSpend(row)}>
            Edit
          </Button>
        ) : null,
    },
  ]

  function renderContractsTab() {
    const liveSelected = selectedContract
      ? contracts.find((c) => c.id === selectedContract.id) ?? selectedContract
      : null
    return (
      <div>
        {canManageContracts && (
          <div className="mb-3 flex justify-end">
            <Button variant="ghost" onClick={openAddContract}>
              Add Contract
            </Button>
          </div>
        )}
        <DataTable
          columns={contractColumns}
          data={supplierContracts}
          rowKey={(row) => row.id}
          emptyMessage="No contracts for this supplier"
        />
        <ContractSlideOver
          isOpen={contractSlideOpen}
          onClose={() => setContractSlideOpen(false)}
          contract={liveSelected}
          supplier={supplier}
          onEdit={canManageContracts ? () => openEditContract(liveSelected) : undefined}
          onSummarize={canManageContracts && liveSelected ? () => summarizeContract(liveSelected.id) : undefined}
          onUpload={canManageContracts && liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}
          onNotify={canManageContracts && liveSelected && userEmail ? () => notifyContract(liveSelected.id, userEmail) : undefined}
        />
        <ContractModal
          isOpen={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          contract={editingContract}
          onSubmit={handleContractSubmit}
        />
      </div>
    )
  }

  function renderRiskTab() {
    if (!riskAssessment) {
      return (
        <Card className="p-6 text-center">
          <p className="text-sm text-text-secondary">No risk assessment available</p>
        </Card>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={RISK_LEVEL_BADGE[riskAssessment.level] ?? 'muted'}>
            {riskAssessment.level}
          </Badge>
          <span className={cn('text-xl font-bold', riskColor(riskAssessment.score))}>
            {riskAssessment.score}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Financial Risk', value: riskAssessment.financialRisk },
            { label: 'Compliance Risk', value: riskAssessment.complianceRisk },
            { label: 'Operational Risk', value: riskAssessment.operationalRisk },
            { label: 'Geopolitical Risk', value: riskAssessment.geopoliticalRisk },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold', riskColor(value))}>{value}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Assessed {formatDate(riskAssessment.assessedAt)} by {riskAssessment.assessedBy}
        </p>
      </div>
    )
  }

  function renderEsgTab() {
    const esgResponse = (esgResponses ?? []).find((r) => r.supplierId === supplier.id)
    if (!esgResponse) {
      return (
        <Card className="p-6 text-center">
          <p className="text-sm text-text-secondary">No ESG data available</p>
        </Card>
      )
    }
    const rating = esgRating(esgResponse.score)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={ESG_RATING_BADGE[rating]}>{ESG_RATING_LABEL[rating]}</Badge>
          <span className={cn('text-xl font-bold', esgColor(esgResponse.score))}>
            {esgResponse.score}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Environmental', value: esgResponse.environmental },
            { label: 'Social', value: esgResponse.social },
            { label: 'Governance', value: esgResponse.governance },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold', esgColor(value))}>{value}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-muted">Submitted {formatDate(esgResponse.submittedAt)}</p>
      </div>
    )
  }

  function renderSpendTab() {
    const supplierSpend = filterSpendRecords(spendRecords, suppliers, { supplierId: supplier.id })
    const total = supplierSpend.reduce((sum, r) => sum + r.amount, 0)
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">
            Total Spend: {formatCurrency(total)}
          </p>
          {canManageSpend && (
            <Button variant="ghost" onClick={openAddSpend}>
              Add Spend Record
            </Button>
          )}
        </div>
        <DataTable
          columns={spendColumns}
          data={supplierSpend}
          rowKey={(row) => row.id}
          emptyMessage="No spend records for this supplier"
        />
        <SpendModal
          isOpen={spendModalOpen}
          onClose={() => setSpendModalOpen(false)}
          record={editingSpend}
          onSubmit={handleSpendSubmit}
          defaultSupplierId={supplier.id}
        />
      </div>
    )
  }

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
          {canManage('suppliers') && (
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Edit
            </Button>
          )}
          {canManage('suppliers') && (
            <Button
              variant={isActive ? 'danger' : 'primary'}
              onClick={() => setSupplierStatus(supplier.id, isActive ? 'suspended' : 'active')}
            >
              {isActive ? 'Suspend' : 'Activate'}
            </Button>
          )}
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
              <p className={cn('mt-1 text-2xl font-bold', riskColor(supplier.riskScore))}>
                {supplier.riskScore}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">ESG Score</p>
              <p className="mt-1 text-2xl font-bold text-accent-blue">{supplier.esgScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Onboarded</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {formatDate(supplier.onboardedAt)}
              </p>
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
              {supplier.website && (
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
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">About</h3>
            <p className="text-sm text-text-secondary">{supplier.description}</p>
          </Card>
        </div>
      ) : activeTab === 'Contracts' ? (
        renderContractsTab()
      ) : activeTab === 'Risk' ? (
        renderRiskTab()
      ) : activeTab === 'ESG' ? (
        renderEsgTab()
      ) : (
        renderSpendTab()
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
