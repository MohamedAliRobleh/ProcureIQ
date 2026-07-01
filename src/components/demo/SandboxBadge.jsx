import { FlaskConical } from 'lucide-react'
import { useIsDemoOrg } from '../../lib/auth'
import { resetSandbox } from '../../lib/sandbox'

export default function SandboxBadge() {
  const isDemo = useIsDemoOrg()
  if (!isDemo) return null

  function handleReset() {
    resetSandbox()
    window.location.reload()
  }

  return (
    <div
      data-tour="sandbox-badge"
      className="flex items-center gap-2 rounded-full border border-border-accent bg-bg-secondary px-3 py-1.5 text-xs"
    >
      <FlaskConical size={14} className="text-accent-blue-light" />
      <span className="text-text-secondary">Sandbox — changes are local</span>
      <button
        onClick={handleReset}
        className="rounded-md px-2 py-0.5 font-medium text-accent-blue-light hover:bg-bg-hover"
      >
        Reset
      </button>
    </div>
  )
}
