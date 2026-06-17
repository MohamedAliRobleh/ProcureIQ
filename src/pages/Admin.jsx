import { useState } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useOrganization, OrganizationProfile } from '../lib/auth'
import { api } from '../lib/apiClient'

export default function Admin() {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const [dialog, setDialog] = useState(null) // 'reset' | 'clear' | null
  const [busy, setBusy] = useState(false)

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Admin" />
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Lock size={28} className="text-text-secondary" />
          <p className="font-display text-lg font-semibold text-text-primary">Admin access required</p>
          <p className="max-w-md text-sm text-text-secondary">
            You need to be an organization admin to view this page. Ask an admin of your organization for access.
          </p>
        </Card>
      </div>
    )
  }

  async function runAction(path) {
    setBusy(true)
    try {
      await api.post(path, {})
      window.location.reload()
    } catch {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <div>
      <PageHeader title="Admin" description="Manage your organization, members, and data." />

      <Card className="p-2">
        <OrganizationProfile routing="path" path="/admin" />
      </Card>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-accent-red" />
          <h3 className="font-display text-sm font-semibold text-text-primary">Danger zone</h3>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Reload demo data</p>
              <p className="text-sm text-text-secondary">Wipe this organization and re-seed the sample dataset.</p>
            </div>
            <Button variant="secondary" onClick={() => setDialog('reset')}>Reload demo data</Button>
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Clear all data</p>
              <p className="text-sm text-text-secondary">
                Permanently delete every supplier, contract, risk, ESG and spend record.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDialog('clear')}>Clear all data</Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={dialog === 'reset'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('/api/org/reset')}
        title="Reload demo data?"
        description="This deletes all current data in this organization and replaces it with a fresh sample dataset. This cannot be undone."
        confirmWord="reset"
        confirmLabel="Reload sample data"
        busy={busy}
      />
      <ConfirmDialog
        isOpen={dialog === 'clear'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('/api/org/clear')}
        title="Clear all data?"
        description="This permanently deletes all suppliers, contracts, risk, ESG and spend records in this organization. This cannot be undone."
        confirmWord="clear"
        confirmLabel="Delete everything"
        busy={busy}
      />
    </div>
  )
}
