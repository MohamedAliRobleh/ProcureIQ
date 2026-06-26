import { useState } from 'react'
import { Building2, FileText, ShieldAlert, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import PageHeader from '../components/layout/PageHeader'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import AIInsightBox from '../components/ui/AIInsightBox'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSuppliers } from '../hooks/useSuppliers'
import { useContracts } from '../hooks/useContracts'
import { useRisk } from '../hooks/useRisk'
import { useSpend } from '../hooks/useSpend'
import { api } from '../lib/apiClient'
import { usePermissions } from '../lib/permissions'
import Button from '../components/ui/Button'
import { formatCurrency, formatDate, timeAgo } from '../utils/formatters'
import {
  getAverageRiskScore,
  getRiskDistribution,
  getSpendByCategory,
  getTotalSpendYTD,
  getExpiringContracts,
  getTopSuppliersBySpend,
} from '../utils/dashboardSelectors'
import { recentActivity } from '../lib/mockData'

const RISK_COLORS = { low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#8B5CF6' }
const TOOLTIP_STYLE = { background: '#16181F', border: '1px solid #1E2130', borderRadius: 8 }

export default function Dashboard() {
  const { suppliers, isLoading: loadingSuppliers } = useSuppliers()
  const { contracts, isLoading: loadingContracts } = useContracts()
  const { riskAssessments, isLoading: loadingRisk } = useRisk()
  const { spendRecords, isLoading: loadingSpend } = useSpend()
  const { canManage } = usePermissions()

  const [seeding, setSeeding] = useState(false)

  async function handleSeed() {
    setSeeding(true)
    try {
      await api.post('/api/org/seed', {})
      window.location.reload()
    } catch {
      setSeeding(false)
    }
  }

  if (loadingSuppliers || loadingContracts || loadingRisk || loadingSpend) {
    return <LoadingSpinner className="py-24" />
  }

  if (suppliers.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Your supplier portfolio at a glance" />
        <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
          <h3 className="font-display text-lg font-semibold text-text-primary">Your organization is empty</h3>
          <p className="max-w-md text-sm text-text-secondary">
            Load a sample procurement dataset — suppliers, contracts, risk, ESG, and spend — to explore ProcureIQ with realistic data.
          </p>
          {canManage('suppliers') ? (
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Loading…' : 'Load sample data'}
            </Button>
          ) : (
            <p className="text-sm text-text-secondary">Ask an organization admin to load data.</p>
          )}
        </Card>
      </div>
    )
  }

  const activeContracts = contracts.filter((c) => c.status === 'active')
  const avgRisk = getAverageRiskScore(riskAssessments)
  const totalSpendYTD = getTotalSpendYTD(spendRecords)
  const riskDistribution = getRiskDistribution(riskAssessments)
  const spendByCategory = getSpendByCategory(spendRecords)
  const expiring = getExpiringContracts(contracts)
  const topSuppliers = getTopSuppliersBySpend(spendRecords, suppliers)
  const criticalCount = riskDistribution.find((r) => r.level === 'critical')?.count ?? 0

  return (
    <div>
      <PageHeader title="Dashboard" description="Your supplier portfolio at a glance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Suppliers" value={suppliers.length} icon={Building2} />
        <StatCard label="Active Contracts" value={activeContracts.length} icon={FileText} />
        <StatCard label="Avg Risk Score" value={avgRisk} icon={ShieldAlert} />
        <StatCard label="Total Spend YTD" value={formatCurrency(totalSpendYTD)} icon={Wallet} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-text-primary">Risk Distribution</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="count" nameKey="level" innerRadius={60} outerRadius={90} paddingAngle={4}>
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.level} fill={RISK_COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {riskDistribution.map((entry) => (
              <span key={entry.level} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[entry.level] }} />
                <span className="capitalize">{entry.level}</span> ({entry.count})
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-text-primary">Spend by Category</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" />
                <XAxis dataKey="category" tick={{ fill: '#94A3B8', fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-display text-sm font-semibold text-text-primary">Top Suppliers by Spend</h3>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: 'name', header: 'Supplier', render: (row) => row.supplier.name },
                { key: 'country', header: 'Country', render: (row) => row.supplier.country },
                { key: 'totalSpend', header: 'Total Spend', render: (row) => formatCurrency(row.totalSpend) },
              ]}
              data={topSuppliers}
              emptyMessage="No spend records yet"
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-semibold text-text-primary">Recent Activity</h3>
          <ul className="mt-4 space-y-3">
            {recentActivity.map((activity) => (
              <li key={activity.id} className="text-sm">
                <p className="text-text-primary">{activity.message}</p>
                <p className="text-xs text-text-secondary">{timeAgo(activity.timestamp)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-display text-sm font-semibold text-text-primary">Expiring Contracts</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Next 30 days', items: expiring.within30, variant: 'red' },
              { label: 'Next 60 days', items: expiring.within60, variant: 'amber' },
              { label: 'Next 90 days', items: expiring.within90, variant: 'blue' },
            ].map(({ label, items, variant }) => (
              <div key={label} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <Badge variant={variant}>{items.length}</Badge>
                </div>
                <ul className="mt-3 space-y-2">
                  {items.slice(0, 3).map((contract) => (
                    <li key={contract.id} className="text-xs text-text-secondary">
                      {contract.title} — {formatDate(contract.endDate)}
                    </li>
                  ))}
                  {items.length === 0 && <li className="text-xs text-text-muted">None</li>}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <AIInsightBox title="AI Insight of the Day">
          Your portfolio's average risk score has held steady at {avgRisk}/100 this month, but {criticalCount} supplier
          {criticalCount === 1 ? '' : 's'} now sit in the critical band. Consider prioritizing AI risk re-assessments
          for your highest-spend suppliers in that group before their contracts come up for renewal — early
          intervention typically reduces renegotiation costs by double digits.
        </AIInsightBox>
      </div>
    </div>
  )
}
