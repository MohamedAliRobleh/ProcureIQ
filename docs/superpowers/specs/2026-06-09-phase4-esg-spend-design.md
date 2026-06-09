# ProcureIQ Phase 4: ESG + Spend Modules — Design Spec

## Context

Phase 3 delivered the Contracts and Risk modules (full CRUD for contracts, read-only risk dashboard). Phase 4 builds the next two modules: ESG and Spend.

**Phase decomposition reminder:**
1. Foundation ✅ — scaffold, design system, AppShell, Dashboard
2. Suppliers module ✅ — list, detail, CRUD, SupplierContext
3. Contracts + Risk modules ✅ — contract CRUD, risk dashboard
4. **ESG + Spend modules** (this spec)
5. AI Assistant + Landing Page
6. Real integrations (Clerk, Neon/Prisma, Anthropic, Cloudinary, EmailJS)
7. Admin Panel + Supplier Portal

All data mutations in Phase 4 are in-memory (React context + useState). Phase 6 replaces context internals with real API calls — all consumers stay untouched.

## Goal

Build two modules:
- `/esg` — read-only ESG monitoring dashboard with rating-band summary cards and a filterable supplier table
- `/spend` — spend analytics dashboard with trend/category charts, a filterable spend record table, and full CRUD via a new `SpendContext`
- Fill in the ESG and Spend tabs on the SupplierDetail page

## Architecture

### ESG: read-only

ESG has no context. The `/esg` page reads from `mockData.esgResponses` via a new `useEsg()` hook (mirrors `useRisk` exactly: 150ms simulated delay, `{ esgResponses, isLoading, error }`). The SupplierDetail ESG tab reads `esgResponses` directly from `mockData` (same isolation pattern as the Risk tab). Phase 5/7 add AI suggestions and supplier-submitted questionnaires — editing is out of scope here.

### Spend: SpendContext

`src/context/SpendContext.jsx` holds the spend record list in `useState`, seeded from `mockData.spendRecords`. Follows the exact same pattern as `ContractContext`.

```js
{
  spendRecords: SpendRecord[],
  addSpendRecord: (data) => void,
  updateSpendRecord: (id, data) => void,
}
```

`SpendProvider` wraps the app in `App.jsx` alongside `SupplierProvider` and `ContractProvider`. No structural change to routing or AppShell.

The existing `useSpend()` hook is rewritten to wrap `useSpendContext()` with the same 150ms simulated delay (mirrors the Phase 3 fix to `useContracts`), so the Dashboard's "Spend by Category" chart and "Top Suppliers by Spend" table reflect new records added via `SpendContext`.

### Selectors

**`src/utils/esgSelectors.js`** — pure functions and constants:
- `esgRating(score)` — `score >= 67` → `'strong'`, `score >= 34` → `'developing'`, else `'needs-improvement'`
- `ESG_RATING_BADGE` — `{ strong: 'green', developing: 'amber', 'needs-improvement': 'red' }`
- `ESG_RATING_LABEL` — `{ strong: 'Strong', developing: 'Developing', 'needs-improvement': 'Needs Improvement' }`
- `filterEsgResponses(responses, suppliers, { search, rating })` — joins responses with suppliers on `supplierId` for name search; `rating` filters by `esgRating(r.score)`
- `sortEsgResponses(responses, { key, direction })` — sorts by any response field, immutable, default `{ key: 'score', direction: 'desc' }`

**`src/utils/spendSelectors.js`** — pure functions:
- `filterSpendRecords(records, suppliers, { search, category, supplierId })` — `search` matches supplier name OR record description, case-insensitive; exact `category` and `supplierId` match
- `sortSpendRecords(records, { key, direction })` — sorts by any record field, immutable, default `{ key: 'date', direction: 'desc' }`
- `getMonthlySpendTrend(records, months = 6)` — returns `[{ month: 'Jan', total: 12345 }, ...]` for the last `months` calendar months (oldest first), summing `amount` per month/year bucket

## New Files

| File | Purpose |
|------|---------|
| `src/context/SpendContext.jsx` | In-memory spend record state + CRUD operations |
| `src/hooks/useEsg.js` | Read-only ESG hook (150ms delay, mirrors `useRisk`) |
| `src/utils/esgSelectors.js` | `esgRating`, badge/label maps, filter/sort for ESG responses |
| `src/utils/spendSelectors.js` | Filter/sort + monthly trend for spend records |
| `src/components/ui/SpendModal.jsx` | Add/edit spend record modal (wraps existing `Modal`) |
| `src/pages/ESG.jsx` | `/esg` dashboard page |
| `src/pages/Spend.jsx` | `/spend` dashboard page |

## Modified Files

| File | Change |
|------|--------|
| `src/lib/mockData.js` | Export `SPEND_CATEGORIES` (currently a private const) |
| `src/utils/formatters.js` | Add `esgColor(score)` (inverted scale vs `riskColor`, high score = good = green); add `formatDateToInput(date)`, moved here from `ContractModal` |
| `src/hooks/useSpend.js` | Rewrite to read from `SpendContext` with 150ms delay |
| `src/App.jsx` | Add `SpendProvider`; replace `/esg` and `/spend` placeholder routes |
| `src/pages/SupplierDetail.jsx` | Fill ESG tab (E/S/G sub-score cards) and Spend tab (supplier's spend mini-table + add); remove `TAB_PHASE` (no tabs remain unimplemented) |
| `src/components/ui/ContractModal.jsx` | Import `formatDateToInput` from `formatters.js` instead of its local definition |

## Components

### SpendContext

```js
// addSpendRecord generates:
{
  id: `spend_${Date.now()}`,
  orgId: 'org_demo',
  createdAt: new Date(),
  ...data,
}
```

`updateSpendRecord(id, data)` merges fields immutably.

### SpendModal

Controlled by `isOpen` + `onClose` + `record` (null = add mode, object = edit mode).

**Fields:** Supplier (select from `useSupplierContext()`, required), Amount (number, required), Currency (text, default `USD`), Category (select from `SPEND_CATEGORIES`, required), Description (text), Date (date input, default today), Invoice Ref (text).

**Validation:** `supplierId`, `amount` (non-empty and numeric, using the same `=== ''` check as `ContractModal` so `0` is valid), and `category` must be non-empty. Inline error below the field.

**Date input:** uses `formatDateToInput(date)` (local-date parts, avoids UTC timezone skew), now a shared export in `src/utils/formatters.js`. `ContractModal` is updated to import it from there instead of its local copy.

**Submit:** calls `addSpendRecord` or `updateSpendRecord`, then `onClose`. Button label: "Add Record" (add) or "Save Changes" (edit).

**Label/id pairs** use `sm-{key}` prefix (e.g., `htmlFor="sm-amount"`, `id="sm-amount"`).

## Pages

### `/esg` — ESG dashboard

- `PageHeader` title "ESG", description "Supplier sustainability performance"
- 4 summary cards with `border-l-4` accent colors (mirrors Risk page styling):
  - **Portfolio Average** — average of all `esgResponses.score`, rounded (blue accent, `border-accent-blue`)
  - **Strong** — count of `esgRating(score) === 'strong'` (green, `border-accent-green`)
  - **Developing** — count of `esgRating(score) === 'developing'` (amber, `border-accent-amber`)
  - **Needs Improvement** — count of `esgRating(score) === 'needs-improvement'` (red, `border-accent-red`)
- Filter controls (search + rating select) always visible, never gated behind `isLoading`
- Filter bar: search input (placeholder "Search suppliers..."), Rating `<select>` (All / Strong / Developing / Needs Improvement) using `ESG_RATING_LABEL` for option text
- `DataTable` columns:
  - **Supplier** — supplier name as `Link` to `/suppliers/:id`
  - **Rating** — `Badge` using `ESG_RATING_BADGE[esgRating(row.score)]` and `ESG_RATING_LABEL[...]` as text
  - **Score** — composite score, color-coded with `esgColor`
  - **Environmental** — plain number
  - **Social** — plain number
  - **Governance** — plain number
  - **Submitted** — `formatDate(row.submittedAt)`
- `rowKey={(row) => row.id}`, `emptyMessage="No suppliers match your filters"`
- While `isLoading`, table receives empty data array (consistent with Risk page's loading pass-through to `DataTable`)

The table data joins `esgResponses` with `suppliers` (from `useSupplierContext()`) to resolve supplier names — same join pattern as the Risk page.

### `/spend` — Spend dashboard

- `PageHeader` title "Spend", description "Track and analyze procurement spend", actions slot: `+ Add Spend Record` button
- 4 stat cards (plain `Card`, mirrors Contracts page styling):
  - **Total Spend** — sum of all `spendRecords.amount`, `formatCompactCurrency`
  - **This Month** — sum of records whose `date` falls in the current calendar month/year, `formatCompactCurrency`
  - **Top Category** — category name with the highest total from `getSpendByCategory` (text, `—` if no records)
  - **Suppliers Tracked** — count of distinct `supplierId` values across `spendRecords`
- Chart row (2 columns, `lg:grid-cols-2`, mirrors Dashboard chart styling):
  - **Monthly Trend** — `LineChart` from `getMonthlySpendTrend(spendRecords)`, `XAxis dataKey="month"`, `Line dataKey="total" stroke="#3B82F6"`, `Tooltip` formatted with `formatCurrency`
  - **Spend by Category** — `PieChart` from `getSpendByCategory(spendRecords)` (imported from `dashboardSelectors`), `dataKey="amount"` `nameKey="category"`, cells colored from a fixed palette `['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#60A5FA', '#34D399', '#FB923C']` cycling by index, with a wrapped legend below (mirrors Dashboard's Risk Distribution legend)
- Filter bar: text search input (placeholder "Search spend records..."), Category `<select>` (All + `SPEND_CATEGORIES`), Supplier `<select>` (All + supplier names)
- `DataTable` columns:
  - **Date** — `formatDate(row.date)`
  - **Supplier** — supplier name as `Link` to `/suppliers/:id`
  - **Category** — plain text
  - **Description** — plain text
  - **Amount** — `formatCurrency(row.amount, row.currency)`
  - **Invoice Ref** — plain text
  - **Actions** — Edit ghost `Button`, opens `SpendModal` in edit mode
- `rowKey={(row) => row.id}`, `emptyMessage="No spend records match your filters"`
- `SpendContext` provides data synchronously — no loading state on this page (mirrors Contracts page)

### SupplierDetail — ESG tab

Reads `esgResponses` directly from `mockData`, finds by `supplierId === supplier.id`.

- If no response: plain card "No ESG data available"
- If found:
  - Rating `Badge` (`ESG_RATING_BADGE[esgRating(score)]`, text from `ESG_RATING_LABEL`) + composite score (`esgColor`), at the top
  - 3 sub-score cards in a grid: **Environmental**, **Social**, **Governance** — each displays the score as a large number, color-coded with `esgColor`
  - Below grid: small text "Submitted {formatDate(submittedAt)}"

### SupplierDetail — Spend tab

Reads spend records from `SpendContext`, filters via `filterSpendRecords(spendRecords, suppliers, { supplierId: supplier.id })`.

- Header row: "Total Spend: {formatCurrency(total)}" on the left, "Add Spend Record" ghost button on the right (pre-fills `supplierId` in modal)
- `DataTable` columns: **Date** (`formatDate`), **Category**, **Description**, **Amount** (`formatCurrency`), **Invoice Ref**, **Actions** (Edit ghost button → `SpendModal` in edit mode)
- Empty state: "No spend records for this supplier"
- Embedded `SpendModal`; `handleSpendSubmit` calls `addSpendRecord({...data, supplierId: supplier.id})` for new records or `updateSpendRecord(id, data)` for edits

## Data Flow

```
mockData.esgResponses (read-only)
        │
        ├──▶ useEsg() ──▶ ESG.jsx (list + filter/sort via esgSelectors)
        │
        └──▶ direct import ──▶ SupplierDetail.jsx — ESG tab

mockData.spendRecords (seed)
        │
        ▼
SpendContext (useState — mutable in-memory store)
        │
        ├──▶ useSpend() ──▶ Dashboard (Spend by Category, Top Suppliers by Spend)
        │
        ├──▶ Spend.jsx (list + filter/sort via spendSelectors)
        │         └──▶ SpendModal (add/edit)
        │
        └──▶ SupplierDetail.jsx — Spend tab
                  └──▶ SpendModal (add, pre-filled supplierId)
```

## Error Handling & Loading States

- `SpendContext` provides data synchronously — no loading state on Spend pages (mirrors `ContractContext`).
- `ESG.jsx` uses `useEsg()` which has a 150ms simulated delay — passes an empty array to `DataTable` while `isLoading`, consistent with how the Risk page handles its load state. Filter controls remain visible during load (lesson from Phase 3: gating filters behind `isLoading` causes flicker and complicates tests).
- Unknown supplier in `SpendModal` supplier select: supplier list comes from `useSupplierContext()`, always populated.
- SupplierDetail ESG tab with no matching `esgResponses` entry: shows "No ESG data available" card (mirrors Risk tab's "No risk assessment available").

## Routing

`App.jsx` additions:
```jsx
<Route path="/esg" element={<ESG />} />
<Route path="/spend" element={<Spend />} />
```

The existing placeholder routes for `/esg` and `/spend` are removed from `PLACEHOLDER_ROUTES` (leaving only `/ai-assistant`, `/portal`, `/admin`). `SpendProvider` wraps the app alongside `SupplierProvider` and `ContractProvider`.

## Shared Utilities

- `esgColor(score)` — new formatter in `src/utils/formatters.js`: `score >= 67` → `text-accent-green`, `score >= 34` → `text-accent-amber`, else `text-accent-red`. Inverted thresholds vs `riskColor` (high ESG score = good).
- `formatDateToInput(date)` — new formatter in `src/utils/formatters.js`, moved from `ContractModal`'s local definition (formats a `Date`/date string as `YYYY-MM-DD` using local date parts, for `<input type="date">` values). `ContractModal` and `SpendModal` both import it.
- `SPEND_CATEGORIES` — currently a private const in `mockData.js`; export it for use in `SpendModal`'s category select and the Spend page's category filter.

## Testing

- **`formatters.test.js`** additions — `esgColor` boundaries (33/34, 66/67), `formatDateToInput` (formats a `Date` as local `YYYY-MM-DD`)
- **`SpendContext.test.jsx`** — seeds check, `addSpendRecord`, `updateSpendRecord`, throws outside provider (mirrors `ContractContext.test.jsx` pattern)
- **`esgSelectors.test.js`** — `esgRating` boundaries (33/34, 66/67), `filterEsgResponses` (no filters, name search, rating, combined, empty), `sortEsgResponses` (asc/desc, no mutation)
- **`spendSelectors.test.js`** — `filterSpendRecords` (no filters, name search, description search, category, supplierId, combined, empty), `sortSpendRecords` (asc/desc, no mutation), `getMonthlySpendTrend` (returns `months` buckets, correct labels, sums amounts per bucket)
- **`SpendModal.test.jsx`** — closed renders nothing, add mode empty fields (date defaults to today), edit mode pre-filled, validation blocks submit (missing supplier/amount/category), valid submit calls context + onClose, edit mode shows "Save Changes"
- **`ESG.test.jsx`** — renders 4 summary cards with correct counts/average, table shows all suppliers by default, search filter narrows results, rating filter narrows results, filters visible during load
- **`Spend.test.jsx`** — renders stat cards with correct totals, charts render, table shows records, search/category/supplier filters narrow results, "Add Spend Record" opens modal and adding a record updates the table
- **`SupplierDetail.test.jsx`** additions — ESG tab shows rating + 3 sub-score cards (or "No ESG data available"), Spend tab shows supplier's spend records + total, Add Spend Record flow
- **`useSpend` / `useEsg` hook tests** — `useSpend` reflects `SpendContext` mutations after delay; `useEsg` returns seeded `esgResponses` after delay
- **`Dashboard.test.jsx`** / **`App.test.jsx`** — wrap with `SpendProvider`; add route tests for `/esg` and `/spend` rendering real pages

## Out of Scope (deferred)

- ESG questionnaire UI / supplier-submitted answers (`answers` field, Phase 7 Supplier Portal)
- AI ESG suggestions (`aiSuggestions` field, Phase 5)
- Manual ESG score editing or assessment creation
- Spend record deletion
- Budget vs. actual tracking, PO matching, invoice upload (Phase 6 — Cloudinary/integrations)
- CSV/PDF export and reporting
- Pagination (spend records: ~42 rows render fine without it)
