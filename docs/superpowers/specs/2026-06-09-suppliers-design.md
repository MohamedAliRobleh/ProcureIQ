# ProcureIQ Phase 2: Suppliers Module — Design Spec

## Context

Phase 1 delivered the app shell, dark-theme design system, mock data layer, and Dashboard page. Phase 2 builds the first fully functional module: the Suppliers list and detail pages, with full CRUD (add, edit, status change — no hard delete).

**Phase decomposition reminder:**
1. Foundation ✅ — scaffold, design system, AppShell, Dashboard
2. **Suppliers module** (this spec)
3. Contracts + Risk modules
4. ESG + Spend modules
5. AI Assistant + Landing Page
6. Real integrations (Clerk, Neon/Prisma, Anthropic, Cloudinary, EmailJS)
7. Admin Panel + Supplier Portal

All data mutations in Phase 2 are in-memory (React context + useState). Phase 6 replaces context internals with real API calls — all consumers stay untouched.

## Goal

Replace the `/suppliers` placeholder with a fully functional Suppliers module: a sortable/filterable table list, a tabbed detail page, and a modal for adding and editing suppliers.

## Architecture

### State management: SupplierContext

A new `src/context/SupplierContext.jsx` holds the supplier list in `useState`, seeded from `mockData.suppliers` on mount. It exposes:

```js
{
  suppliers: Supplier[],
  addSupplier: (data) => void,
  updateSupplier: (id, data) => void,
  setSupplierStatus: (id, status) => void,
}
```

`MockAuthProvider` already wraps the app in `App.jsx`. `SupplierProvider` is added alongside it — no structural change needed to routing or AppShell.

`useSuppliers` hook is **not changed**. The Dashboard continues to read from `mockData.suppliers` directly (seeded, stable reference). Only the Suppliers module reads from `SupplierContext` — this avoids re-seeding side effects on the Dashboard.

### Selectors: supplierSelectors.js

Pure functions in `src/utils/supplierSelectors.js`:

- `filterSuppliers(suppliers, { search, category, status })` — returns filtered array; search matches name case-insensitively
- `sortSuppliers(suppliers, { key, direction })` — sorts by any supplier field; direction is `'asc'` | `'desc'`

### Pre-Phase-2 fix (from Phase 1 final review)

Before adding new features, patch the three issues flagged:

1. **Hook error state** — add `error: null` field to `useSuppliers`, `useContracts`, `useRisk`, `useSpend` (set on catch in the setTimeout simulation — currently unreachable but needed before Phase 3 adds real failure paths)
2. **daysUntil consolidation** — move the `daysUntil(date, referenceDate?)` helper into `src/utils/formatters.js`; update `dashboardSelectors.js` to import it from there instead of inlining a local copy
3. **DataTable rowKey** — add optional `rowKey` prop to `DataTable`; default falls back to `row.id ?? index` (existing behaviour preserved, explicit override now possible)

## Components

### New files

| File | Purpose |
|------|---------|
| `src/context/SupplierContext.jsx` | In-memory supplier state + CRUD operations |
| `src/utils/supplierSelectors.js` | Pure filter/sort functions |
| `src/components/ui/SupplierModal.jsx` | Add/edit supplier modal (wraps existing `Modal`) |
| `src/pages/Suppliers.jsx` | `/suppliers` list page |
| `src/pages/SupplierDetail.jsx` | `/suppliers/:id` detail page |

### Modified files

| File | Change |
|------|--------|
| `src/hooks/useSuppliers.js` + 3 others | Add `error` field |
| `src/utils/formatters.js` | Add exported `daysUntil(date, referenceDate?)` |
| `src/utils/dashboardSelectors.js` | Import `daysUntil` from formatters |
| `src/components/ui/DataTable.jsx` | Add optional `rowKey` prop |
| `src/App.jsx` | Add `SupplierProvider`; replace `/suppliers` placeholder route with `Suppliers`; add `/suppliers/:id` route |

## Pages

### `/suppliers` — Suppliers list

- `PageHeader` title "Suppliers", description "Manage your supplier portfolio", actions slot: `+ Add Supplier` button
- Filter bar: text search input, Category `<select>` (options: All, Raw Materials, Manufacturing, IT Services, Logistics, Packaging, Professional Services, Energy, Components), Status `<select>` (All / Active / Pending / Suspended)
- `DataTable` with columns:
  - **Supplier** — name as a `<Link>` to `/suppliers/:id`
  - **Category** — plain text
  - **Country** — plain text
  - **Risk Score** — number, colour-coded: ≤33 green, ≤66 amber, >66 red (using `text-accent-green` / `text-accent-amber` / `text-accent-red`)
  - **Status** — `Badge` component (green=active, amber=pending, red=suspended)
  - **Actions** — Edit `Button` variant ghost, opens `SupplierModal` in edit mode
- `isLoading` passes through to `DataTable` spinner; empty state: "No suppliers match your filters"
- Clicking a supplier name navigates to `/suppliers/:id`

### `/suppliers/:id` — Supplier detail

- Reads supplier by `id` param from `SupplierContext`. If not found: renders `PageHeader` with "Supplier not found" and a `← Back to Suppliers` link to `/suppliers`.
- **Header section:**
  - Supplier name (h1), status `Badge`, category + country subtitle
  - Action buttons: `Edit` (opens `SupplierModal`), `Suspend` / `Activate` (calls `setSupplierStatus`, label toggles based on current status)
- **Tabs:** Overview · Contracts · Risk · ESG · Spend
  - Active tab highlighted with `border-accent-blue` bottom border
  - Contracts tab → `PlaceholderPage`-style card: "Coming in Phase 3"
  - Risk tab → "Coming in Phase 3"
  - ESG tab → "Coming in Phase 4"
  - Spend tab → "Coming in Phase 4"
- **Overview tab content:**
  - Stats row: Risk Score (colour-coded), ESG Score (blue), Onboarded date (`formatDate`)
  - Contact card: email, phone, website (as external link to `supplier.website`)
  - About card: supplier description

### SupplierModal

Controlled by `isOpen` + `onClose` + `supplier` (null = add mode, object = edit mode).

**Fields:** Name (required), Email (required), Phone, Country, Category (select), Status (select: active/pending/suspended), Website, Description (textarea).

**Validation:** client-side only — name and email must be non-empty. Error shown inline below the field.

**Submit:** calls `addSupplier` or `updateSupplier` on context, then calls `onClose`.

## Data Flow

```
mockData.suppliers (seed)
        │
        ▼
SupplierContext (useState — mutable in-memory store)
        │
        ├──▶ Suppliers.jsx (list + filter/sort via supplierSelectors)
        │         └──▶ SupplierModal (add/edit)
        │
        └──▶ SupplierDetail.jsx (find by id)
                  └──▶ SupplierModal (edit) + status toggle
```

The Dashboard's `useSuppliers` hook reads directly from `mockData.suppliers` (immutable seed) — it is unaffected by mutations in `SupplierContext`.

## Error Handling & Loading States

- `SupplierContext` provides data synchronously (seeded from import) — no loading state needed on the Suppliers pages.
- `/suppliers/:id` with an unknown `id` renders a graceful "not found" message, not a crash.
- `SupplierModal` shows inline field-level validation errors; no async errors in Phase 2.

## Routing

`App.jsx` additions:
```jsx
<Route path="/suppliers" element={<Suppliers />} />
<Route path="/suppliers/:id" element={<SupplierDetail />} />
```

The existing `/suppliers` placeholder route is replaced.

## Testing

- **`supplierSelectors.test.js`** — unit tests for `filterSuppliers` and `sortSuppliers`: filter by search, category, status, combined filters, empty results, sort asc/desc
- **`SupplierContext.test.jsx`** — tests for `addSupplier` (new supplier appears in list), `updateSupplier` (fields update), `setSupplierStatus` (status toggles)
- **`SupplierModal.test.jsx`** — renders in add mode (empty fields), edit mode (pre-filled fields), validation (submit blocked when name/email empty), submit calls context
- **`Suppliers.test.jsx`** — renders list with mock data, search filter narrows results, loading state shows spinner
- **`SupplierDetail.test.jsx`** — renders overview tab with correct supplier data, Edit button opens modal, Suspend/Activate toggles status, unknown id shows not-found message

## Out of Scope (deferred)

- Real API calls / Prisma integration (Phase 6)
- Supplier documents / file upload (Phase 6 — Cloudinary)
- Contracts / Risk / ESG / Spend tab content (Phases 3-4)
- Supplier logo upload (Phase 6)
- Bulk actions (select multiple suppliers, bulk status change)
- Pagination (20 seeded suppliers render fine without it)
