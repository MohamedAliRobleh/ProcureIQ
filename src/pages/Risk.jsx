import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { useRisk } from '../hooks/useRisk'
import { suppliers } from '../lib/mockData'
import { filterRiskAssessments, sortRiskAssessments, RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { riskColor } from '../utils/formatters'
import { cn } from '../utils/cn'

export default function Risk() {
  const { riskAssessments, isLoading } = useRisk()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')

  const allAssessments = riskAssessments ?? []

  const lowCount = allAssessments.filter((a) => a.level === 'low').length
  const mediumCount = allAssessments.filter((a) => a.level === 'medium').length
  const highCount = allAssessments.filter((a) => a.level === 'high').length
  const criticalCount = allAssessments.filter((a) => a.level === 'critical').length

  const filtered = sortRiskAssessments(
    filterRiskAssessments(allAssessments, suppliers, { search, level }),
    { key: 'score', direction: 'desc' }
  )

  const rows = filtered
    .map((a) => ({ ...a, supplier: suppliers.find((s) => s.id === a.supplierId) }))
    .filter((r) => r.supplier)

  const columns = [
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (
        <Link
          to={`/suppliers/${row.supplier.id}`}
          className="font-medium text-accent-blue-light hover:underline"
        >
          {row.supplier.name}
        </Link>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (row) => (
        <Badge variant={RISK_LEVEL_BADGE[row.level] ?? 'muted'}>{row.level}</Badge>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) => <span className={cn('font-bold', riskColor(row.score))}>{row.score}</span>,
    },
    { key: 'financialRisk', header: 'Financial' },
    { key: 'complianceRisk', header: 'Compliance' },
    { key: 'operationalRisk', header: 'Operational' },
    { key: 'geopoliticalRisk', header: 'Geopolitical' },
  ]

  return (
    <div>
      <PageHeader title="Risk" description="Supplier risk monitoring" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-accent-green p-4">
          <p className="text-xs text-text-secondary">Low</p>
          <p className="mt-1 text-2xl font-bold text-accent-green">{lowCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-amber p-4">
          <p className="text-xs text-text-secondary">Medium</p>
          <p className="mt-1 text-2xl font-bold text-accent-amber">{mediumCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-red p-4">
          <p className="text-xs text-text-secondary">High</p>
          <p className="mt-1 text-2xl font-bold text-accent-red">{highCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-purple p-4">
          <p className="text-xs text-text-secondary">Critical</p>
          <p className="mt-1 text-2xl font-bold text-accent-purple">{criticalCount}</p>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-text-primary">Supplier Risk Assessments</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No suppliers match your filters"
      />
    </div>
  )
}
