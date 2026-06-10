import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { useEsg } from '../hooks/useEsg'
import { useSupplierContext } from '../context/SupplierContext'
import { esgRating, filterEsgResponses, sortEsgResponses, ESG_RATING_BADGE } from '../utils/esgSelectors'
import { esgColor, formatDate } from '../utils/formatters'
import { cn } from '../utils/cn'

export default function ESG() {
  const { esgResponses, isLoading } = useEsg()
  const { suppliers } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState('')

  const allResponses = esgResponses ?? []

  const portfolioAverage = allResponses.length
    ? Math.round(allResponses.reduce((sum, r) => sum + r.score, 0) / allResponses.length)
    : 0
  const strongCount = allResponses.filter((r) => esgRating(r.score) === 'strong').length
  const developingCount = allResponses.filter((r) => esgRating(r.score) === 'developing').length
  const needsImprovementCount = allResponses.filter((r) => esgRating(r.score) === 'needs-improvement').length

  const filtered = sortEsgResponses(
    filterEsgResponses(allResponses, suppliers, { search, rating }),
    { key: 'score', direction: 'desc' }
  )

  const rows = filtered
    .map((r) => ({ ...r, supplier: suppliers.find((s) => s.id === r.supplierId) }))
    .filter((row) => row.supplier)

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
      key: 'rating',
      header: 'Rating',
      render: (row) => {
        const r = esgRating(row.score)
        return <Badge variant={ESG_RATING_BADGE[r]}>{r}</Badge>
      },
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) => <span className={cn('font-bold', esgColor(row.score))}>{row.score}</span>,
    },
    {
      key: 'environmental',
      header: 'Environmental',
      render: (row) => `${row.environmental}%`,
    },
    {
      key: 'social',
      header: 'Social',
      render: (row) => `${row.social}%`,
    },
    {
      key: 'governance',
      header: 'Governance',
      render: (row) => `${row.governance}%`,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (row) => formatDate(row.submittedAt),
    },
  ]

  return (
    <div>
      <PageHeader title="ESG" description="Supplier sustainability performance" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-accent-blue p-4">
          <p className="text-xs text-text-secondary">Portfolio Average</p>
          <p className="mt-1 text-2xl font-bold text-accent-blue">{portfolioAverage}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-green p-4">
          <p className="text-xs text-text-secondary">Strong</p>
          <p className="mt-1 text-2xl font-bold text-accent-green">{strongCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-amber p-4">
          <p className="text-xs text-text-secondary">Developing</p>
          <p className="mt-1 text-2xl font-bold text-accent-amber">{developingCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-red p-4">
          <p className="text-xs text-text-secondary">Needs Improvement</p>
          <p className="mt-1 text-2xl font-bold text-accent-red">{needsImprovementCount}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Ratings</option>
          <option value="strong">strong</option>
          <option value="developing">developing</option>
          <option value="needs-improvement">needs-improvement</option>
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
