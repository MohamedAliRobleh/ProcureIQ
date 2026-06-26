# Phase 4: ESG + Spend Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/esg` read-only ESG monitoring dashboard, the `/spend` spend analytics dashboard with full CRUD via a new `SpendContext`, and fill in the ESG and Spend tabs on the SupplierDetail page.

**Architecture:** ESG is read-only — a new `useEsg()` hook (mirrors `useRisk`) serves `mockData.esgResponses`, and the SupplierDetail ESG tab reads `esgResponses` directly from `mockData`. Spend gets a new `SpendContext` (in-memory CRUD, mirrors `ContractContext`) seeded from `mockData.spendRecords`; `useSpend()` is rewritten to wrap `useSpendContext()` with the same 150ms-delay pattern as `useContracts`. Two new selector files (`esgSelectors.js`, `spendSelectors.js`) provide pure rating/filter/sort/trend helpers, and a new `SpendModal` (mirrors `ContractModal`) handles add/edit.

**Tech Stack:** Vite + React 19, React Router v7, Tailwind CSS v3, Framer Motion, lucide-react, recharts v3, Vitest + React Testing Library + jsdom (`npm test` = `vitest run`).

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `src/utils/formatters.js` | Modify | Add `esgColor(score)`, `formatDateToInput(date)` |
| `src/utils/formatters.test.js` | Modify | Tests for the two new formatters |
| `src/components/ui/ContractModal.jsx` | Modify | Import `formatDateToInput` from formatters instead of local copy |
| `src/lib/mockData.js` | Modify | Export `SPEND_CATEGORIES` |
| `src/lib/mockData.test.js` | Modify | Test for the new export |
| `src/context/SpendContext.jsx` | Create | In-memory spend record state + CRUD |
| `src/context/SpendContext.test.jsx` | Create | Seed/add/update/throws tests |
| `src/utils/spendSelectors.js` | Create | `filterSpendRecords`, `sortSpendRecords`, `getMonthlySpendTrend` |
| `src/utils/spendSelectors.test.js` | Create | Tests for the above |
| `src/utils/esgSelectors.js` | Create | `esgRating`, `ESG_RATING_BADGE`, `ESG_RATING_LABEL`, `filterEsgResponses`, `sortEsgResponses` |
| `src/utils/esgSelectors.test.js` | Create | Tests for the above |
| `src/hooks/useEsg.js` | Create | Read-only ESG hook (mirrors `useRisk`) |
| `src/hooks/useSpend.js` | Modify | Rewrite to wrap `useSpendContext()` (mirrors `useContracts`) |
| `src/hooks/dataHooks.test.jsx` | Modify | Add `useEsg` test, rewrite `useSpend` test |
| `src/components/ui/SpendModal.jsx` | Create | Add/edit spend record modal |
| `src/components/ui/SpendModal.test.jsx` | Create | Tests for the modal |
| `src/pages/Spend.jsx` | Create | `/spend` dashboard page |
| `src/pages/Spend.test.jsx` | Create | Tests for the page |
| `src/pages/ESG.jsx` | Create | `/esg` dashboard page |
| `src/pages/ESG.test.jsx` | Create | Tests for the page |
| `src/App.jsx` | Modify | Add `SpendProvider`, real `/esg` and `/spend` routes, trim placeholders |
| `src/App.test.jsx` | Modify | Real `/esg` and `/spend` route tests |
| `src/pages/SupplierDetail.jsx` | Modify | Fill ESG and Spend tabs, remove `TAB_PHASE` |
| `src/pages/SupplierDetail.test.jsx` | Modify | `SpendProvider` wrapper + ESG/Spend tab tests |
| `src/pages/Dashboard.test.jsx` | Modify | Wrap with `SpendProvider` |

---

### Task 1: Shared formatters — `esgColor` and `formatDateToInput`

**Files:**
- Modify: `src/utils/formatters.js`
- Modify: `src/utils/formatters.test.js`
- Modify: `src/components/ui/ContractModal.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/utils/formatters.test.js`, update the import at the top of the file:

```js
import { formatCurrency, formatDate, formatPercent, daysUntil, timeAgo, riskColor, formatCompactCurrency, esgColor, formatDateToInput } from './formatters'
```

Then add these two `describe` blocks at the end of the file:

```js
describe('esgColor', () => {
  it('returns red for scores below 34', () => {
    expect(esgColor(0)).toBe('text-accent-red')
    expect(esgColor(33)).toBe('text-accent-red')
  })
  it('returns amber for scores 34–66', () => {
    expect(esgColor(34)).toBe('text-accent-amber')
    expect(esgColor(66)).toBe('text-accent-amber')
  })
  it('returns green for scores 67 and above', () => {
    expect(esgColor(67)).toBe('text-accent-green')
    expect(esgColor(100)).toBe('text-accent-green')
  })
})

describe('formatDateToInput', () => {
  it('formats a Date as YYYY-MM-DD using local date parts', () => {
    const d = new Date(2026, 2, 5) // March 5, 2026
    expect(formatDateToInput(d)).toBe('2026-03-05')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/formatters.test.js`
Expected: FAIL — `esgColor` and `formatDateToInput` are not exported from `./formatters`

- [ ] **Step 3: Implement the new formatters**

Append to the end of `src/utils/formatters.js`:

```js
export function esgColor(score) {
  if (score >= 67) return 'text-accent-green'
  if (score >= 34) return 'text-accent-amber'
  return 'text-accent-red'
}

export function formatDateToInput(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/formatters.test.js`
Expected: PASS

- [ ] **Step 5: Update ContractModal to use the shared formatter**

In `src/components/ui/ContractModal.jsx`, replace the top of the file (lines 1-12):

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'

function formatDateToInput(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```

with:

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'
import { formatDateToInput } from '../../utils/formatters'
```

- [ ] **Step 6: Run the ContractModal tests to verify nothing broke**

Run: `npm test -- src/components/ui/ContractModal.test.jsx`
Expected: PASS (all 6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/utils/formatters.js src/utils/formatters.test.js src/components/ui/ContractModal.jsx
git commit -m "feat: add esgColor and formatDateToInput shared formatters"
```

---

### Task 2: Export `SPEND_CATEGORIES` from mockData

**Files:**
- Modify: `src/lib/mockData.js`
- Modify: `src/lib/mockData.test.js`

- [ ] **Step 1: Write the failing test**

In `src/lib/mockData.test.js`, update the import at the top:

```js
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords, recentActivity, SPEND_CATEGORIES } from './mockData'
```

Add this test inside the `describe('mockData', ...)` block (after the "seeds roughly 6 months of spend records" test):

```js
it('exports SPEND_CATEGORIES with 8 categories including Raw Materials', () => {
  expect(SPEND_CATEGORIES).toHaveLength(8)
  expect(SPEND_CATEGORIES).toContain('Raw Materials')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/mockData.test.js`
Expected: FAIL — `SPEND_CATEGORIES` is `undefined`

- [ ] **Step 3: Export the constant**

In `src/lib/mockData.js`, change line 121 from:

```js
const SPEND_CATEGORIES = ['Raw Materials', 'Logistics', 'IT Services', 'Manufacturing', 'Packaging', 'Professional Services', 'Energy', 'Components']
```

to:

```js
export const SPEND_CATEGORIES = ['Raw Materials', 'Logistics', 'IT Services', 'Manufacturing', 'Packaging', 'Professional Services', 'Energy', 'Components']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/mockData.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockData.js src/lib/mockData.test.js
git commit -m "feat: export SPEND_CATEGORIES from mockData"
```

---

### Task 3: SpendContext

**Files:**
- Create: `src/context/SpendContext.jsx`
- Create: `src/context/SpendContext.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/context/SpendContext.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SpendProvider, useSpendContext } from './SpendContext'
import { spendRecords as seedSpendRecords } from '../lib/mockData'

const wrapper = ({ children }) => <SpendProvider>{children}</SpendProvider>

describe('SpendContext', () => {
  it('seeds from mockData.spendRecords on mount', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
    expect(result.current.spendRecords[0].id).toBe(seedSpendRecords[0].id)
  })

  it('addSpendRecord appends a new record with a generated id', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    act(() => {
      result.current.addSpendRecord({
        supplierId: 'sup_1',
        amount: 5000,
        currency: 'USD',
        category: 'Logistics',
        description: 'New spend',
        date: new Date('2026-06-01'),
        invoiceRef: 'INV-9999',
      })
    })
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length + 1)
    expect(result.current.spendRecords.at(-1).description).toBe('New spend')
    expect(result.current.spendRecords.at(-1).id).toBeTruthy()
  })

  it('updateSpendRecord modifies the matching record by id', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    const id = result.current.spendRecords[0].id
    act(() => result.current.updateSpendRecord(id, { amount: 99999 }))
    expect(result.current.spendRecords.find((r) => r.id === id).amount).toBe(99999)
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
  })

  it('throws when used outside SpendProvider', () => {
    expect(() => renderHook(() => useSpendContext())).toThrow(
      'useSpendContext must be used inside SpendProvider'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/context/SpendContext.test.jsx`
Expected: FAIL — cannot find module `./SpendContext`

- [ ] **Step 3: Implement SpendContext**

Create `src/context/SpendContext.jsx`:

```jsx
import { createContext, useContext, useState } from 'react'
import { spendRecords as seedSpendRecords } from '../lib/mockData'

const SpendContext = createContext(null)

export function SpendProvider({ children }) {
  const [spendRecords, setSpendRecords] = useState(() => seedSpendRecords.map((r) => ({ ...r })))

  function addSpendRecord(data) {
    const newRecord = {
      ...data,
      id: `spend_${Date.now()}`,
      orgId: 'org_demo',
      createdAt: new Date(),
    }
    setSpendRecords((prev) => [...prev, newRecord])
  }

  function updateSpendRecord(id, data) {
    setSpendRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data } : r))
    )
  }

  return (
    <SpendContext.Provider value={{ spendRecords, addSpendRecord, updateSpendRecord }}>
      {children}
    </SpendContext.Provider>
  )
}

export function useSpendContext() {
  const ctx = useContext(SpendContext)
  if (!ctx) throw new Error('useSpendContext must be used inside SpendProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/context/SpendContext.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/SpendContext.jsx src/context/SpendContext.test.jsx
git commit -m "feat: add SpendContext with in-memory spend record CRUD"
```

---

### Task 4: spendSelectors

**Files:**
- Create: `src/utils/spendSelectors.js`
- Create: `src/utils/spendSelectors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/spendSelectors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { filterSpendRecords, sortSpendRecords, getMonthlySpendTrend } from './spendSelectors'

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
]

const records = [
  { id: 'spend_1', supplierId: 'sup_1', amount: 10000, category: 'Raw Materials', description: 'Steel order', date: new Date('2026-04-01') },
  { id: 'spend_2', supplierId: 'sup_2', amount: 20000, category: 'Logistics', description: 'Freight charges', date: new Date('2026-05-01') },
  { id: 'spend_3', supplierId: 'sup_1', amount: 5000, category: 'Logistics', description: 'Shipping', date: new Date('2026-03-01') },
]

describe('filterSpendRecords', () => {
  it('returns all records when no filters applied', () => {
    expect(filterSpendRecords(records, suppliers)).toHaveLength(3)
  })
  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterSpendRecords(records, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(2)
  })
  it('filters by description search', () => {
    const result = filterSpendRecords(records, suppliers, { search: 'freight' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('spend_2')
  })
  it('filters by exact category', () => {
    expect(filterSpendRecords(records, suppliers, { category: 'Logistics' })).toHaveLength(2)
  })
  it('filters by supplierId', () => {
    expect(filterSpendRecords(records, suppliers, { supplierId: 'sup_2' })).toHaveLength(1)
  })
  it('applies multiple filters together', () => {
    const result = filterSpendRecords(records, suppliers, { supplierId: 'sup_1', category: 'Logistics' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('spend_3')
  })
  it('returns empty array when nothing matches', () => {
    expect(filterSpendRecords(records, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortSpendRecords', () => {
  it('sorts by date descending by default', () => {
    const result = sortSpendRecords(records)
    expect(result.map((r) => r.id)).toEqual(['spend_2', 'spend_1', 'spend_3'])
  })
  it('sorts by date ascending', () => {
    const result = sortSpendRecords(records, { key: 'date', direction: 'asc' })
    expect(result.map((r) => r.id)).toEqual(['spend_3', 'spend_1', 'spend_2'])
  })
  it('does not mutate the input array', () => {
    const firstId = records[0].id
    sortSpendRecords(records, { key: 'date', direction: 'asc' })
    expect(records[0].id).toBe(firstId)
  })
})

describe('getMonthlySpendTrend', () => {
  it('returns the requested number of monthly buckets', () => {
    const result = getMonthlySpendTrend(records, 6)
    expect(result).toHaveLength(6)
    for (const bucket of result) {
      expect(bucket).toHaveProperty('month')
      expect(bucket).toHaveProperty('total')
    }
  })
  it('sums amounts for the current month bucket', () => {
    const now = new Date()
    const thisMonthRecords = [
      { id: 's1', supplierId: 'sup_1', amount: 1000, category: 'Logistics', description: 'A', date: new Date(now.getFullYear(), now.getMonth(), 5) },
      { id: 's2', supplierId: 'sup_1', amount: 2000, category: 'Logistics', description: 'B', date: new Date(now.getFullYear(), now.getMonth(), 10) },
    ]
    const result = getMonthlySpendTrend(thisMonthRecords, 6)
    expect(result.at(-1).total).toBe(3000)
  })
  it('orders buckets oldest first ending with the current month', () => {
    const now = new Date()
    const expectedLastLabel = now.toLocaleString('en-US', { month: 'short' })
    const result = getMonthlySpendTrend(records, 6)
    expect(result.at(-1).month).toBe(expectedLastLabel)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/spendSelectors.test.js`
Expected: FAIL — cannot find module `./spendSelectors`

- [ ] **Step 3: Implement spendSelectors**

Create `src/utils/spendSelectors.js`:

```js
export function filterSpendRecords(records, suppliers, { search = '', category = '', supplierId = '' } = {}) {
  return records.filter((r) => {
    const supplier = suppliers.find((s) => s.id === r.supplierId)
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      (supplier && supplier.name.toLowerCase().includes(searchLower)) ||
      r.description.toLowerCase().includes(searchLower)
    const matchesCategory = !category || r.category === category
    const matchesSupplierId = !supplierId || r.supplierId === supplierId
    return matchesSearch && matchesCategory && matchesSupplierId
  })
}

export function sortSpendRecords(records, { key = 'date', direction = 'desc' } = {}) {
  return [...records].sort((a, b) => {
    let av = a[key]
    let bv = b[key]
    if (av instanceof Date || bv instanceof Date) {
      av = new Date(av).getTime()
      bv = new Date(bv).getTime()
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}

export function getMonthlySpendTrend(records, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'short' }), total: 0 })
  }
  for (const record of records) {
    const d = new Date(record.date)
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth())
    if (bucket) bucket.total += record.amount
  }
  return buckets.map((b) => ({ month: b.label, total: b.total }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/spendSelectors.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/spendSelectors.js src/utils/spendSelectors.test.js
git commit -m "feat: add spendSelectors (filter, sort, monthly trend)"
```

---

### Task 5: esgSelectors

**Files:**
- Create: `src/utils/esgSelectors.js`
- Create: `src/utils/esgSelectors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/esgSelectors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { esgRating, filterEsgResponses, sortEsgResponses, ESG_RATING_BADGE, ESG_RATING_LABEL } from './esgSelectors'

describe('esgRating', () => {
  it('returns needs-improvement for scores below 34', () => {
    expect(esgRating(0)).toBe('needs-improvement')
    expect(esgRating(33)).toBe('needs-improvement')
  })
  it('returns developing for scores 34–66', () => {
    expect(esgRating(34)).toBe('developing')
    expect(esgRating(66)).toBe('developing')
  })
  it('returns strong for scores 67 and above', () => {
    expect(esgRating(67)).toBe('strong')
    expect(esgRating(100)).toBe('strong')
  })
})

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
]

const responses = [
  { id: 'esg_1', supplierId: 'sup_1', score: 80, environmental: 80, social: 80, governance: 80 },
  { id: 'esg_2', supplierId: 'sup_2', score: 50, environmental: 50, social: 50, governance: 50 },
  { id: 'esg_3', supplierId: 'sup_1', score: 20, environmental: 20, social: 20, governance: 20 },
]

describe('filterEsgResponses', () => {
  it('returns all responses when no filters applied', () => {
    expect(filterEsgResponses(responses, suppliers)).toHaveLength(3)
  })
  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterEsgResponses(responses, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(2)
  })
  it('filters by rating', () => {
    expect(filterEsgResponses(responses, suppliers, { rating: 'strong' })).toHaveLength(1)
    expect(filterEsgResponses(responses, suppliers, { rating: 'needs-improvement' })).toHaveLength(1)
  })
  it('applies search and rating together', () => {
    const result = filterEsgResponses(responses, suppliers, { search: 'atlas', rating: 'strong' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('esg_1')
  })
  it('returns empty array when nothing matches', () => {
    expect(filterEsgResponses(responses, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortEsgResponses', () => {
  it('sorts by score descending by default', () => {
    const result = sortEsgResponses(responses)
    expect(result.map((r) => r.id)).toEqual(['esg_1', 'esg_2', 'esg_3'])
  })
  it('sorts by score ascending', () => {
    const result = sortEsgResponses(responses, { key: 'score', direction: 'asc' })
    expect(result.map((r) => r.id)).toEqual(['esg_3', 'esg_2', 'esg_1'])
  })
  it('does not mutate the input array', () => {
    const firstId = responses[0].id
    sortEsgResponses(responses, { key: 'score', direction: 'asc' })
    expect(responses[0].id).toBe(firstId)
  })
})

describe('ESG_RATING_BADGE and ESG_RATING_LABEL', () => {
  it('have entries for all three ratings', () => {
    for (const rating of ['strong', 'developing', 'needs-improvement']) {
      expect(ESG_RATING_BADGE[rating]).toBeTruthy()
      expect(ESG_RATING_LABEL[rating]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/esgSelectors.test.js`
Expected: FAIL — cannot find module `./esgSelectors`

- [ ] **Step 3: Implement esgSelectors**

Create `src/utils/esgSelectors.js`:

```js
export function esgRating(score) {
  if (score >= 67) return 'strong'
  if (score >= 34) return 'developing'
  return 'needs-improvement'
}

export const ESG_RATING_BADGE = {
  strong: 'green',
  developing: 'amber',
  'needs-improvement': 'red',
}

export const ESG_RATING_LABEL = {
  strong: 'Strong',
  developing: 'Developing',
  'needs-improvement': 'Needs Improvement',
}

export function filterEsgResponses(responses, suppliers, { search = '', rating = '' } = {}) {
  return responses.filter((r) => {
    const supplier = suppliers.find((s) => s.id === r.supplierId)
    const matchesSearch = !search || (supplier && supplier.name.toLowerCase().includes(search.toLowerCase()))
    const matchesRating = !rating || esgRating(r.score) === rating
    return matchesSearch && matchesRating
  })
}

export function sortEsgResponses(responses, { key = 'score', direction = 'desc' } = {}) {
  return [...responses].sort((a, b) => {
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/esgSelectors.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/esgSelectors.js src/utils/esgSelectors.test.js
git commit -m "feat: add esgSelectors (rating, filter, sort)"
```

---

### Task 6: useEsg hook

**Files:**
- Create: `src/hooks/useEsg.js`
- Modify: `src/hooks/dataHooks.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/hooks/dataHooks.test.jsx`, update the imports at the top of the file:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSuppliers } from './useSuppliers'
import { useContracts } from './useContracts'
import { useRisk } from './useRisk'
import { useEsg } from './useEsg'
import { useSpend } from './useSpend'
import { ContractProvider } from '../context/ContractContext'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../lib/mockData'
```

Add this test inside `describe('data hooks', ...)`, after the `useRisk` test:

```jsx
  it('useEsg resolves with seeded ESG responses', async () => {
    const { result } = renderHook(() => useEsg())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.esgResponses).toEqual(esgResponses)
    expect(result.current.error).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/dataHooks.test.jsx`
Expected: FAIL — cannot find module `./useEsg`

- [ ] **Step 3: Implement useEsg**

Create `src/hooks/useEsg.js`:

```js
import { useEffect, useState } from 'react'
import { esgResponses } from '../lib/mockData'

export function useEsg() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(esgResponses)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { esgResponses: data, isLoading, error }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/dataHooks.test.jsx`
Expected: PASS (note: the existing `useSpend` test in this file is expected to still pass at this point — it is rewritten in Task 7)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEsg.js src/hooks/dataHooks.test.jsx
git commit -m "feat: add useEsg read-only hook"
```

---

### Task 7: Rewrite useSpend to wrap SpendContext

**Files:**
- Modify: `src/hooks/useSpend.js`
- Modify: `src/hooks/dataHooks.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/hooks/dataHooks.test.jsx`, add the `SpendProvider` import:

```jsx
import { SpendProvider } from '../context/SpendContext'
```

Then replace the existing `useSpend` test:

```jsx
  it('useSpend resolves with seeded spend records', async () => {
    const { result } = renderHook(() => useSpend())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toEqual(spendRecords)
    expect(result.current.error).toBeNull()
  })
```

with:

```jsx
  it('useSpend resolves with seeded spend records', async () => {
    const wrapper = ({ children }) => <SpendProvider>{children}</SpendProvider>
    const { result } = renderHook(() => useSpend(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toEqual(spendRecords)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/dataHooks.test.jsx`
Expected: FAIL — `useSpendContext must be used inside SpendProvider` (current `useSpend` reads `mockData.spendRecords` directly, doesn't use `SpendProvider`, but the wrapper now provides a context the old hook doesn't consume — and the old hook still returns `error`, which is no longer asserted but the hook itself doesn't break here. The actual failure is that `result.current.spendRecords` from the OLD hook reads directly from `mockData` rather than the context, so this assertion alone may pass by coincidence. To make the test meaningfully fail first, temporarily confirm by running — if it unexpectedly passes, proceed directly to Step 3, since the rewrite is still required by the spec and Task 9/11 depend on `useSpend` reading from `SpendContext`.)

- [ ] **Step 3: Rewrite useSpend**

Replace the entire contents of `src/hooks/useSpend.js`:

```js
import { useState, useEffect } from 'react'
import { useSpendContext } from '../context/SpendContext'

export function useSpend() {
  const { spendRecords } = useSpendContext()
  const [data, setData] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setData(spendRecords), 150)
    return () => clearTimeout(timer)
  }, [spendRecords])

  return { spendRecords: data, isLoading: data === null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/dataHooks.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the Dashboard test to check for breakage**

Run: `npm test -- src/pages/Dashboard.test.jsx`
Expected: FAIL — `useSpendContext must be used inside SpendProvider` (Dashboard uses `useSpend()`, which now requires `SpendProvider`; this is fixed in Task 11, Step 9. This failure is expected and will remain until Task 11 — note it and continue.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSpend.js src/hooks/dataHooks.test.jsx
git commit -m "feat: rewrite useSpend to wrap SpendContext with simulated delay"
```

---

### Task 8: SpendModal

**Files:**
- Create: `src/components/ui/SpendModal.jsx`
- Create: `src/components/ui/SpendModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/SpendModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupplierProvider } from '../../context/SupplierContext'
import SpendModal from './SpendModal'
import { formatDateToInput } from '../../utils/formatters'

const mockRecord = {
  id: 'spend_1',
  supplierId: 'sup_1',
  amount: 12000,
  currency: 'USD',
  category: 'Logistics',
  description: 'Monthly spend — Atlas Steelworks',
  date: new Date('2026-04-05'),
  invoiceRef: 'INV-2026-0001',
}

function renderModal(props) {
  return render(
    <SupplierProvider>
      <SpendModal {...props} />
    </SupplierProvider>
  )
}

describe('SpendModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false, onClose: () => {}, record: null, onSubmit: () => {} })
    expect(screen.queryByRole('heading', { name: 'Add Spend Record' })).not.toBeInTheDocument()
  })

  it('shows "Add Spend Record" title with empty fields and today\'s date when no record is provided', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(null)
    expect(screen.getByLabelText('Date')).toHaveValue(formatDateToInput(new Date()))
  })

  it('shows "Edit Spend Record" title pre-filled when editing', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: mockRecord, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Edit Spend Record' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(12000)
    expect(screen.getByLabelText('Invoice Ref')).toHaveValue('INV-2026-0001')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-04-05')
  })

  it('pre-fills supplierId from defaultSupplierId in add mode', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit: () => {}, defaultSupplierId: 'sup_1' })
    expect(screen.getByLabelText('Supplier')).toHaveValue('sup_1')
  })

  it('shows inline errors and blocks submit when supplier, amount, and category are empty', () => {
    const onSubmit = vi.fn()
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))
    expect(screen.getByText('Supplier is required')).toBeInTheDocument()
    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(screen.getByText('Category is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose, record: null, onSubmit })
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'sup_1' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'sup_1', amount: 5000, category: 'Logistics' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" button in edit mode', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: mockRecord, onSubmit: () => {} })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/ui/SpendModal.test.jsx`
Expected: FAIL — cannot find module `./SpendModal`

- [ ] **Step 3: Implement SpendModal**

Create `src/components/ui/SpendModal.jsx`:

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'
import { formatDateToInput } from '../../utils/formatters'
import { SPEND_CATEGORIES } from '../../lib/mockData'

const EMPTY_FORM = {
  supplierId: '',
  amount: '',
  currency: 'USD',
  category: '',
  description: '',
  date: '',
  invoiceRef: '',
}

export default function SpendModal({ isOpen, onClose, record, onSubmit, defaultSupplierId }) {
  const { suppliers } = useSupplierContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      record
        ? {
            supplierId: record.supplierId,
            amount: String(record.amount),
            currency: record.currency,
            category: record.category,
            description: record.description ?? '',
            date: record.date ? formatDateToInput(record.date) : '',
            invoiceRef: record.invoiceRef ?? '',
          }
        : { ...EMPTY_FORM, supplierId: defaultSupplierId ?? '', date: formatDateToInput(new Date()) }
    )
  }, [isOpen, record, defaultSupplierId])

  function validate() {
    const errs = {}
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    if (form.amount === '' || isNaN(Number(form.amount))) errs.amount = 'Amount is required'
    if (!form.category) errs.category = 'Category is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit({ ...form, amount: Number(form.amount) })
    onClose()
  }

  function field(key, label, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`sm-${key}`} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <input
          id={`sm-${key}`}
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        {errors[key] && <p className="text-xs text-accent-red">{errors[key]}</p>}
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={record ? 'Edit Spend Record' : 'Add Spend Record'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-supplierId" className="text-xs font-medium text-text-secondary">
              Supplier
            </label>
            <select
              id="sm-supplierId"
              value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.supplierId && <p className="text-xs text-accent-red">{errors.supplierId}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-category" className="text-xs font-medium text-text-secondary">
              Category
            </label>
            <select
              id="sm-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="">Select category...</option>
              {SPEND_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-accent-red">{errors.category}</p>}
          </div>
          {field('amount', 'Amount', 'number')}
          {field('currency', 'Currency')}
          {field('date', 'Date', 'date')}
          {field('invoiceRef', 'Invoice Ref')}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sm-description" className="text-xs font-medium text-text-secondary">
            Description
          </label>
          <input
            id="sm-description"
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {record ? 'Save Changes' : 'Add Record'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/ui/SpendModal.test.jsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SpendModal.jsx src/components/ui/SpendModal.test.jsx
git commit -m "feat: add SpendModal for add/edit spend records"
```

---

### Task 9: Spend page (`/spend`)

**Files:**
- Create: `src/pages/Spend.jsx`
- Create: `src/pages/Spend.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Spend.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { SpendProvider } from '../context/SpendContext'
import Spend from './Spend'
import { spendRecords, suppliers } from '../lib/mockData'
import { formatCompactCurrency } from '../utils/formatters'

function renderSpend() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <SpendProvider>
          <Spend />
        </SpendProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Spend', () => {
  it('renders page heading and stat cards with correct totals', () => {
    renderSpend()
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument()
    const totalSpend = spendRecords.reduce((sum, r) => sum + r.amount, 0)
    expect(screen.getByText('Total Spend')).toBeInTheDocument()
    expect(screen.getByText(formatCompactCurrency(totalSpend))).toBeInTheDocument()
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('Top Category')).toBeInTheDocument()
    expect(screen.getByText('Suppliers Tracked')).toBeInTheDocument()
  })

  it('renders the spend records table with a seeded record', () => {
    renderSpend()
    expect(screen.getByText(spendRecords[0].invoiceRef)).toBeInTheDocument()
  })

  it('filters the table by supplier name search', () => {
    renderSpend()
    fireEvent.change(screen.getByPlaceholderText('Search spend records...'), {
      target: { value: 'Atlas' },
    })
    expect(screen.getAllByText('Monthly spend — Atlas Steelworks').length).toBeGreaterThan(0)
    expect(screen.queryByText('Monthly spend — Meridian Manufacturing')).not.toBeInTheDocument()
  })

  it('opens the Add Spend Record modal and adds a record to the table', async () => {
    renderSpend()
    fireEvent.click(screen.getByRole('button', { name: 'Add Spend Record' }))
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: suppliers[0].id } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New consulting fee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))

    await waitFor(() => expect(screen.getByText('New consulting fee')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/Spend.test.jsx`
Expected: FAIL — cannot find module `./Spend`

- [ ] **Step 3: Implement the Spend page**

Create `src/pages/Spend.jsx`:

```jsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/Spend.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Spend.jsx src/pages/Spend.test.jsx
git commit -m "feat: add Spend dashboard page with charts, filters, and CRUD"
```

---

### Task 10: ESG page (`/esg`)

**Files:**
- Create: `src/pages/ESG.jsx`
- Create: `src/pages/ESG.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/ESG.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import ESG from './ESG'
import { esgResponses } from '../lib/mockData'
import { esgRating } from '../utils/esgSelectors'

function renderESG() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <ESG />
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('ESG', () => {
  it('shows 4 summary cards with correct counts and average after loading', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())

    const portfolioAverage = Math.round(
      esgResponses.reduce((sum, r) => sum + r.score, 0) / esgResponses.length
    )
    const strongCount = esgResponses.filter((r) => esgRating(r.score) === 'strong').length
    const developingCount = esgResponses.filter((r) => esgRating(r.score) === 'developing').length
    const needsImprovementCount = esgResponses.filter((r) => esgRating(r.score) === 'needs-improvement').length

    expect(screen.getByText('Portfolio Average')).toBeInTheDocument()
    expect(screen.getByText(String(portfolioAverage))).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText(String(strongCount))).toBeInTheDocument()
    expect(screen.getByText('Developing')).toBeInTheDocument()
    expect(screen.getByText(String(developingCount))).toBeInTheDocument()
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
    expect(screen.getByText(String(needsImprovementCount))).toBeInTheDocument()
  })

  it('renders supplier names in the table after loading', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
  })

  it('filters the table by supplier name search', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'atlas' },
    })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('filters the table by rating', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
    const select = screen.getByDisplayValue('All Ratings')
    fireEvent.change(select, { target: { value: 'strong' } })
    expect(screen.getByText('Voltaic Energy Systems')).toBeInTheDocument()
    expect(screen.queryByText('Atlas Steelworks')).not.toBeInTheDocument()
  })

  it('keeps filter controls visible while loading', () => {
    renderESG()
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Ratings')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/ESG.test.jsx`
Expected: FAIL — cannot find module `./ESG`

- [ ] **Step 3: Implement the ESG page**

Create `src/pages/ESG.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { useEsg } from '../hooks/useEsg'
import { useSupplierContext } from '../context/SupplierContext'
import { esgRating, filterEsgResponses, sortEsgResponses, ESG_RATING_BADGE, ESG_RATING_LABEL } from '../utils/esgSelectors'
import { esgColor, formatDate } from '../utils/formatters'
import { cn } from '../utils/cn'

export default function ESG() {
  const { esgResponses, isLoading } = useEsg()
  const { suppliers } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState('')

  const allResponses = esgResponses ?? []

  const portfolioAverage = allResponses.length
    ? Math.round(allResponses.reduce((sum, r) => sum + r.score, 0) / allResponses.length)
    : 0
  const strongCount = allResponses.filter((r) => esgRating(r.score) === 'strong').length
  const developingCount = allResponses.filter((r) => esgRating(r.score) === 'developing').length
  const needsImprovementCount = allResponses.filter((r) => esgRating(r.score) === 'needs-improvement').length

  const filtered = sortEsgResponses(
    filterEsgResponses(allResponses, suppliers, { search, rating }),
    { key: 'score', direction: 'desc' }
  )

  const rows = filtered
    .map((r) => ({ ...r, supplier: suppliers.find((s) => s.id === r.supplierId) }))
    .filter((row) => row.supplier)

  const columns = [
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (
        <Link
          to={`/suppliers/${row.supplier.id}`}
          className="font-medium text-accent-blue-light hover:underline"
        >
          {row.supplier.name}
        </Link>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => {
        const r = esgRating(row.score)
        return <Badge variant={ESG_RATING_BADGE[r]}>{ESG_RATING_LABEL[r]}</Badge>
      },
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) => <span className={cn('font-bold', esgColor(row.score))}>{row.score}</span>,
    },
    { key: 'environmental', header: 'Environmental' },
    { key: 'social', header: 'Social' },
    { key: 'governance', header: 'Governance' },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (row) => formatDate(row.submittedAt),
    },
  ]

  return (
    <div>
      <PageHeader title="ESG" description="Supplier sustainability performance" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-accent-blue p-4">
          <p className="text-xs text-text-secondary">Portfolio Average</p>
          <p className="mt-1 text-2xl font-bold text-accent-blue">{portfolioAverage}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-green p-4">
          <p className="text-xs text-text-secondary">Strong</p>
          <p className="mt-1 text-2xl font-bold text-accent-green">{strongCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-amber p-4">
          <p className="text-xs text-text-secondary">Developing</p>
          <p className="mt-1 text-2xl font-bold text-accent-amber">{developingCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-red p-4">
          <p className="text-xs text-text-secondary">Needs Improvement</p>
          <p className="mt-1 text-2xl font-bold text-accent-red">{needsImprovementCount}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Ratings</option>
          <option value="strong">{ESG_RATING_LABEL.strong}</option>
          <option value="developing">{ESG_RATING_LABEL.developing}</option>
          <option value="needs-improvement">{ESG_RATING_LABEL['needs-improvement']}</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No suppliers match your filters"
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/ESG.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ESG.jsx src/pages/ESG.test.jsx
git commit -m "feat: add ESG dashboard page with rating summary and table"
```

---

### Task 11: Wire up routing, SupplierDetail tabs, and Dashboard provider

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`
- Modify: `src/pages/SupplierDetail.jsx`
- Modify: `src/pages/SupplierDetail.test.jsx`
- Modify: `src/pages/Dashboard.test.jsx`

- [ ] **Step 1: Write the failing route tests**

In `src/App.test.jsx`, replace the last test (`'renders a placeholder page for not-yet-built modules'`, which currently targets `/esg`):

```jsx
  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/esg')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ESG' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 4/i)).toBeInTheDocument()
  })
```

with three new tests:

```jsx
  it('renders the ESG dashboard page at /esg', async () => {
    window.history.pushState({}, '', '/esg')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ESG' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
  })

  it('renders the Spend dashboard page at /spend', async () => {
    window.history.pushState({}, '', '/spend')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search spend records...')).toBeInTheDocument()
  })

  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/ai-assistant')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 5/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.jsx`
Expected: FAIL — `/esg` and `/spend` still render `PlaceholderPage`, so `getByPlaceholderText('Search suppliers...')` / `'Search spend records...'` are not found

- [ ] **Step 3: Update App.jsx**

Replace the entire contents of `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import { SupplierProvider } from './context/SupplierContext'
import { ContractProvider } from './context/ContractContext'
import { SpendProvider } from './context/SpendContext'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
  { path: '/ai-assistant', title: 'AI Assistant', phase: 'Phase 5' },
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
  { path: '/admin', title: 'Admin', phase: 'Phase 7' },
]

export default function App() {
  return (
    <ErrorBoundary>
      <MockAuthProvider>
        <SupplierProvider>
          <ContractProvider>
            <SpendProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/suppliers/:id" element={<SupplierDetail />} />
                    <Route path="/contracts" element={<Contracts />} />
                    <Route path="/risk" element={<Risk />} />
                    <Route path="/esg" element={<ESG />} />
                    <Route path="/spend" element={<Spend />} />
                    {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                      <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
                    ))}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </SpendProvider>
          </ContractProvider>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.jsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Write the failing SupplierDetail tab tests**

In `src/pages/SupplierDetail.test.jsx`, add the `SpendProvider` import:

```jsx
import { SpendProvider } from '../context/SpendContext'
```

Update the `renderDetail` helper to wrap with `SpendProvider`:

```jsx
function renderDetail(id = 'sup_1') {
  return render(
    <MemoryRouter initialEntries={[`/suppliers/${id}`]}>
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Routes>
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
            </Routes>
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}
```

Add these three tests at the end of the `describe('SupplierDetail', ...)` block:

```jsx
  it('ESG tab shows rating, score, and sub-score cards for the supplier', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'ESG' }))
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
    expect(screen.getByText('Environmental')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('Spend tab shows the supplier spend records and total', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Spend' }))
    expect(screen.getByText('Total Spend: $68,550')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly spend — Atlas Steelworks').length).toBe(6)
  })

  it('Spend tab Add Spend Record flow opens modal and adds a record', async () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Spend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Spend Record' }))
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Extra freight charge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))

    await waitFor(() => expect(screen.getByText('Extra freight charge')).toBeInTheDocument())
  })
```

This file's existing imports already include `fireEvent` and `screen`; add `waitFor` to the `@testing-library/react` import:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/pages/SupplierDetail.test.jsx`
Expected: FAIL — `useSpendContext must be used inside SpendProvider` and/or "ESG is under construction" / "Spend is under construction" still rendered

- [ ] **Step 7: Update SupplierDetail.jsx imports and constants**

Replace the import block and constants at the top of `src/pages/SupplierDetail.jsx` (lines 1-22):

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import SupplierModal from '../components/ui/SupplierModal'
import ContractModal from '../components/ui/ContractModal'
import ContractSlideOver from '../components/ui/ContractSlideOver'
import PageHeader from '../components/layout/PageHeader'
import { useSupplierContext } from '../context/SupplierContext'
import { useContractContext } from '../context/ContractContext'
import { formatDate, formatCurrency, daysUntil, riskColor } from '../utils/formatters'
import { filterContracts, CONTRACT_STATUS_BADGE } from '../utils/contractSelectors'
import { RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { riskAssessments } from '../lib/mockData'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const TAB_PHASE = { ESG: 'Phase 4', Spend: 'Phase 4' }
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }
```

with:

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import SupplierModal from '../components/ui/SupplierModal'
import ContractModal from '../components/ui/ContractModal'
import ContractSlideOver from '../components/ui/ContractSlideOver'
import SpendModal from '../components/ui/SpendModal'
import PageHeader from '../components/layout/PageHeader'
import { useSupplierContext } from '../context/SupplierContext'
import { useContractContext } from '../context/ContractContext'
import { useSpendContext } from '../context/SpendContext'
import { formatDate, formatCurrency, daysUntil, riskColor, esgColor } from '../utils/formatters'
import { filterContracts, CONTRACT_STATUS_BADGE } from '../utils/contractSelectors'
import { RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { esgRating, ESG_RATING_BADGE, ESG_RATING_LABEL } from '../utils/esgSelectors'
import { filterSpendRecords } from '../utils/spendSelectors'
import { riskAssessments, esgResponses } from '../lib/mockData'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }
```

- [ ] **Step 8: Add SpendContext state to the component**

Replace the component's opening state declarations:

```jsx
export default function SupplierDetail() {
  const { id } = useParams()
  const { suppliers, updateSupplier, setSupplierStatus } = useSupplierContext()
  const { contracts, addContract, updateContract } = useContractContext()
  const [activeTab, setActiveTab] = useState('Overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [contractSlideOpen, setContractSlideOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
```

with:

```jsx
export default function SupplierDetail() {
  const { id } = useParams()
  const { suppliers, updateSupplier, setSupplierStatus } = useSupplierContext()
  const { contracts, addContract, updateContract } = useContractContext()
  const { spendRecords, addSpendRecord, updateSpendRecord } = useSpendContext()
  const [activeTab, setActiveTab] = useState('Overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [contractSlideOpen, setContractSlideOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [spendModalOpen, setSpendModalOpen] = useState(false)
  const [editingSpend, setEditingSpend] = useState(null)
```

- [ ] **Step 9: Add Spend handler functions**

After the existing `handleContractSubmit` function:

```jsx
  function handleContractSubmit(data) {
    if (editingContract) {
      updateContract(editingContract.id, data)
    } else {
      addContract({ ...data, supplierId: supplier.id })
    }
  }
```

add:

```jsx

  function openAddSpend() {
    setEditingSpend(null)
    setSpendModalOpen(true)
  }

  function openEditSpend(record) {
    setEditingSpend(record)
    setSpendModalOpen(true)
  }

  function handleSpendSubmit(data) {
    if (editingSpend) {
      updateSpendRecord(editingSpend.id, data)
    } else {
      addSpendRecord({ ...data, supplierId: supplier.id })
    }
  }
```

- [ ] **Step 10: Add spendColumns**

After the closing `]` of `contractColumns` and before `function renderContractsTab() {`:

```jsx
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" onClick={() => openEditContract(row)}>
          Edit
        </Button>
      ),
    },
  ]

  function renderContractsTab() {
```

becomes:

```jsx
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" onClick={() => openEditContract(row)}>
          Edit
        </Button>
      ),
    },
  ]

  const spendColumns = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount, row.currency) },
    { key: 'invoiceRef', header: 'Invoice Ref' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" onClick={() => openEditSpend(row)}>
          Edit
        </Button>
      ),
    },
  ]

  function renderContractsTab() {
```

- [ ] **Step 11: Add renderEsgTab and renderSpendTab**

After the closing of `renderRiskTab()` and before the final `return (`:

```jsx
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={RISK_LEVEL_BADGE[riskAssessment.level] ?? 'muted'}>
            {riskAssessment.level}
          </Badge>
          <span className={cn('text-xl font-bold', riskColor(riskAssessment.score))}>
            {riskAssessment.score}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Financial Risk', value: riskAssessment.financialRisk },
            { label: 'Compliance Risk', value: riskAssessment.complianceRisk },
            { label: 'Operational Risk', value: riskAssessment.operationalRisk },
            { label: 'Geopolitical Risk', value: riskAssessment.geopoliticalRisk },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold', riskColor(value))}>{value}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Assessed {formatDate(riskAssessment.assessedAt)} by {riskAssessment.assessedBy}
        </p>
      </div>
    )
  }

  return (
```

becomes:

```jsx
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={RISK_LEVEL_BADGE[riskAssessment.level] ?? 'muted'}>
            {riskAssessment.level}
          </Badge>
          <span className={cn('text-xl font-bold', riskColor(riskAssessment.score))}>
            {riskAssessment.score}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Financial Risk', value: riskAssessment.financialRisk },
            { label: 'Compliance Risk', value: riskAssessment.complianceRisk },
            { label: 'Operational Risk', value: riskAssessment.operationalRisk },
            { label: 'Geopolitical Risk', value: riskAssessment.geopoliticalRisk },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold', riskColor(value))}>{value}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Assessed {formatDate(riskAssessment.assessedAt)} by {riskAssessment.assessedBy}
        </p>
      </div>
    )
  }

  function renderEsgTab() {
    const esgResponse = esgResponses.find((r) => r.supplierId === supplier.id)
    if (!esgResponse) {
      return (
        <Card className="p-6 text-center">
          <p className="text-sm text-text-secondary">No ESG data available</p>
        </Card>
      )
    }
    const rating = esgRating(esgResponse.score)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={ESG_RATING_BADGE[rating]}>{ESG_RATING_LABEL[rating]}</Badge>
          <span className={cn('text-xl font-bold', esgColor(esgResponse.score))}>
            {esgResponse.score}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Environmental', value: esgResponse.environmental },
            { label: 'Social', value: esgResponse.social },
            { label: 'Governance', value: esgResponse.governance },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={cn('mt-1 text-2xl font-bold', esgColor(value))}>{value}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-muted">Submitted {formatDate(esgResponse.submittedAt)}</p>
      </div>
    )
  }

  function renderSpendTab() {
    const supplierSpend = filterSpendRecords(spendRecords, suppliers, { supplierId: supplier.id })
    const total = supplierSpend.reduce((sum, r) => sum + r.amount, 0)
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">
            Total Spend: {formatCurrency(total)}
          </p>
          <Button variant="ghost" onClick={openAddSpend}>
            Add Spend Record
          </Button>
        </div>
        <DataTable
          columns={spendColumns}
          data={supplierSpend}
          rowKey={(row) => row.id}
          emptyMessage="No spend records for this supplier"
        />
        <SpendModal
          isOpen={spendModalOpen}
          onClose={() => setSpendModalOpen(false)}
          record={editingSpend}
          onSubmit={handleSpendSubmit}
          defaultSupplierId={supplier.id}
        />
      </div>
    )
  }

  return (
```

- [ ] **Step 12: Replace the final tab ternary's fallback branch**

```jsx
      ) : activeTab === 'Risk' ? (
        renderRiskTab()
      ) : (
        <Card className="p-6 text-center">
          <p className="font-semibold text-text-primary">{activeTab} is under construction</p>
          <p className="mt-1 text-sm text-text-secondary">
            This module is coming in {TAB_PHASE[activeTab]}.
          </p>
        </Card>
      )}
```

becomes:

```jsx
      ) : activeTab === 'Risk' ? (
        renderRiskTab()
      ) : activeTab === 'ESG' ? (
        renderEsgTab()
      ) : (
        renderSpendTab()
      )}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm test -- src/pages/SupplierDetail.test.jsx`
Expected: PASS (9 tests)

- [ ] **Step 14: Update Dashboard.test.jsx to wrap with SpendProvider**

In `src/pages/Dashboard.test.jsx`, add the import:

```jsx
import { SpendProvider } from '../context/SpendContext'
```

Replace the render call:

```jsx
    render(
      <ContractProvider>
        <Dashboard />
      </ContractProvider>
    )
```

with:

```jsx
    render(
      <ContractProvider>
        <SpendProvider>
          <Dashboard />
        </SpendProvider>
      </ContractProvider>
    )
```

- [ ] **Step 15: Run test to verify it passes**

Run: `npm test -- src/pages/Dashboard.test.jsx`
Expected: PASS

- [ ] **Step 16: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files green

- [ ] **Step 17: Commit**

```bash
git add src/App.jsx src/App.test.jsx src/pages/SupplierDetail.jsx src/pages/SupplierDetail.test.jsx src/pages/Dashboard.test.jsx
git commit -m "feat: wire ESG/Spend routes, fill SupplierDetail tabs, wrap app with SpendProvider"
```

---

## Self-Review Notes

- **Spec coverage:** All New Files (`SpendContext`, `useEsg`, `esgSelectors`, `spendSelectors`, `SpendModal`, `ESG.jsx`, `Spend.jsx`) and Modified Files (`mockData.js`, `formatters.js`, `useSpend.js`, `App.jsx`, `SupplierDetail.jsx`, `ContractModal.jsx`) from the spec are covered by Tasks 1-11. All Testing requirements from the spec's Testing section are covered.
- **`defaultSupplierId` addition:** The spec's SupplierDetail Spend tab section says "Add Spend Record" "pre-fills `supplierId` in modal" but `SpendModal`'s documented props are `{isOpen, onClose, record, onSubmit}` with `record = null` meaning add mode. Passing a partial `record` object would incorrectly trigger edit-mode UI ("Edit Spend Record" / "Save Changes" / `updateSpendRecord(editingSpend.id, ...)` with no id). Task 8 adds a minimal optional `defaultSupplierId` prop to `SpendModal` to satisfy the spec's pre-fill requirement without corrupting add/edit mode detection. `Spend.jsx` (Task 9) doesn't pass it (defaults to `''`, preserving current top-level page behavior); `SupplierDetail.jsx` (Task 11) passes `defaultSupplierId={supplier.id}`.
- **Type/signature consistency checked:**
  - `useEsg()` returns `{ esgResponses, isLoading, error }` — consumed correctly in `ESG.jsx` (Task 10) and `dataHooks.test.jsx` (Task 6).
  - `useSpend()` returns `{ spendRecords, isLoading }` (no `error`) — `Dashboard.jsx` only destructures `spendRecords`/`isLoading`, so no change needed there; `dataHooks.test.jsx` test updated to drop the `error` assertion (Task 7).
  - `useSpendContext()` returns `{ spendRecords, addSpendRecord, updateSpendRecord }` — consumed identically in `Spend.jsx` (Task 9) and `SupplierDetail.jsx` (Task 11).
  - `esgRating(score)` / `ESG_RATING_BADGE` / `ESG_RATING_LABEL` keys (`strong`, `developing`, `needs-improvement`) are used consistently across `esgSelectors.js`, `ESG.jsx`, and `SupplierDetail.jsx`.
  - `filterSpendRecords`/`sortSpendRecords`/`getMonthlySpendTrend` signatures match between `spendSelectors.js` (Task 4) and their usages in `Spend.jsx` (Task 9) and `SupplierDetail.jsx` (Task 11).
  - `SPEND_CATEGORIES` is imported from `../lib/mockData` (not redefined) in `SpendModal.jsx` and `Spend.jsx`.
- **No placeholders:** All code blocks are complete, runnable implementations — no TODOs or "similar to Task N" references.
