# ProcureIQ Phase 1: Foundation — Design Spec

## Context

ProcureIQ is a multi-tenant SaaS platform for AI-powered Supplier Lifecycle
Management (full product spec provided by user — see prompt history). The
full build is too large for a single implementation cycle, so it's split into
phases:

1. **Foundation** (this spec) — scaffold, design system, AppShell, Dashboard
2. Suppliers module
3. Contracts + Risk modules (incl. AI summary/scoring, mocked initially)
4. ESG + Spend modules
5. AI Assistant + Landing Page
6. Real integrations (Clerk, Neon/Prisma, Anthropic, Cloudinary, EmailJS) —
   replaces the mock layer built in earlier phases
7. Admin Panel + Supplier Portal

User has chosen to build UI-first against seeded mock data, deferring all
external service credentials (Clerk, Neon, Anthropic, Cloudinary, EmailJS)
to Phase 6.

## Goal

Stand up the application shell, design system, and Dashboard page, all
running against local seeded mock data — establishing the visual language
and structural patterns every later phase builds on.

## Architecture

**Mock data layer as a Prisma/Clerk stand-in.** Hooks (`useSuppliers`,
`useContracts`, `useRisk`, `useSpend`) and an auth context
(`useUser`/`useOrganization`) expose the *same shapes* the real
Prisma-backed API and Clerk SDK will return later. Internally, in this
phase, they read from seeded in-memory/JSON mock data instead of calling
`/api/*` or Clerk. When Phase 6 wires up real services, only the internals
of these hooks change — components, pages, and the auth context's consumer
API stay untouched.

This keeps the phase fully functional and demoable without any external
accounts, while avoiding throwaway work.

**Stack for this phase:** Vite + React 18 + Tailwind CSS v3 + Framer Motion +
Recharts + React Router v6 + lucide-react + clsx + tailwind-merge.
Clerk, Prisma, the Anthropic SDK, Cloudinary, and EmailJS are *not* installed
yet — there's nothing to configure them against until Phase 6.

## Components

### Design tokens
- Tailwind config extended with the dark palette CSS variables (`--bg-primary`,
  `--accent-blue`, etc. — see product spec for full list)
- `index.css`: `@import` for DM Sans, IBM Plex Sans, IBM Plex Mono (Google Fonts)
- Gradient utilities for `--gradient-blue` / `--gradient-green`

### `src/components/ui/`
Button, Card, Badge, DataTable, Modal, StatCard, AIInsightBox, LoadingSpinner —
generic, reusable, styled per the product spec's component style guide
(dark cards with subtle borders/shadows, gradient primary buttons, pill badges,
striped hover tables, blur-backdrop modals with slide-in animation).

### `src/components/layout/`
- `AppShell.jsx` — wraps Sidebar + TopBar + page content area
- `Sidebar.jsx` — fixed left nav with icon+label items for all 10 modules
  (Dashboard, Suppliers, Contracts, Risk, ESG, Spend, AI Assistant, Portal,
  Admin) using lucide-react icons; highlights active route
- `TopBar.jsx` — header with org name, user menu (mock user/org from the
  stub auth context)
- `PageHeader.jsx` — reusable title + breadcrumb + action-button slot

### Mock data module (`src/lib/mockData.js` + `src/lib/mockAuth.jsx`)
Seeded, schema-shaped data: 20 suppliers across 10 countries, 15 contracts,
risk assessments, ESG scores, 6 months of spend records, and a recent-activity
feed — generated once as static arrays (not randomized per load, so the UI is
stable across refreshes). `mockAuth.jsx` provides a context + hooks
(`useUser`, `useOrganization`) returning a single mock org/admin user, mirroring
Clerk's returned shapes closely enough that swapping the provider later doesn't
change consumer code.

### `src/pages/Dashboard.jsx`
- Stat cards row: Total Suppliers, Active Contracts, Avg Risk Score, Total
  Spend YTD
- Risk distribution donut chart (Recharts, derived from mock risk assessments)
- Spend by category bar chart (Recharts, derived from mock spend records)
- Recent activity feed (from mock activity data)
- Expiring contracts widget (next 30/60/90 days, computed from mock contract
  end dates relative to today)
- Top suppliers by spend table (DataTable, derived from mock spend records)
- AI Insight of the Day — `AIInsightBox` rendering a static, realistic
  procurement insight string (clearly a placeholder for the real Claude-backed
  version landing in Phase 6, but written as production-quality copy, not a
  "TODO")

## Data Flow

```
mockData.js / mockAuth.jsx  (seeded, schema-shaped)
        │
        ▼
hooks (useSuppliers, useContracts, useRisk, useSpend, useUser, useOrganization)
        │
        ▼
pages (Dashboard) ──consume──▶ ui components (StatCard, DataTable, AIInsightBox, charts)
        │
        ▼
AppShell (Sidebar, TopBar, PageHeader) — structural wrapper for all routes
```

Routing: React Router v6. The Sidebar links to all 10 modules so navigation
feels complete, but in this phase only `/dashboard` is a fully built route —
the other nine render a lightweight "Coming in Phase N" placeholder page
(naming the phase from the decomposition above) rather than faking
functionality.

## Error Handling & Loading States

- Mock hooks simulate async behavior (return data via a microtask/short
  timeout) so loading states (`LoadingSpinner`) are exercised and visible,
  matching how the real API-backed hooks will behave
- Empty states are not applicable to seeded data (always populated), but
  `DataTable` and chart components include an empty-state branch for when
  `data.length === 0`, since later phases (e.g. a brand-new org with zero
  suppliers) will need it
- A top-level error boundary wraps `AppShell` with a user-friendly fallback

## Testing

- Component-level smoke checks: each `ui/` component renders with representative
  props (including empty/loading/error variants where applicable)
- Dashboard: verify stat cards compute correct aggregates from mock data,
  charts render with mock data, expiring-contracts widget correctly buckets
  contracts by days-to-expiry relative to the current date
- Manual verification: run dev server, navigate the Sidebar, confirm responsive
  layout at mobile/tablet/desktop breakpoints, confirm dark theme matches the
  palette

## Out of Scope (deferred to later phases)

- Clerk auth, Neon/Prisma database, Anthropic/Cloudinary/EmailJS integrations
  (Phase 6)
- All non-Dashboard module pages' real functionality (Phases 2–5, 7)
- Landing page (Phase 5)
