import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Card from '../components/ui/Card'
import { NAV_ITEMS } from '../utils/constants'

const MODULE_DESCRIPTIONS = {
  Dashboard: 'KPIs, charts, and recent activity at a glance.',
  Suppliers: 'Onboard, search, and manage your supplier base.',
  Contracts: 'Track values, renewals, and expirations.',
  Risk: 'Monitor financial, compliance, and geopolitical risk.',
  ESG: 'Score supplier sustainability performance.',
  Spend: 'Analyze spend by month, category, and supplier.',
}

const FEATURED_MODULES = NAV_ITEMS.filter((item) => MODULE_DESCRIPTIONS[item.label])

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <main className="mx-auto max-w-5xl px-6">
        <section className="flex flex-col items-center gap-6 py-24 text-center">
          <h1 className="font-display text-5xl font-bold">ProcureIQ</h1>
          <p className="text-lg text-accent-blue-light">AI-powered procurement intelligence</p>
          <p className="max-w-2xl text-sm text-text-secondary">
            One workspace for your entire supplier lifecycle — onboarding, contracts, risk, ESG, and spend —
            with an AI assistant that answers questions about your data.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-blue px-6 py-3 text-sm font-medium text-white shadow-lg transition-all duration-150 hover:scale-[1.02]"
          >
            Open App
            <ArrowRight size={16} />
          </Link>

          <div className="mt-4 w-full max-w-sm rounded-xl border border-border-accent bg-bg-card p-5 text-left shadow-lg">
            <p className="text-sm font-semibold text-text-primary">🔑 Try the live demo — no signup</p>
            <p className="mt-1 text-xs text-text-secondary">
              Read-only account, pre-loaded with sample data. Free demo — no credit card.
            </p>
            <div className="mt-3 space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-primary px-3 py-2">
                <span className="text-text-muted">Email</span>
                <span className="text-text-primary">demo@procureiq.app</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-primary px-3 py-2">
                <span className="text-text-muted">Password</span>
                <span className="text-text-primary">ProcureIQ-demo</span>
              </div>
            </div>
            <Link
              to="/sign-in"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-blue-light hover:underline"
            >
              Sign in to the demo
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_MODULES.map(({ label, icon: Icon }) => (
            <Card key={label} className="p-5">
              <Icon size={20} className="text-accent-blue-light" />
              <h3 className="mt-3 font-display text-sm font-semibold">{label}</h3>
              <p className="mt-1 text-xs text-text-secondary">{MODULE_DESCRIPTIONS[label]}</p>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-text-muted">
        ProcureIQ — demo build
      </footer>
    </div>
  )
}
