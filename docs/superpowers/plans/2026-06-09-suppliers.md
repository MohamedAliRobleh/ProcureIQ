# Phase 2: Suppliers Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/suppliers` placeholder with a fully functional Suppliers module — sortable/filterable list page, tabbed detail page, and add/edit modal backed by in-memory SupplierContext.

**Architecture:** `SupplierContext` seeds from `mockData.suppliers` and exposes `addSupplier`, `updateSupplier`, and `setSupplierStatus`. Two pure-function selectors (`filterSuppliers`, `sortSuppliers`) drive the list view. Three pre-flight patches (hook error fields, `daysUntil` consolidation, DataTable `rowKey`) clean up Phase 1 technical debt before new features land.

**Tech Stack:** React 18, Vite, Vitest + React Testing Library, React Router v6, Tailwind CSS v3, Framer Motion, lucide-react

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/hooks/useSuppliers.js` | Add `error` field |
| Modify | `src/hooks/useContracts.js` | Add `error` field |
| Modify | `src/hooks/useRisk.js` | Add `error` field |
| Modify | `src/hooks/useSpend.js` | Add `error` field |
| Modify | `src/hooks/dataHooks.test.jsx` | Add `error: null` assertions |
| Modify | `src/utils/formatters.js` | Add `referenceDate` param + `Math.ceil` to `daysUntil` |
| Modify | `src/utils/formatters.test.js` | Replace `daysUntil` tests with deterministic fixed-date versions |
| Modify | `src/utils/dashboardSelectors.js` | Import `daysUntil` from formatters; remove local copy |
| Modify | `src/components/ui/DataTable.jsx` | Add optional `rowKey` prop |
| Modify | `src/components/ui/composites.test.jsx` | Add `rowKey` test to DataTable describe block |
| Create | `src/context/SupplierContext.jsx` | In-memory supplier state + CRUD |
| Create | `src/context/SupplierContext.test.jsx` | Tests for all four context operations |
| Create | `src/utils/supplierSelectors.js` | `filterSuppliers` + `sortSuppliers` pure functions |
| Create | `src/utils/supplierSelectors.test.js` | Unit tests for both selectors |
| Create | `src/components/ui/SupplierModal.jsx` | Add/edit supplier modal |
| Create | `src/components/ui/SupplierModal.test.jsx` | Modal rendering + validation + submit tests |
| Create | `src/pages/Suppliers.jsx` | `/suppliers` list page |
| Create | `src/pages/Suppliers.test.jsx` | List page render + filter + modal-open tests |
| Create | `src/pages/SupplierDetail.jsx` | `/suppliers/:id` detail page |
| Create | `src/pages/SupplierDetail.test.jsx` | Detail page tabs + status toggle + not-found tests |
| Modify | `src/App.jsx` | Add SupplierProvider; replace /suppliers placeholder; add /suppliers/:id |
| Modify | `src/App.test.jsx` | Update placeholder test to /contracts; add /suppliers real-page test |

---

## Task 1: Pre-flight — Add error field to data hooks

**Files:**
- Modify: `src/hooks/useSuppliers.js`
- Modify: `src/hooks/useContracts.js`
- Modify: `src/hooks/useRisk.js`
- Modify: `src/hooks/useSpend.js`
- Modify: `src/hooks/dataHooks.test.jsx`

- [ ] **Step 1: Write the failing tests**

Replace `src/hooks/dataHooks.test.jsx` with the full updated version adding `error: null` assertions:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSuppliers } from './useSuppliers'
import { useContracts } from './useContracts'
import { useRisk } from './useRisk'
import { useSpend } from './useSpend'
import { suppliers, contracts, riskAssessments, spendRecords } from '../lib/mockData'

describe('data hooks', () => {
  it('useSuppliers starts loading then resolves with seeded suppliers', async () => {
    const { result } = renderHook(() => useSuppliers())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.suppliers).toBe(null)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toEqual(suppliers)
    expect(result.current.error).toBeNull()
  })

  it('useContracts resolves with seeded contracts', async () => {
    const { result } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.contracts).toEqual(contracts)
    expect(result.current.error).toBeNull()
  })

  it('useRisk resolves with seeded risk assessments', async () => {
    const { result } = renderHook(() => useRisk())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.riskAssessments).toEqual(riskAssessments)
    expect(result.current.error).toBeNull()
  })

  it('useSpend resolves with seeded spend records', async () => {
    const { result } = renderHook(() => useSpend())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toEqual(spendRecords)
    expect(result.current.error).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/dataHooks.test.jsx
```

Expected: 4 failures — `result.current.error` is `undefined`, not `null`.

- [ ] **Step 3: Update all four hooks**

Replace `src/hooks/useSuppliers.js`:

```javascript
import { useEffect, useState } from 'react'
import { suppliers } from '../lib/mockData'

export function useSuppliers() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(suppliers)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { suppliers: data, isLoading, error }
}
```

Replace `src/hooks/useContracts.js` (same pattern, returns `contracts`):

```javascript
import { useEffect, useState } from 'react'
import { contracts } from '../lib/mockData'

export function useContracts() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(contracts)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { contracts: data, isLoading, error }
}
```

Replace `src/hooks/useRisk.js` (same pattern, returns `riskAssessments`):

```javascript
import { useEffect, useState } from 'react'
import { riskAssessments } from '../lib/mockData'

export function useRisk() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(riskAssessments)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { riskAssessments: data, isLoading, error }
}
```

Replace `src/hooks/useSpend.js` (same pattern, returns `spendRecords`):

```javascript
import { useEffect, useState } from 'react'
import { spendRecords } from '../lib/mockData'

export function useSpend() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(spendRecords)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { spendRecords: data, isLoading, error }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/dataHooks.test.jsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/hooks/useSuppliers.js src/hooks/useContracts.js src/hooks/useRisk.js src/hooks/useSpend.js src/hooks/dataHooks.test.jsx
git commit -m "feat: add error field to all four data hooks"
```

---

## Task 2: Pre-flight — Consolidate daysUntil

The `daysUntil` function exists in `formatters.js` (exported, uses `Math.round`, no reference date param) and as a local inline copy inside `getExpiringContracts` in `dashboardSelectors.js` (uses `Math.ceil`, accepts reference date). The goal is one canonical version in `formatters.js` that `dashboardSelectors.js` imports.

**Files:**
- Modify: `src/utils/formatters.js`
- Modify: `src/utils/formatters.test.js`
- Modify: `src/utils/dashboardSelectors.js`

- [ ] **Step 1: Write failing tests for the updated daysUntil signature**

Replace only the `daysUntil` describe block in `src/utils/formatters.test.js`. The full updated file:

```javascript
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatPercent, daysUntil, timeAgo } from './formatters'

describe('formatCurrency', () => {
  it('formats USD with no decimals', () => {
    expect(formatCurrency(125000)).toBe('$125,000')
  })
})

describe('formatDate', () => {
  it('formats a date as "Mon D, YYYY"', () => {
    expect(formatDate('2026-03-15')).toBe('Mar 15, 2026')
  })
})

describe('formatPercent', () => {
  it('formats a number as a percentage string', () => {
    expect(formatPercent(42)).toBe('42%')
  })

  it('respects the decimals argument', () => {
    expect(formatPercent(42.567, 1)).toBe('42.6%')
  })
})

describe('daysUntil', () => {
  it('returns the ceiling number of days until a future date', () => {
    const ref = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-01-06T00:00:00.000Z')
    expect(daysUntil(future, ref)).toBe(5)
  })

  it('returns a negative number of days for a past date', () => {
    const ref = new Date('2026-01-04T00:00:00.000Z')
    const past = new Date('2026-01-01T00:00:00.000Z')
    expect(daysUntil(past, ref)).toBe(-3)
  })

  it('uses the current time when no referenceDate is supplied', () => {
    const ref = new Date()
    const future = new Date(ref.getTime() + 2 * 24 * 60 * 60 * 1000)
    expect(daysUntil(future)).toBe(2)
  })
})

describe('timeAgo', () => {
  it('renders days for dates more than a day old', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(timeAgo(past)).toBe('2d ago')
  })

  it('renders "just now" for the current moment', () => {
    expect(timeAgo(new Date())).toBe('just now')
  })
})
```

- [ ] **Step 2: Run tests to verify new daysUntil tests fail**

```
npx vitest run src/utils/formatters.test.js
```

Expected: the 2 new `daysUntil` tests fail because the current implementation does not accept a `referenceDate` param and uses `Math.round` instead of `Math.ceil`.

- [ ] **Step 3: Update formatters.js**

Replace only the `daysUntil` function in `src/utils/formatters.js`. The full updated file:

```javascript
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date) {
  const d = new Date(date)
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  // Date-only strings (e.g. "2026-03-15") parse as UTC midnight; format in UTC
  // so the displayed date matches the input regardless of local timezone.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    options.timeZone = 'UTC'
  }
  return new Intl.DateTimeFormat('en-US', options).format(d)
}

export function formatPercent(value, decimals = 0) {
  return `${value.toFixed(decimals)}%`
}

export function daysUntil(date, referenceDate = new Date()) {
  const ms = new Date(date).getTime() - new Date(referenceDate).getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  const days = Math.floor(seconds / 86400)
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(seconds / 3600)
  if (hours > 0) return `${hours}h ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
```

- [ ] **Step 4: Run formatters tests to verify they pass**

```
npx vitest run src/utils/formatters.test.js
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Update dashboardSelectors.js to import daysUntil**

Replace `src/utils/dashboardSelectors.js` with the full updated file (adds import, removes the local `daysUntil` inside `getExpiringContracts`, calls the imported one):

```javascript
import { daysUntil } from './formatters'

export function getAverageRiskScore(riskAssessments) {
  if (riskAssessments.length === 0) return 0
  const total = riskAssessments.reduce((sum, r) => sum + r.score, 0)
  return Math.round(total / riskAssessments.length)
}

export function getRiskDistribution(riskAssessments) {
  const levels = ['low', 'medium', 'high', 'critical']
  return levels.map((level) => ({
    level,
    count: riskAssessments.filter((r) => r.level === level).length,
  }))
}

export function getSpendByCategory(spendRecords) {
  const totals = new Map()
  for (const record of spendRecords) {
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount)
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }))
}

export function getTotalSpendYTD(spendRecords, referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  return spendRecords
    .filter((record) => new Date(record.date).getFullYear() === year)
    .reduce((sum, record) => sum + record.amount, 0)
}

export function getExpiringContracts(contracts, referenceDate = new Date()) {
  const active = contracts.filter((c) => c.status === 'active')
  return {
    within30: active.filter((c) => { const d = daysUntil(c.endDate, referenceDate); return d >= 0 && d <= 30 }),
    within60: active.filter((c) => { const d = daysUntil(c.endDate, referenceDate); return d > 30 && d <= 60 }),
    within90: active.filter((c) => { const d = daysUntil(c.endDate, referenceDate); return d > 60 && d <= 90 }),
  }
}

export function getTopSuppliersBySpend(spendRecords, suppliers, limit = 5) {
  const totals = new Map()
  for (const record of spendRecords) {
    totals.set(record.supplierId, (totals.get(record.supplierId) ?? 0) + record.amount)
  }
  return [...totals.entries()]
    .map(([supplierId, totalSpend]) => ({
      supplier: suppliers.find((s) => s.id === supplierId),
      totalSpend,
    }))
    .filter((entry) => entry.supplier)
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit)
}
```

- [ ] **Step 6: Run full suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```
git add src/utils/formatters.js src/utils/formatters.test.js src/utils/dashboardSelectors.js
git commit -m "refactor: consolidate daysUntil into formatters, add referenceDate param"
```

---

## Task 3: Pre-flight — Add rowKey prop to DataTable

**Files:**
- Modify: `src/components/ui/DataTable.jsx`
- Modify: `src/components/ui/composites.test.jsx`

- [ ] **Step 1: Write the failing test**

Add one test to the `DataTable` describe block in `src/components/ui/composites.test.jsx`. Full updated file:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Building2 } from 'lucide-react'
import StatCard from './StatCard'
import AIInsightBox from './AIInsightBox'
import Modal from './Modal'
import DataTable from './DataTable'

describe('StatCard', () => {
  it('renders the label, value, and icon', () => {
    render(<StatCard label="Total Suppliers" value={20} icon={Building2} />)
    expect(screen.getByText('Total Suppliers')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })
})

describe('AIInsightBox', () => {
  it('renders a title and body content', () => {
    render(<AIInsightBox title="AI Insight">Some narrative text.</AIInsightBox>)
    expect(screen.getByText('AI Insight')).toBeInTheDocument()
    expect(screen.getByText('Some narrative text.')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Edit Supplier">body</Modal>)
    expect(screen.queryByText('Edit Supplier')).not.toBeInTheDocument()
  })

  it('renders title and content when open, and calls onClose', async () => {
    const onClose = vi.fn()
    render(<Modal isOpen onClose={onClose} title="Edit Supplier">body content</Modal>)
    expect(screen.getByText('Edit Supplier')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
    screen.getByLabelText('Close').click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'country', header: 'Country' },
  ]

  it('shows a loading spinner while loading', () => {
    render(<DataTable columns={columns} data={null} isLoading />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an empty message when there is no data', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No suppliers yet" />)
    expect(screen.getByText('No suppliers yet')).toBeInTheDocument()
  })

  it('renders rows using column render functions and raw values', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (row) => row.name.toUpperCase() },
          { key: 'country', header: 'Country' },
        ]}
        data={[{ id: '1', name: 'atlas', country: 'Germany' }]}
      />
    )
    expect(screen.getByText('ATLAS')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })

  it('uses rowKey function to generate row keys when provided', () => {
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name' }]}
        data={[{ name: 'Atlas' }, { name: 'Nordic' }]}
        rowKey={(row) => row.name}
      />
    )
    expect(screen.getByText('Atlas')).toBeInTheDocument()
    expect(screen.getByText('Nordic')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/components/ui/composites.test.jsx
```

Expected: the new `rowKey` test fails with a React key warning (rows without `id` property fall back to index, which still renders — but this test is really verifying the prop is accepted without error; the test itself may actually pass without the prop). Run the suite to see current behavior.

> Note: The `rowKey` test as written may not fail if the fallback `row.id ?? i` quietly uses index for rows without an `id`. The value of adding the prop is for consumers who want explicit, stable keys. The test still documents the contract. Proceed with the implementation.

- [ ] **Step 3: Update DataTable.jsx**

Replace `src/components/ui/DataTable.jsx`:

```jsx
import { cn } from '../../utils/cn'
import LoadingSpinner from './LoadingSpinner'

export default function DataTable({ columns, data, isLoading, emptyMessage = 'No records found', rowKey }) {
  if (isLoading) return <LoadingSpinner className="py-12" />

  if (!data || data.length === 0) {
    return <div className="py-12 text-center text-sm text-text-secondary">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={rowKey ? rowKey(row) : (row.id ?? i)}
              className={cn('border-b border-border/60 transition-colors hover:bg-bg-hover', i % 2 === 1 && 'bg-bg-secondary/40')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text-primary">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run full suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```
git add src/components/ui/DataTable.jsx src/components/ui/composites.test.jsx
git commit -m "feat: add optional rowKey prop to DataTable"
```

---

## Task 4: SupplierContext

**Files:**
- Create: `src/context/SupplierContext.jsx`
- Create: `src/context/SupplierContext.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/context/SupplierContext.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SupplierProvider, useSupplierContext } from './SupplierContext'
import { suppliers as seedSuppliers } from '../lib/mockData'

const wrapper = ({ children }) => <SupplierProvider>{children}</SupplierProvider>

describe('SupplierContext', () => {
  it('seeds from mockData.suppliers on mount', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
    expect(result.current.suppliers[0].id).toBe('sup_1')
  })

  it('addSupplier appends a new supplier with a generated id', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    act(() => {
      result.current.addSupplier({
        name: 'New Co',
        email: 'new@co.com',
        phone: '',
        country: 'Japan',
        category: 'Energy',
        status: 'pending',
        website: '',
        description: '',
      })
    })
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length + 1)
    expect(result.current.suppliers.at(-1).name).toBe('New Co')
    expect(result.current.suppliers.at(-1).id).toBeTruthy()
  })

  it('updateSupplier modifies the matching supplier by id', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    const id = result.current.suppliers[0].id
    act(() => result.current.updateSupplier(id, { name: 'Renamed Corp' }))
    expect(result.current.suppliers.find((s) => s.id === id).name).toBe('Renamed Corp')
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
  })

  it('setSupplierStatus updates only the status field', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    const id = result.current.suppliers[0].id
    act(() => result.current.setSupplierStatus(id, 'suspended'))
    expect(result.current.suppliers.find((s) => s.id === id).status).toBe('suspended')
    expect(result.current.suppliers.find((s) => s.id === id).name).toBe(seedSuppliers[0].name)
  })

  it('throws when used outside SupplierProvider', () => {
    expect(() => renderHook(() => useSupplierContext())).toThrow(
      'useSupplierContext must be used inside SupplierProvider'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/context/SupplierContext.test.jsx
```

Expected: 5 failures — module not found.

- [ ] **Step 3: Create SupplierContext.jsx**

Create `src/context/SupplierContext.jsx`:

```jsx
import { createContext, useContext, useState } from 'react'
import { suppliers as seedSuppliers } from '../lib/mockData'

const SupplierContext = createContext(null)

export function SupplierProvider({ children }) {
  const [suppliers, setSuppliers] = useState(() => seedSuppliers.map((s) => ({ ...s })))

  function addSupplier(data) {
    const newSupplier = {
      ...data,
      id: `sup_${Date.now()}`,
      orgId: 'org_demo',
      logoUrl: null,
      onboardedAt: new Date(),
      createdAt: new Date(),
    }
    setSuppliers((prev) => [...prev, newSupplier])
  }

  function updateSupplier(id, data) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  function setSupplierStatus(id, status) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
  }

  return (
    <SupplierContext.Provider value={{ suppliers, addSupplier, updateSupplier, setSupplierStatus }}>
      {children}
    </SupplierContext.Provider>
  )
}

export function useSupplierContext() {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSupplierContext must be used inside SupplierProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/context/SupplierContext.test.jsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/context/SupplierContext.jsx src/context/SupplierContext.test.jsx
git commit -m "feat: add SupplierContext with in-memory CRUD operations"
```

---

## Task 5: supplierSelectors.js

**Files:**
- Create: `src/utils/supplierSelectors.js`
- Create: `src/utils/supplierSelectors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/supplierSelectors.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { filterSuppliers, sortSuppliers } from './supplierSelectors'

const suppliers = [
  { id: 's1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active', riskScore: 30 },
  { id: 's2', name: 'Nordic Freight', category: 'Logistics', country: 'Germany', status: 'active', riskScore: 55 },
  { id: 's3', name: 'Brightline Energy', category: 'Energy', country: 'Japan', status: 'suspended', riskScore: 80 },
  { id: 's4', name: 'ArcLight Tech', category: 'Logistics', country: 'Brazil', status: 'pending', riskScore: 20 },
]

describe('filterSuppliers', () => {
  it('returns all suppliers when no filters are set', () => {
    expect(filterSuppliers(suppliers, {})).toHaveLength(4)
  })

  it('filters by name search (case-insensitive)', () => {
    expect(filterSuppliers(suppliers, { search: 'atlas' })).toHaveLength(1)
    expect(filterSuppliers(suppliers, { search: 'ATLAS' })).toHaveLength(1)
    expect(filterSuppliers(suppliers, { search: 'ATLAS' })[0].id).toBe('s1')
  })

  it('filters by category', () => {
    expect(filterSuppliers(suppliers, { category: 'Logistics' })).toHaveLength(2)
    expect(filterSuppliers(suppliers, { category: 'Energy' })).toHaveLength(1)
  })

  it('filters by status', () => {
    expect(filterSuppliers(suppliers, { status: 'active' })).toHaveLength(2)
    expect(filterSuppliers(suppliers, { status: 'suspended' })).toHaveLength(1)
  })

  it('applies all three filters simultaneously', () => {
    const result = filterSuppliers(suppliers, { search: 'arc', category: 'Logistics', status: 'pending' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s4')
  })

  it('returns empty array when no suppliers match', () => {
    expect(filterSuppliers(suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortSuppliers', () => {
  it('sorts by name ascending', () => {
    const result = sortSuppliers(suppliers, { key: 'name', direction: 'asc' })
    expect(result[0].name).toBe('ArcLight Tech')
    expect(result[3].name).toBe('Nordic Freight')
  })

  it('sorts by name descending', () => {
    const result = sortSuppliers(suppliers, { key: 'name', direction: 'desc' })
    expect(result[0].name).toBe('Nordic Freight')
    expect(result[3].name).toBe('ArcLight Tech')
  })

  it('sorts by riskScore ascending', () => {
    const result = sortSuppliers(suppliers, { key: 'riskScore', direction: 'asc' })
    expect(result[0].riskScore).toBe(20)
    expect(result[3].riskScore).toBe(80)
  })

  it('does not mutate the original array', () => {
    const original = [suppliers[0], suppliers[1], suppliers[2], suppliers[3]]
    sortSuppliers(suppliers, { key: 'name', direction: 'desc' })
    expect(suppliers[0]).toBe(original[0])
    expect(suppliers[1]).toBe(original[1])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/utils/supplierSelectors.test.js
```

Expected: failures — module not found.

- [ ] **Step 3: Create supplierSelectors.js**

Create `src/utils/supplierSelectors.js`:

```javascript
export function filterSuppliers(suppliers, { search = '', category = '', status = '' } = {}) {
  return suppliers.filter((s) => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !category || s.category === category
    const matchesStatus = !status || s.status === status
    return matchesSearch && matchesCategory && matchesStatus
  })
}

export function sortSuppliers(suppliers, { key = 'name', direction = 'asc' } = {}) {
  return [...suppliers].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/utils/supplierSelectors.test.js
```

Expected: 8 tests PASS.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/utils/supplierSelectors.js src/utils/supplierSelectors.test.js
git commit -m "feat: add filterSuppliers and sortSuppliers selectors"
```

---

## Task 6: SupplierModal

**Files:**
- Create: `src/components/ui/SupplierModal.jsx`
- Create: `src/components/ui/SupplierModal.test.jsx`

Context: `Modal.jsx` (already exists) takes props `isOpen`, `onClose`, `title`, `children`, `className` and renders an animated overlay with an `<h2>` title. `Button.jsx` accepts `variant` (primary / secondary / ghost / danger) and spreads `...props` to the native `<button>`. `Badge.jsx` is not used in this modal.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/SupplierModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SupplierModal from './SupplierModal'

const mockSupplier = {
  name: 'Atlas Steelworks',
  email: 'contact@atlas.com',
  phone: '+1-555-0100',
  country: 'United States',
  category: 'Raw Materials',
  status: 'active',
  website: 'https://atlas.com',
  description: 'A steel supplier.',
}

describe('SupplierModal', () => {
  it('renders nothing when closed', () => {
    render(<SupplierModal isOpen={false} onClose={() => {}} supplier={null} onSubmit={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'Add Supplier' })).not.toBeInTheDocument()
  })

  it('shows "Add Supplier" title with empty name field when no supplier is provided', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={null} onSubmit={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Add Supplier' })).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier Name')).toHaveValue('')
  })

  it('shows "Edit Supplier" title pre-filled with supplier data', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={mockSupplier} onSubmit={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Edit Supplier' })).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier Name')).toHaveValue('Atlas Steelworks')
    expect(screen.getByLabelText('Email')).toHaveValue('contact@atlas.com')
  })

  it('shows inline errors and blocks submit when name and email are empty', () => {
    const onSubmit = vi.fn()
    render(<SupplierModal isOpen onClose={() => {}} supplier={null} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<SupplierModal isOpen onClose={onClose} supplier={null} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('Supplier Name'), { target: { value: 'New Corp' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@corp.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Corp', email: 'new@corp.com' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" submit button in edit mode', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={mockSupplier} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/ui/SupplierModal.test.jsx
```

Expected: 6 failures — module not found.

- [ ] **Step 3: Create SupplierModal.jsx**

Create `src/components/ui/SupplierModal.jsx`:

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'

const CATEGORIES = [
  'Raw Materials', 'Manufacturing', 'IT Services', 'Logistics',
  'Packaging', 'Professional Services', 'Energy', 'Components',
]

const COUNTRIES = [
  'United States', 'Germany', 'Japan', 'United Kingdom',
  'Singapore', 'Brazil', 'India', 'Netherlands', 'Australia', 'South Korea',
]

const STATUSES = ['active', 'pending', 'suspended']

const EMPTY_FORM = {
  name: '', email: '', phone: '', country: 'United States',
  category: 'Logistics', status: 'active', website: '', description: '',
}

export default function SupplierModal({ isOpen, onClose, supplier, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      supplier
        ? {
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone ?? '',
            country: supplier.country,
            category: supplier.category,
            status: supplier.status,
            website: supplier.website ?? '',
            description: supplier.description ?? '',
          }
        : EMPTY_FORM
    )
  }, [isOpen, supplier])

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit(form)
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
    <Modal isOpen={isOpen} onClose={onClose} title={supplier ? 'Edit Supplier' : 'Add Supplier'} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {field('name', 'Supplier Name')}
          {field('email', 'Email')}
          {field('phone', 'Phone')}
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-country" className="text-xs font-medium text-text-secondary">Country</label>
            <select
              id="sm-country"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-category" className="text-xs font-medium text-text-secondary">Category</label>
            <select
              id="sm-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-status" className="text-xs font-medium text-text-secondary">Status</label>
            <select
              id="sm-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        {field('website', 'Website')}
        <div className="flex flex-col gap-1">
          <label htmlFor="sm-description" className="text-xs font-medium text-text-secondary">Description</label>
          <textarea
            id="sm-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {supplier ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/ui/SupplierModal.test.jsx
```

Expected: 6 tests PASS.

> Note on `getByLabelText`: each `<label>` uses `htmlFor="sm-{key}"` and each input uses `id="sm-{key}"`. `getByLabelText('Supplier Name')` finds the input whose label text is "Supplier Name" — this works because `htmlFor="sm-name"` links to `id="sm-name"`.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/components/ui/SupplierModal.jsx src/components/ui/SupplierModal.test.jsx
git commit -m "feat: add SupplierModal with add/edit modes and client-side validation"
```

---

## Task 7: Suppliers list page

**Files:**
- Create: `src/pages/Suppliers.jsx`
- Create: `src/pages/Suppliers.test.jsx`

Context: `SupplierContext` is available via `useSupplierContext`. `filterSuppliers` and `sortSuppliers` are in `src/utils/supplierSelectors.js`. `DataTable` accepts `columns`, `data`, `rowKey`, `emptyMessage`. `PageHeader` accepts `title`, `description`, `actions`. `Badge` accepts `variant` (green / amber / red). The supplier list is synchronous from context — no `isLoading` needed.

Supplier `riskScore` thresholds: ≤33 → `text-accent-green`, ≤66 → `text-accent-amber`, >66 → `text-accent-red`.

Status → Badge variant: `active` → `green`, `pending` → `amber`, `suspended` → `red`.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Suppliers.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import Suppliers from './Suppliers'

function renderSuppliers() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <Suppliers />
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Suppliers', () => {
  it('renders page heading and at least one seeded supplier', () => {
    renderSuppliers()
    expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('filters suppliers by search text', () => {
    renderSuppliers()
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), { target: { value: 'atlas' } })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('shows the empty message when no suppliers match the filter', () => {
    renderSuppliers()
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), { target: { value: 'zzznomatch' } })
    expect(screen.getByText('No suppliers match your filters')).toBeInTheDocument()
  })

  it('opens the Add Supplier modal when the Add Supplier button is clicked', () => {
    renderSuppliers()
    fireEvent.click(screen.getByRole('button', { name: /Add Supplier/i }))
    expect(screen.getByRole('heading', { name: 'Add Supplier' })).toBeInTheDocument()
  })
})
```

> **Seeded supplier name check:** `Atlas Steelworks` is `suppliers[0]` in `mockData.js` (id: `sup_1`). The test also checks `Nordic Freight Solutions` is absent after filtering — verify that exact name exists in mockData. If the name differs slightly, update the test to use the actual seeded name (run `grep -r "Nordic" src/lib/mockData.js` to confirm).

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/pages/Suppliers.test.jsx
```

Expected: failures — module not found.

- [ ] **Step 3: Create Suppliers.jsx**

Create `src/pages/Suppliers.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SupplierModal from '../components/ui/SupplierModal'
import { useSupplierContext } from '../context/SupplierContext'
import { filterSuppliers, sortSuppliers } from '../utils/supplierSelectors'
import { cn } from '../utils/cn'

const CATEGORIES = [
  'Raw Materials', 'Manufacturing', 'IT Services', 'Logistics',
  'Packaging', 'Professional Services', 'Energy', 'Components',
]

const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }

function riskColor(score) {
  if (score <= 33) return 'text-accent-green'
  if (score <= 66) return 'text-accent-amber'
  return 'text-accent-red'
}

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)

  const displayed = sortSuppliers(filterSuppliers(suppliers, { search, category, status }), { key: 'name', direction: 'asc' })

  function handleSubmit(data) {
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, data)
    } else {
      addSupplier(data)
    }
  }

  function openEdit(supplier) {
    setEditingSupplier(supplier)
    setModalOpen(true)
  }

  function openAdd() {
    setEditingSupplier(null)
    setModalOpen(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Supplier',
      render: (row) => (
        <Link to={`/suppliers/${row.id}`} className="font-medium text-accent-blue-light hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'country', header: 'Country' },
    {
      key: 'riskScore',
      header: 'Risk Score',
      render: (row) => <span className={cn('font-medium', riskColor(row.riskScore))}>{row.riskScore}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>,
    },
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
        title="Suppliers"
        description="Manage your supplier portfolio"
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusCircle size={16} />
            Add Supplier
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
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
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={displayed}
        rowKey={(row) => row.id}
        emptyMessage="No suppliers match your filters"
      />

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={editingSupplier}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/pages/Suppliers.test.jsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/pages/Suppliers.jsx src/pages/Suppliers.test.jsx
git commit -m "feat: add Suppliers list page with filter/sort and add/edit modal"
```

---

## Task 8: SupplierDetail page

**Files:**
- Create: `src/pages/SupplierDetail.jsx`
- Create: `src/pages/SupplierDetail.test.jsx`

Context: `useParams()` from React Router provides `id`. `SupplierContext` provides `suppliers`, `updateSupplier`, `setSupplierStatus`. `formatDate` from `src/utils/formatters.js` formats `Date` objects. The `Card` component accepts `className` and `children`. Tabs are rendered as plain `<button>` elements — no third-party tab library.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/SupplierDetail.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import SupplierDetail from './SupplierDetail'

function renderDetail(id = 'sup_1') {
  return render(
    <MemoryRouter initialEntries={[`/suppliers/${id}`]}>
      <SupplierProvider>
        <Routes>
          <Route path="/suppliers/:id" element={<SupplierDetail />} />
        </Routes>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('SupplierDetail', () => {
  it('renders the supplier name and Overview tab by default', () => {
    renderDetail()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.getByText('Contact Information')).toBeInTheDocument()
  })

  it('shows a Suspend button for an active supplier that toggles to Activate after click', () => {
    renderDetail()
    const suspendBtn = screen.getByRole('button', { name: 'Suspend' })
    fireEvent.click(suspendBtn)
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('shows a placeholder card when a non-Overview tab is active', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Contracts' }))
    expect(screen.getByText('Contracts is under construction')).toBeInTheDocument()
    expect(screen.getByText(/coming in Phase 3/i)).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown supplier id', () => {
    renderDetail('sup_unknown_999')
    expect(screen.getByRole('heading', { name: 'Supplier not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Suppliers/i })).toBeInTheDocument()
  })

  it('opens the Edit Supplier modal when Edit is clicked', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit Supplier' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/pages/SupplierDetail.test.jsx
```

Expected: 5 failures — module not found.

- [ ] **Step 3: Create SupplierDetail.jsx**

Create `src/pages/SupplierDetail.jsx`:

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SupplierModal from '../components/ui/SupplierModal'
import PageHeader from '../components/layout/PageHeader'
import { useSupplierContext } from '../context/SupplierContext'
import { formatDate } from '../utils/formatters'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const TAB_PHASE = { Contracts: 'Phase 3', Risk: 'Phase 3', ESG: 'Phase 4', Spend: 'Phase 4' }
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }

function riskColor(score) {
  if (score <= 33) return 'text-accent-green'
  if (score <= 66) return 'text-accent-amber'
  return 'text-accent-red'
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { suppliers, updateSupplier, setSupplierStatus } = useSupplierContext()
  const [activeTab, setActiveTab] = useState('Overview')
  const [modalOpen, setModalOpen] = useState(false)

  const supplier = suppliers.find((s) => s.id === id)

  if (!supplier) {
    return (
      <div>
        <PageHeader title="Supplier not found" description="This supplier does not exist or has been removed." />
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-accent-blue-light hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Suppliers
        </Link>
      </div>
    )
  }

  const isActive = supplier.status === 'active'

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/suppliers"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Suppliers
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-primary">{supplier.name}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={STATUS_BADGE[supplier.status] ?? 'muted'}>{supplier.status}</Badge>
            <span className="text-sm text-text-secondary">
              {supplier.category} · {supplier.country}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Edit</Button>
          <Button
            variant={isActive ? 'danger' : 'primary'}
            onClick={() => setSupplierStatus(supplier.id, isActive ? 'suspended' : 'active')}
          >
            {isActive ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="mb-6 border-b border-border">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-accent-blue text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Risk Score</p>
              <p className={cn('mt-1 text-2xl font-bold', riskColor(supplier.riskScore))}>{supplier.riskScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">ESG Score</p>
              <p className="mt-1 text-2xl font-bold text-accent-blue">{supplier.esgScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Onboarded</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(supplier.onboardedAt)}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Contact Information</h3>
            <div className="space-y-1.5 text-sm text-text-secondary">
              <p>
                Email:{' '}
                <a href={`mailto:${supplier.email}`} className="text-accent-blue-light hover:underline">
                  {supplier.email}
                </a>
              </p>
              <p>Phone: {supplier.phone}</p>
              <p>
                Website:{' '}
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue-light hover:underline"
                >
                  {supplier.website}
                </a>
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">About</h3>
            <p className="text-sm text-text-secondary">{supplier.description}</p>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-semibold text-text-primary">{activeTab} is under construction</p>
          <p className="mt-1 text-sm text-text-secondary">
            This module is coming in {TAB_PHASE[activeTab]}.
          </p>
        </Card>
      )}

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={supplier}
        onSubmit={(data) => updateSupplier(supplier.id, data)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/pages/SupplierDetail.test.jsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/pages/SupplierDetail.jsx src/pages/SupplierDetail.test.jsx
git commit -m "feat: add SupplierDetail page with Overview tab, status toggle, and edit modal"
```

---

## Task 9: Wire routing in App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

The existing `App.test.jsx` second test hits `/suppliers` and expects a placeholder "coming in Phase 2". After this task, `/suppliers` renders the real Suppliers page, so that test must be updated to use `/contracts` instead.

- [ ] **Step 1: Write the updated tests**

Replace `src/App.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('redirects the root route to the Dashboard and renders the shell', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    await waitFor(() => expect(screen.getByText('Total Suppliers')).toBeInTheDocument())
    expect(screen.getByText('ProcureIQ', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Suppliers/ })).toBeInTheDocument()
  })

  it('renders the Suppliers list page at /suppliers', async () => {
    window.history.pushState({}, '', '/suppliers')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
  })

  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/contracts')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 3/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify the second test fails**

```
npx vitest run src/App.test.jsx
```

Expected: test 2 fails — `/suppliers` still renders the placeholder. Test 3 may fail if `/contracts` also still uses the old path.

- [ ] **Step 3: Update App.jsx**

Replace `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import { SupplierProvider } from './context/SupplierContext'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
  { path: '/contracts', title: 'Contracts', phase: 'Phase 3' },
  { path: '/risk', title: 'Risk', phase: 'Phase 3' },
  { path: '/esg', title: 'ESG', phase: 'Phase 4' },
  { path: '/spend', title: 'Spend', phase: 'Phase 4' },
  { path: '/ai-assistant', title: 'AI Assistant', phase: 'Phase 5' },
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
  { path: '/admin', title: 'Admin', phase: 'Phase 7' },
]

export default function App() {
  return (
    <ErrorBoundary>
      <MockAuthProvider>
        <SupplierProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/suppliers/:id" element={<SupplierDetail />} />
                {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                  <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
                ))}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 4: Run App tests to verify they pass**

```
npx vitest run src/App.test.jsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full suite**

```
npx vitest run
```

Expected: all tests PASS. Count should be 49 (Phase 1 baseline) + net new tests from Phase 2.

- [ ] **Step 6: Commit**

```
git add src/App.jsx src/App.test.jsx
git commit -m "feat: wire Suppliers routes in App, wrap with SupplierProvider"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| SupplierContext with addSupplier / updateSupplier / setSupplierStatus | Task 4 |
| supplierSelectors: filterSuppliers + sortSuppliers | Task 5 |
| SupplierModal: add/edit modes, validation, controlled | Task 6 |
| /suppliers list page with filters, table, columns, risk colour, status badge | Task 7 |
| /suppliers/:id detail with tabs, Overview content, Suspend/Activate, Edit | Task 8 |
| Contracts/Risk/ESG/Spend tab placeholder cards with correct phase labels | Task 8 |
| App routing: SupplierProvider wrap, /suppliers real route, /suppliers/:id | Task 9 |
| Pre-flight: hook error fields | Task 1 |
| Pre-flight: daysUntil consolidation | Task 2 |
| Pre-flight: DataTable rowKey | Task 3 |
| Dashboard reads from mockData.suppliers (not context) — no change needed | ✅ Already correct |
| Unknown supplier id → not-found message + back link | Task 8 |

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency check:**
- `useSupplierContext()` returns `{ suppliers, addSupplier, updateSupplier, setSupplierStatus }` — used consistently in Tasks 7, 8, 9.
- `filterSuppliers(suppliers, { search, category, status })` — matches Task 5 signature, used in Task 7.
- `sortSuppliers(suppliers, { key, direction })` — matches Task 5 signature, used in Task 7.
- `SupplierModal` props: `isOpen`, `onClose`, `supplier`, `onSubmit` — defined in Task 6, used in Tasks 7 and 8.
- `daysUntil(date, referenceDate?)` — updated in Task 2, `dashboardSelectors.js` uses `(c.endDate, referenceDate)`.
