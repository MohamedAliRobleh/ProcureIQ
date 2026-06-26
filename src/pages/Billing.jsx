import { useState } from 'react'
import { Lock } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { useOrganization } from '../lib/auth'
import { api } from '../lib/apiClient'
import { BILLING_PLANS, CURRENT_PLAN } from '../lib/billingPlans'

export default function Billing() {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const [busyPlan, setBusyPlan] = useState(null)
  const [error, setError] = useState(null)

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Billing" />
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Lock size={28} className="text-text-secondary" />
          <p className="font-display text-lg font-semibold text-text-primary">Admin access required</p>
          <p className="max-w-md text-sm text-text-secondary">
            You need to be an organization admin to manage billing.
          </p>
        </Card>
      </div>
    )
  }

  async function handleUpgrade(plan) {
    setError(null)
    setBusyPlan(plan)
    try {
      const { url } = await api.post('/api/billing/checkout', { plan })
      window.location.assign(url)
    } catch {
      setError("Billing isn't set up yet.")
      setBusyPlan(null)
    }
  }

  return (
    <div>
      <PageHeader title="Billing" description="Manage your organization's plan" />
      {error && <p className="mb-4 text-sm text-accent-red">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {BILLING_PLANS.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-text-primary">{p.name}</h3>
              {p.id === CURRENT_PLAN && <Badge variant="green">Current plan</Badge>}
            </div>
            <p className="text-2xl font-bold text-text-primary">{p.price}</p>
            <ul className="flex-1 space-y-1 text-sm text-text-secondary">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {p.id !== CURRENT_PLAN && (
              <Button variant="primary" onClick={() => handleUpgrade(p.id)} disabled={busyPlan === p.id}>
                {busyPlan === p.id ? 'Redirecting…' : 'Upgrade'}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
