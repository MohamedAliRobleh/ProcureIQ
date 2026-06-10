import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import SpendModal from '../components/ui/SpendModal'
import { useSpendContext } from '../context/SpendContext'
import { useSupplierContext } from '../context/SupplierContext'
import { filterSpendRecords, sortSpendRecords, getMonthlySpendTrend } from '../utils/spendSelectors'
import { getSpendByCategory } from '../utils/dashboardSelectors'
import { formatCurrency, formatCompactCurrency, formatDate } from '../utils/formatters'
import { SPEND_CATEGORIES } from '../lib/mockData'

const TOOLTIP_STYLE = { background: '#16181F', border: '1px solid #1E2130', borderRadius: 8 }
const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#60A5FA', '#34D399', '#FB923C']

export default function Spend() {
  const { spendRecords, addSpendRecord, updateSpendRecord } = useSpendContext()
  const { suppliers } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)

  const displayed = sortSpendRecords(
    filterSpendRecords(spendRecords, suppliers, { search, category, supplierId }),
    { key: 'date', direction: 'desc' }
  )

  const totalSpend = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const now = new Date()
  const thisMonthSpend = spendRecords
    .filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const spendByCategory = getSpendByCategory(spendRecords)
  const topCategory = spendByCategory.length
    ? spendByCategory.reduce((top, c) => (c.amount > top.amount ? c : top)).category
    : '—'
  const suppliersTracked = new Set(spendRecords.map((r) => r.supplierId)).size
  const monthlyTrend = getMonthlySpendTrend(spendRecords)

  function openAdd() {
    setEditingRecord(null)
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditingRecord(record)
    setModalOpen(true)
  }

  function handleSubmit(data) {
    if (editingRecord) {
      updateSpendRecord(editingRecord.id, data)
    } else {
      addSpendRecord(data)
    }
  }

  const columns = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
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
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatCurrency(row.amount, row.currency),
    },
    { key: 'invoiceRef', header: 'Invoice Ref' },
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
        title="Spend"
        description="Track and analyze procurement spend"
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusCircle size={16} />
            Add Spend Record
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Total Spend</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{formatCompactCurrency(totalSpend)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">This Month</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{formatCompactCurrency(thisMonthSpend)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Top Category</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{topCategory}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Suppliers Tracked</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{suppliersTracked}</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-text-primary">Monthly Trend</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-text-primary">Spend by Category</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={spendByCategory} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={90} paddingAngle={4}>
                  {spendByCategory.map((entry, index) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {spendByCategory.map((entry, index) => (
              <span key={entry.category} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                {entry.category}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search spend records..."
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
          {SPEND_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
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
        emptyMessage="No spend records match your filters"
      />

      <SpendModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        record={editingRecord}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
