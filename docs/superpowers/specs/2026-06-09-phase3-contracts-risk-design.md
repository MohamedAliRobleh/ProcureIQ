# ProcureIQ Phase 3: Contracts + Risk Modules — Design Spec

## Context

Phase 2 delivered the Suppliers module (list, detail, full CRUD, SupplierContext). Phase 3 builds the next two modules: Contracts and Risk.

**Phase decomposition reminder:**
1. Foundation ✅ — scaffold, design system, AppShell, Dashboard
2. Suppliers module ✅ — list, detail, CRUD, SupplierContext
3. **Contracts + Risk modules** (this spec)
4. ESG + Spend modules
5. AI Assistant + Landing Page
6. Real integrations (Clerk, Neon/Prisma, Anthropic, Cloudinary, EmailJS)
7. Admin Panel + Supplier Portal

All data mutations in Phase 3 are in-memory (React context + useState). Phase 6 replaces context internals with real API calls — all consumers stay untouched.

## Goal

Build two fully functional modules:
- `/contracts` — sortable/filterable contracts list, contract detail slide-over, full CRUD modal
- `/risk` — risk monitoring dashboard with level summary cards and high/critical alert table
- Fill in the Contracts and Risk tabs on the SupplierDetail page

## Architecture

### State management: ContractContext

`src/context/ContractContext.jsx` holds the contract list in `useState`, seeded from `mockData.contracts` on mount. Follows the exact same pattern as `SupplierContext`.

```js
{
  contracts: Contract[],
  addContract: (data) => void,
  updateContract: (id, data) => void,
  setContractStatus: (id, status) => void,
}
```

`ContractProvider` wraps the app in `App.jsx` alongside `SupplierProvider`. No structural change to routing or AppShell.

### Risk: read-only

Risk has no context. The `/risk` page and SupplierDetail Risk tab read from `mockData.riskAssessments` directly via the existing `useRisk` hook (for `/risk` page) and a direct import (for SupplierDetail tab — same isolation pattern as Dashboard reading `mockData.suppliers`). Phase 6 replaces hook internals with real API calls.

### Selectors

**`src/utils/contractSelectors.js`** — pure functions:
- `filterContracts(contracts, { search, status, supplierId })` — search matches title case-insensitively; exact status and supplierId match
- `sortContracts(contracts, { key, direction })` — sorts by any contract field, immutable

**`src/utils/riskSelectors.js`** — pure functions:
- `filterRiskAssessments(assessments, suppliers, { search, level })` — joins assessments with suppliers on `supplierId` for name search; exact level match
- `sortRiskAssessments(assessments, { key, direction })` — sorts by any assessment field, immutable

## New Files

| File | Purpose |
|------|---------|
| `src/context/ContractContext.jsx` | In-memory contract state + CRUD operations |
| `src/utils/contractSelectors.js` | Pure filter/sort functions for contracts |
| `src/utils/riskSelectors.js` | Pure filter/sort functions for risk assessments |
| `src/components/ui/ContractModal.jsx` | Add/edit contract modal (wraps existing `Modal`) |
| `src/components/ui/ContractSlideOver.jsx` | Right-side detail drawer (Framer Motion) |
| `src/pages/Contracts.jsx` | `/contracts` list page |
| `src/pages/Risk.jsx` | `/risk` dashboard page |

## Modified Files

| File | Change |
|------|--------|
| `src/App.jsx` | Add `ContractProvider`; replace `/contracts` and `/risk` placeholder routes |
| `src/pages/SupplierDetail.jsx` | Fill Contracts tab (supplier's contracts mini-table) and Risk tab (4 sub-score cards) |

## Components

### ContractContext

```js
// addContract generates:
{
  id: `con_${Date.now()}`,
  orgId: 'org_demo',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...data,
}
```

`updateContract(id, data)` merges fields. `setContractStatus(id, status)` sets status only.

### ContractModal

Controlled by `isOpen` + `onClose` + `contract` (null = add mode, object = edit mode).

**Fields:** Title (required), Supplier (select from context suppliers, required), Value (number, required), Currency (text, default `USD`), Start Date (date), End Date (date), Status (select: active / draft / expired), Auto-renew (checkbox), Terms (textarea).

**Validation:** title, supplierId, and value must be non-empty. Inline error below the field.

**Submit:** calls `addContract` or `updateContract`, then `onClose`. Button label: "Add Contract" (add) or "Save Changes" (edit).

**Label/id pairs** use `cm-{key}` prefix (e.g., `htmlFor="cm-title"`, `id="cm-title"`).

### ContractSlideOver

Right-side drawer, fixed position, ~420px wide. Dark overlay behind.

**Framer Motion animation:** overlay fades in (`opacity: 0 → 1`), panel slides from right (`x: 420 → 0`). Reverse on close.

**Content:**
- Header: contract title + close `✕` button
- Status Badge + supplier name (Link to `/suppliers/:id`)
- Value formatted with `formatCurrency`, Currency label
- Start Date / End Date (formatted with `formatDate`)
- Auto-renew chip (shown only if `autoRenew === true`)
- Terms paragraph
- Footer: Edit button (opens `ContractModal` in edit mode)

**Close triggers:** clicking the `✕` button, clicking the overlay, pressing `Escape`.

**Props:** `isOpen`, `onClose`, `contract` (object or null), `onEdit` (callback).

## Pages

### `/contracts` — Contracts list

- `PageHeader` title "Contracts", description "Manage your supplier contracts", actions slot: `+ Add Contract` button
- 4 stat cards:
  - **Total Value** — sum of active contract values, formatted as `$X.XM` / `$XXXk`
  - **Active** — count of active contracts (green)
  - **Expiring <30d** — count of active contracts expiring within 30 days (amber)
  - **Expired** — count of expired contracts (red)
- Filter bar: text search input (placeholder "Search contracts..."), Status `<select>` (All / Active / Draft / Expired), Supplier `<select>` (All + supplier names)
- `DataTable` columns:
  - **Contract** — title as a clickable span that opens `ContractSlideOver`
  - **Supplier** — supplier name as `Link` to `/suppliers/:id`
  - **Value** — `formatCurrency(contract.value, contract.currency)`
  - **Status** — `Badge` (active→green, draft→amber, expired→red)
  - **Expires** — days until `endDate` via `daysUntil`; amber if 0–30, red if negative, plain if >30
  - **Actions** — Edit ghost `Button`, opens `ContractModal` in edit mode
- `rowKey={(row) => row.id}`, `emptyMessage="No contracts match your filters"`

### `/risk` — Risk dashboard

- `PageHeader` title "Risk", description "Supplier risk monitoring"
- 4 summary cards with colored left border accent:
  - **Low** — count of `level === 'low'` assessments (green, `border-accent-green`)
  - **Medium** — count of `level === 'medium'` assessments (amber, `border-accent-amber`)
  - **High** — count of `level === 'high'` assessments (red, `border-accent-red`)
  - **Critical** — count of `level === 'critical'` assessments (purple, `border-accent-purple`)
- Section heading "Supplier Risk Assessments"
- Filter bar: search input (matches supplier name), Level `<select>` (All / Low / Medium / High / Critical)
- `DataTable` columns:
  - **Supplier** — supplier name as `Link` to `/suppliers/:id`
  - **Level** — `Badge` (low→green, medium→amber, high→red, critical→purple)
  - **Score** — composite score, color-coded with `riskColor` (≤33 green, ≤66 amber, >66 red)
  - **Financial** — plain number
  - **Compliance** — plain number
  - **Operational** — plain number
  - **Geopolitical** — plain number
- Default filter: All levels shown (Level select defaults to "All")
- `rowKey={(row) => row.id}`, `emptyMessage="No suppliers match your filters"`

The table data joins `riskAssessments` with `suppliers` to resolve supplier names. Each row contains both the assessment fields and the resolved supplier object.

### SupplierDetail — Contracts tab

Reads contracts from `ContractContext`, filters by `supplierId === supplier.id`.

- Small "Add Contract" button (ghost, top-right of tab content area), pre-fills supplier in modal
- `DataTable` columns: **Contract** (title, opens `ContractSlideOver`), **Value** (`formatCurrency`), **Status** (Badge), **Expires** (days until, same color logic as Contracts page)
- Empty state: "No contracts for this supplier"

### SupplierDetail — Risk tab

Reads `riskAssessments` from `mockData` directly, finds by `supplierId === supplier.id`.

- If no assessment: plain card "No risk assessment available"
- If found:
  - Overall risk level `Badge` + composite score (color-coded), at the top
  - 4 sub-score cards in a 2×2 grid: **Financial Risk**, **Compliance Risk**, **Operational Risk**, **Geopolitical Risk** — each displays the score as a large number, color-coded with `riskColor`
  - Below grid: small text "Assessed {formatDate(assessedAt)} by {assessedBy}"

## Data Flow

```
mockData.contracts (seed)
        │
        ▼
ContractContext (useState — mutable in-memory store)
        │
        ├──▶ Contracts.jsx (list + filter/sort via contractSelectors)
        │         ├──▶ ContractSlideOver (detail)
        │         └──▶ ContractModal (add/edit)
        │
        └──▶ SupplierDetail.jsx — Contracts tab
                  ├──▶ ContractSlideOver (detail)
                  └──▶ ContractModal (add, pre-filled supplierId)

mockData.riskAssessments (read-only)
        │
        ├──▶ useRisk() hook ──▶ Risk.jsx (dashboard)
        │
        └──▶ direct import ──▶ SupplierDetail.jsx — Risk tab
```

## Error Handling & Loading States

- `ContractContext` provides data synchronously — no loading state on Contracts pages.
- `Risk.jsx` uses `useRisk()` which has a 150ms simulated delay — passes `isLoading` through to `DataTable` spinner.
- `ContractSlideOver` with a null contract renders nothing (guarded at call site).
- Unknown supplier in `ContractModal` supplier select: supplier list comes from `useSupplierContext()`, always populated.

## Routing

`App.jsx` additions:
```jsx
<Route path="/contracts" element={<Contracts />} />
<Route path="/risk" element={<Risk />} />
```

The existing placeholder routes for `/contracts` and `/risk` are replaced. `ContractProvider` wraps the app alongside `SupplierProvider`.

## Shared Utilities

- `formatCurrency(value, currency)` — new formatter: `$600,000` for values < 1M, `$1.2M` for millions. Add to `src/utils/formatters.js`.
- `riskColor(score)` — currently duplicated in `Suppliers.jsx` and `SupplierDetail.jsx`. Extract to `src/utils/formatters.js` as a named export. Update both callers.
- `riskLevelBadge` color map (low→green, medium→amber, high→red, critical→purple) — defined once in `riskSelectors.js` as an exported constant `RISK_LEVEL_BADGE`.

## Testing

- **`ContractContext.test.jsx`** — seeds check, `addContract`, `updateContract`, `setContractStatus`, throws outside provider (mirrors `SupplierContext.test.jsx` pattern)
- **`contractSelectors.test.js`** — `filterContracts` (no filters, title search, status, supplierId, combined, empty), `sortContracts` (asc/desc, no mutation)
- **`riskSelectors.test.js`** — `filterRiskAssessments` (no filters, name search, level, combined, empty), `sortRiskAssessments` (score asc/desc)
- **`ContractModal.test.jsx`** — closed renders nothing, add mode empty fields, edit mode pre-filled, validation blocks submit, valid submit calls context + onClose, edit mode "Save Changes" button
- **`ContractSlideOver.test.jsx`** — closed renders nothing, open renders contract details, Edit button calls onEdit, Escape key closes, overlay click closes
- **`Contracts.test.jsx`** — renders list with mock data, search filter narrows results, stat cards show correct counts, clicking contract title opens slide-over
- **`Risk.test.jsx`** — renders 4 summary cards with correct counts, table shows only high/critical by default, search filter narrows results
- **`SupplierDetail.test.jsx`** additions — Contracts tab shows supplier's contracts, Risk tab shows 4 sub-score cards

## Out of Scope (deferred)

- AI summary on contracts (`aiSummary` field exists in mockData, filled in Phase 5)
- Contract file upload / PDF viewer (Phase 6 — Cloudinary)
- Risk assessment creation / manual override (Phase 6)
- Geopolitical risk map visualization (Phase 5)
- Contract renewal workflow / notifications (Phase 6)
- Pagination (20 contracts render fine without it)
