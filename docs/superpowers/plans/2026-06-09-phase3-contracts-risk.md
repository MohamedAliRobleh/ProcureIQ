# Phase 3: Contracts + Risk Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Contracts module (list, slide-over detail, full CRUD) and Risk module (monitoring dashboard), and fill the Contracts + Risk tabs on SupplierDetail.

**Architecture:** ContractContext mirrors SupplierContext exactly — in-memory CRUD seeded from `mockData.contracts`, wrapped in App.jsx. Risk is read-only via the existing `useRisk` hook (150ms simulated async) and a direct import for SupplierDetail. A new ContractSlideOver component provides the right-side drawer with Framer Motion animation.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, Framer Motion, Vitest + React Testing Library, lucide-react, react-router-dom v6.

---

## Scene setting (read before starting)

Key files to understand before touching any task:
- `src/context/SupplierContext.jsx` — mirror this exactly for ContractContext
- `src/components/ui/SupplierModal.jsx` — mirror this for ContractModal (same field/label pattern with `sm-{key}` → `cm-{key}`)
- `src/pages/Suppliers.jsx` — mirror structure for Contracts.jsx
- `src/pages/SupplierDetail.jsx` — you will heavily modify this in Task 9
- `src/lib/mockData.js` — the `contracts` and `riskAssessments` arrays are already seeded; check the field shapes
- `src/utils/formatters.js` — `formatCurrency` and `daysUntil` already exist; `riskColor` does NOT yet exist here (it lives in Suppliers.jsx and SupplierDetail.jsx as a local function — Task 1 extracts it)
- `src/components/ui/Badge.jsx` — already has `purple` variant for critical risk
- `tailwind.config.js` — `accent.purple`, `accent.green`, `accent.amber`, `accent.red` are all configured; `border-l-accent-*` classes are generated automatically

Test runner: `npx vitest run --reporter=verbose`

---

## Task 1: Shared formatters — extract riskColor + add formatCompactCurrency

**Files:**
- Modify: `src/utils/formatters.js`
- Modify: `src/utils/formatters.test.js`
- Modify: `src/pages/Suppliers.jsx`
- Modify: `src/pages/SupplierDetail.jsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/formatters.test.js` (after the existing `timeAgo` describe block):

```js
import { formatCurrency, formatDate, formatPercent, daysUntil, timeAgo, riskColor, formatCompactCurrency } from './formatters'

// ... existing tests unchanged ...

describe('riskColor', () => {
  it('returns green for scores ≤33', () => {
    expect(riskColor(0)).toBe('text-accent-green')
    expect(riskColor(33)).toBe('text-accent-green')
  })
  it('returns amber for scores 34–66', () => {
    expect(riskColor(34)).toBe('text-accent-amber')
    expect(riskColor(66)).toBe('text-accent-amber')
  })
  it('returns red for scores >66', () => {
    expect(riskColor(67)).toBe('text-accent-red')
    expect(riskColor(100)).toBe('text-accent-red')
  })
})

describe('formatCompactCurrency', () => {
  it('formats millions as $X.XM', () => {
    expect(formatCompactCurrency(4200000)).toBe('$4.2M')
  })
  it('formats thousands as $XXXk', () => {
    expect(formatCompactCurrency(637000)).toBe('$637k')
  })
  it('formats small amounts as $X', () => {
    expect(formatCompactCurrency(500)).toBe('$500')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/utils/formatters.test.js --reporter=verbose
```
Expected: FAIL — `riskColor is not a function`, `formatCompactCurrency is not a function`

- [ ] **Step 3: Add riskColor and formatCompactCurrency to formatters.js**

Full updated `src/utils/formatters.js`:

```js
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompactCurrency(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`
  return `$${amount}`
}

export function formatDate(date) {
  const d = new Date(date)
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
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

export function riskColor(score) {
  if (score <= 33) return 'text-accent-green'
  if (score <= 66) return 'text-accent-amber'
  return 'text-accent-red'
}
```

- [ ] **Step 4: Run formatter tests to verify they pass**

```
npx vitest run src/utils/formatters.test.js --reporter=verbose
```
Expected: all PASS

- [ ] **Step 5: Update Suppliers.jsx — remove local riskColor, import from formatters**

In `src/pages/Suppliers.jsx`, replace:
```js
import { cn } from '../utils/cn'

const CATEGORIES = [
```
with:
```js
import { riskColor } from '../utils/formatters'
import { cn } from '../utils/cn'

const CATEGORIES = [
```

Then delete the local `function riskColor(score) { ... }` block (lines 20–24).

- [ ] **Step 6: Update SupplierDetail.jsx — remove local riskColor, import from formatters**

In `src/pages/SupplierDetail.jsx`, replace:
```js
import { formatDate } from '../utils/formatters'
```
with:
```js
import { formatDate, riskColor } from '../utils/formatters'
```

Then delete the local `function riskColor(score) { ... }` block (lines 17–21).

- [ ] **Step 7: Run the full test suite to verify nothing broke**

```
npx vitest run --reporter=verbose
```
Expected: all existing tests PASS (82 total)

- [ ] **Step 8: Commit**

```
git add src/utils/formatters.js src/utils/formatters.test.js src/pages/Suppliers.jsx src/pages/SupplierDetail.jsx
git commit -m "refactor: extract riskColor to formatters, add formatCompactCurrency"
```

---

## Task 2: ContractContext

**Files:**
- Create: `src/context/ContractContext.jsx`
- Create: `src/context/ContractContext.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/context/ContractContext.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ContractProvider, useContractContext } from './ContractContext'
import { contracts as seedContracts } from '../lib/mockData'

const wrapper = ({ children }) => <ContractProvider>{children}</ContractProvider>

describe('ContractContext', () => {
  it('seeds from mockData.contracts on mount', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    expect(result.current.contracts).toHaveLength(seedContracts.length)
    expect(result.current.contracts[0].id).toBe('con_1')
  })

  it('addContract appends a new contract with a generated id', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    act(() => {
      result.current.addContract({
        title: 'New Agreement',
        supplierId: 'sup_1',
        value: 100000,
        currency: 'USD',
        status: 'draft',
        autoRenew: false,
        terms: '',
      })
    })
    expect(result.current.contracts).toHaveLength(seedContracts.length + 1)
    expect(result.current.contracts.at(-1).title).toBe('New Agreement')
    expect(result.current.contracts.at(-1).id).toBeTruthy()
  })

  it('updateContract modifies the matching contract by id', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    const id = result.current.contracts[0].id
    act(() => result.current.updateContract(id, { title: 'Updated Agreement' }))
    expect(result.current.contracts.find((c) => c.id === id).title).toBe('Updated Agreement')
    expect(result.current.contracts).toHaveLength(seedContracts.length)
  })

  it('setContractStatus updates only the status field', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    const id = result.current.contracts[0].id
    const originalTitle = result.current.contracts[0].title
    act(() => result.current.setContractStatus(id, 'expired'))
    expect(result.current.contracts.find((c) => c.id === id).status).toBe('expired')
    expect(result.current.contracts.find((c) => c.id === id).title).toBe(originalTitle)
  })

  it('throws when used outside ContractProvider', () => {
    expect(() => renderHook(() => useContractContext())).toThrow(
      'useContractContext must be used inside ContractProvider'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/context/ContractContext.test.jsx --reporter=verbose
```
Expected: FAIL — `Cannot find module './ContractContext'`

- [ ] **Step 3: Implement ContractContext**

Create `src/context/ContractContext.jsx`:

```jsx
import { createContext, useContext, useState } from 'react'
import { contracts as seedContracts } from '../lib/mockData'

const ContractContext = createContext(null)

export function ContractProvider({ children }) {
  const [contracts, setContracts] = useState(() => seedContracts.map((c) => ({ ...c })))

  function addContract(data) {
    const newContract = {
      ...data,
      id: `con_${Date.now()}`,
      orgId: 'org_demo',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setContracts((prev) => [...prev, newContract])
  }

  function updateContract(id, data) {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date() } : c))
    )
  }

  function setContractStatus(id, status) {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date() } : c))
    )
  }

  return (
    <ContractContext.Provider value={{ contracts, addContract, updateContract, setContractStatus }}>
      {children}
    </ContractContext.Provider>
  )
}

export function useContractContext() {
  const ctx = useContext(ContractContext)
  if (!ctx) throw new Error('useContractContext must be used inside ContractProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/context/ContractContext.test.jsx --reporter=verbose
```
Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```
git add src/context/ContractContext.jsx src/context/ContractContext.test.jsx
git commit -m "feat: add ContractContext with in-memory CRUD operations"
```

---

## Task 3: contractSelectors

**Files:**
- Create: `src/utils/contractSelectors.js`
- Create: `src/utils/contractSelectors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/contractSelectors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { filterContracts, sortContracts } from './contractSelectors'

const contracts = [
  { id: 'c1', title: 'Master Supply Agreement', status: 'active', supplierId: 'sup_1', value: 600000 },
  { id: 'c2', title: 'Logistics Contract', status: 'draft', supplierId: 'sup_2', value: 300000 },
  { id: 'c3', title: 'IT Services Retainer', status: 'expired', supplierId: 'sup_1', value: 450000 },
]

describe('filterContracts', () => {
  it('returns all contracts when no filters are applied', () => {
    expect(filterContracts(contracts)).toHaveLength(3)
  })

  it('filters by title search (case-insensitive)', () => {
    const result = filterContracts(contracts, { search: 'logistics' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c2')
  })

  it('filters by exact status', () => {
    expect(filterContracts(contracts, { status: 'active' })).toHaveLength(1)
  })

  it('filters by supplierId', () => {
    expect(filterContracts(contracts, { supplierId: 'sup_1' })).toHaveLength(2)
  })

  it('applies multiple filters together', () => {
    const result = filterContracts(contracts, { supplierId: 'sup_1', status: 'active' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterContracts(contracts, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortContracts', () => {
  it('sorts by value ascending', () => {
    const result = sortContracts(contracts, { key: 'value', direction: 'asc' })
    expect(result[0].id).toBe('c2')
    expect(result[2].id).toBe('c1')
  })

  it('sorts by value descending', () => {
    const result = sortContracts(contracts, { key: 'value', direction: 'desc' })
    expect(result[0].id).toBe('c1')
  })

  it('does not mutate the input array', () => {
    const firstId = contracts[0].id
    sortContracts(contracts, { key: 'value', direction: 'asc' })
    expect(contracts[0].id).toBe(firstId)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/utils/contractSelectors.test.js --reporter=verbose
```
Expected: FAIL — `Cannot find module './contractSelectors'`

- [ ] **Step 3: Implement contractSelectors**

Create `src/utils/contractSelectors.js`:

```js
export function filterContracts(contracts, { search = '', status = '', supplierId = '' } = {}) {
  return contracts.filter((c) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !status || c.status === status
    const matchesSupplierId = !supplierId || c.supplierId === supplierId
    return matchesSearch && matchesStatus && matchesSupplierId
  })
}

export function sortContracts(contracts, { key = 'title', direction = 'asc' } = {}) {
  return [...contracts].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/utils/contractSelectors.test.js --reporter=verbose
```
Expected: 9/9 PASS

- [ ] **Step 5: Commit**

```
git add src/utils/contractSelectors.js src/utils/contractSelectors.test.js
git commit -m "feat: add filterContracts and sortContracts selectors"
```

---

## Task 4: riskSelectors

**Files:**
- Create: `src/utils/riskSelectors.js`
- Create: `src/utils/riskSelectors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/riskSelectors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { filterRiskAssessments, sortRiskAssessments, RISK_LEVEL_BADGE } from './riskSelectors'

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks' },
  { id: 'sup_2', name: 'Nordic Freight Solutions' },
  { id: 'sup_3', name: 'Quantum IT Partners' },
]

const assessments = [
  { id: 'r1', supplierId: 'sup_1', score: 78, level: 'high' },
  { id: 'r2', supplierId: 'sup_2', score: 22, level: 'low' },
  { id: 'r3', supplierId: 'sup_3', score: 91, level: 'critical' },
]

describe('filterRiskAssessments', () => {
  it('returns all assessments when no filters are applied', () => {
    expect(filterRiskAssessments(assessments, suppliers)).toHaveLength(3)
  })

  it('filters by supplier name search (case-insensitive)', () => {
    const result = filterRiskAssessments(assessments, suppliers, { search: 'atlas' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('filters by exact level', () => {
    expect(filterRiskAssessments(assessments, suppliers, { level: 'low' })).toHaveLength(1)
  })

  it('applies search and level together', () => {
    const result = filterRiskAssessments(assessments, suppliers, { search: 'quantum', level: 'critical' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r3')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterRiskAssessments(assessments, suppliers, { search: 'zzznomatch' })).toHaveLength(0)
  })
})

describe('sortRiskAssessments', () => {
  it('sorts by score descending by default', () => {
    const result = sortRiskAssessments(assessments)
    expect(result[0].id).toBe('r3')
    expect(result[2].id).toBe('r2')
  })

  it('sorts by score ascending', () => {
    const result = sortRiskAssessments(assessments, { key: 'score', direction: 'asc' })
    expect(result[0].id).toBe('r2')
  })

  it('does not mutate the input array', () => {
    const firstId = assessments[0].id
    sortRiskAssessments(assessments)
    expect(assessments[0].id).toBe(firstId)
  })
})

describe('RISK_LEVEL_BADGE', () => {
  it('maps all four levels to badge variants', () => {
    expect(RISK_LEVEL_BADGE.low).toBe('green')
    expect(RISK_LEVEL_BADGE.medium).toBe('amber')
    expect(RISK_LEVEL_BADGE.high).toBe('red')
    expect(RISK_LEVEL_BADGE.critical).toBe('purple')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/utils/riskSelectors.test.js --reporter=verbose
```
Expected: FAIL — `Cannot find module './riskSelectors'`

- [ ] **Step 3: Implement riskSelectors**

Create `src/utils/riskSelectors.js`:

```js
export const RISK_LEVEL_BADGE = {
  low: 'green',
  medium: 'amber',
  high: 'red',
  critical: 'purple',
}

export function filterRiskAssessments(assessments, suppliers, { search = '', level = '' } = {}) {
  return assessments.filter((a) => {
    const supplier = suppliers.find((s) => s.id === a.supplierId)
    const matchesSearch = !search || (supplier && supplier.name.toLowerCase().includes(search.toLowerCase()))
    const matchesLevel = !level || a.level === level
    return matchesSearch && matchesLevel
  })
}

export function sortRiskAssessments(assessments, { key = 'score', direction = 'desc' } = {}) {
  return [...assessments].sort((a, b) => {
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/utils/riskSelectors.test.js --reporter=verbose
```
Expected: 11/11 PASS

- [ ] **Step 5: Commit**

```
git add src/utils/riskSelectors.js src/utils/riskSelectors.test.js
git commit -m "feat: add riskSelectors with RISK_LEVEL_BADGE, filter, and sort functions"
```

---

## Task 5: ContractModal

**Files:**
- Create: `src/components/ui/ContractModal.jsx`
- Create: `src/components/ui/ContractModal.test.jsx`

ContractModal uses `useSupplierContext()` internally to populate the supplier `<select>`. Its tests therefore need a `SupplierProvider` wrapper.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/ContractModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupplierProvider } from '../../context/SupplierContext'
import ContractModal from './ContractModal'

const mockContract = {
  id: 'con_1',
  title: 'Master Supply Agreement',
  supplierId: 'sup_1',
  value: 600000,
  currency: 'USD',
  startDate: new Date('2025-01-12'),
  endDate: new Date('2026-07-22'),
  status: 'active',
  autoRenew: true,
  terms: 'Net-30 payment terms.',
}

function renderModal(props) {
  return render(
    <SupplierProvider>
      <ContractModal {...props} />
    </SupplierProvider>
  )
}

describe('ContractModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false, onClose: () => {}, contract: null, onSubmit: () => {} })
    expect(screen.queryByRole('heading', { name: 'Add Contract' })).not.toBeInTheDocument()
  })

  it('shows "Add Contract" title with empty title field when no contract is provided', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: null, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Add Contract' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contract Title')).toHaveValue('')
  })

  it('shows "Edit Contract" title pre-filled when editing', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: mockContract, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Edit Contract' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contract Title')).toHaveValue('Master Supply Agreement')
  })

  it('shows inline errors and blocks submit when title, supplier, and value are empty', () => {
    const onSubmit = vi.fn()
    renderModal({ isOpen: true, onClose: () => {}, contract: null, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Add Contract' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByText('Supplier is required')).toBeInTheDocument()
    expect(screen.getByText('Value is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose, contract: null, onSubmit })
    fireEvent.change(screen.getByLabelText('Contract Title'), { target: { value: 'New Deal' } })
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'sup_1' } })
    fireEvent.change(screen.getByLabelText('Value (USD)'), { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Contract' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Deal', value: 100000 }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" button in edit mode', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: mockContract, onSubmit: () => {} })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/ui/ContractModal.test.jsx --reporter=verbose
```
Expected: FAIL — `Cannot find module './ContractModal'`

- [ ] **Step 3: Implement ContractModal**

Create `src/components/ui/ContractModal.jsx`:

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useSupplierContext } from '../../context/SupplierContext'

const STATUSES = ['active', 'draft', 'expired']

const EMPTY_FORM = {
  title: '',
  supplierId: '',
  value: '',
  currency: 'USD',
  startDate: '',
  endDate: '',
  status: 'active',
  autoRenew: false,
  terms: '',
}

export default function ContractModal({ isOpen, onClose, contract, onSubmit }) {
  const { suppliers } = useSupplierContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setForm(
      contract
        ? {
            title: contract.title,
            supplierId: contract.supplierId,
            value: String(contract.value),
            currency: contract.currency,
            startDate: contract.startDate
              ? new Date(contract.startDate).toISOString().split('T')[0]
              : '',
            endDate: contract.endDate
              ? new Date(contract.endDate).toISOString().split('T')[0]
              : '',
            status: contract.status,
            autoRenew: contract.autoRenew ?? false,
            terms: contract.terms ?? '',
          }
        : EMPTY_FORM
    )
  }, [isOpen, contract])

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    if (!form.value || isNaN(Number(form.value))) errs.value = 'Value is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit({ ...form, value: Number(form.value) })
    onClose()
  }

  function field(key, label, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`cm-${key}`} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <input
          id={`cm-${key}`}
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
      title={contract ? 'Edit Contract' : 'Add Contract'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {field('title', 'Contract Title')}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="cm-supplierId" className="text-xs font-medium text-text-secondary">
              Supplier
            </label>
            <select
              id="cm-supplierId"
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
            <label htmlFor="cm-status" className="text-xs font-medium text-text-secondary">
              Status
            </label>
            <select
              id="cm-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {field('value', 'Value (USD)', 'number')}
          {field('currency', 'Currency')}
          {field('startDate', 'Start Date', 'date')}
          {field('endDate', 'End Date', 'date')}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="cm-autoRenew"
            type="checkbox"
            checked={form.autoRenew}
            onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))}
            className="h-4 w-4 rounded border-border bg-bg-primary"
          />
          <label htmlFor="cm-autoRenew" className="text-sm text-text-secondary">
            Auto-renew
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cm-terms" className="text-xs font-medium text-text-secondary">
            Terms
          </label>
          <textarea
            id="cm-terms"
            value={form.terms}
            onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
            rows={3}
            className="resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {contract ? 'Save Changes' : 'Add Contract'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/ui/ContractModal.test.jsx --reporter=verbose
```
Expected: 6/6 PASS

- [ ] **Step 5: Commit**

```
git add src/components/ui/ContractModal.jsx src/components/ui/ContractModal.test.jsx
git commit -m "feat: add ContractModal with add/edit modes and client-side validation"
```

---

## Task 6: ContractSlideOver

**Files:**
- Create: `src/components/ui/ContractSlideOver.jsx`
- Create: `src/components/ui/ContractSlideOver.test.jsx`

ContractSlideOver receives a resolved `supplier` object as a prop (no context dep), making it independently testable. It registers a `keydown` listener on `window` for Escape — tests fire `fireEvent.keyDown(document, { key: 'Escape' })`. The overlay div has `data-testid="contract-slide-overlay"` for reliable click testing.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/ContractSlideOver.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContractSlideOver from './ContractSlideOver'

const mockContract = {
  id: 'con_1',
  title: 'Master Supply Agreement',
  supplierId: 'sup_1',
  value: 600000,
  currency: 'USD',
  startDate: new Date('2025-01-12'),
  endDate: new Date('2026-07-22'),
  status: 'active',
  autoRenew: true,
  terms: 'Net-30 payment terms.',
}

const mockSupplier = { id: 'sup_1', name: 'Atlas Steelworks' }

function renderSlideOver(props) {
  return render(
    <MemoryRouter>
      <ContractSlideOver {...props} />
    </MemoryRouter>
  )
}

describe('ContractSlideOver', () => {
  it('renders nothing when closed', () => {
    renderSlideOver({
      isOpen: false,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.queryByText('Master Supply Agreement')).not.toBeInTheDocument()
  })

  it('shows contract title and supplier name when open', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.getByText('Master Supply Agreement')).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('calls onEdit when Edit Contract button is clicked', () => {
    const onEdit = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Contract' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.click(screen.getByTestId('contract-slide-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/ui/ContractSlideOver.test.jsx --reporter=verbose
```
Expected: FAIL — `Cannot find module './ContractSlideOver'`

- [ ] **Step 3: Implement ContractSlideOver**

Create `src/components/ui/ContractSlideOver.jsx`:

```jsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import { formatCurrency, formatDate, daysUntil } from '../../utils/formatters'
import { RISK_LEVEL_BADGE } from '../../utils/riskSelectors'
import { cn } from '../../utils/cn'

const CONTRACT_STATUS_BADGE = { active: 'green', draft: 'amber', expired: 'red' }

export default function ContractSlideOver({ isOpen, onClose, contract, supplier, onEdit }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!contract) return null

  const days = contract.endDate ? daysUntil(contract.endDate) : null
  const expiryClass =
    days === null
      ? 'text-text-primary'
      : days < 0
      ? 'text-accent-red'
      : days <= 30
      ? 'text-accent-amber'
      : 'text-text-primary'
  const expiryLabel =
    days === null ? '—' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="contract-slide-overlay"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-bg-card shadow-2xl"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">{contract.title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="flex items-center gap-3">
                <Badge variant={CONTRACT_STATUS_BADGE[contract.status] ?? 'muted'}>
                  {contract.status}
                </Badge>
                {supplier && (
                  <Link
                    to={`/suppliers/${supplier.id}`}
                    className="text-sm text-accent-blue-light hover:underline"
                  >
                    {supplier.name}
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-secondary p-3">
                  <p className="text-xs text-text-secondary">Value</p>
                  <p className="mt-1 text-base font-semibold text-text-primary">
                    {formatCurrency(contract.value, contract.currency)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-secondary p-3">
                  <p className="text-xs text-text-secondary">Expires</p>
                  <p className={cn('mt-1 text-base font-semibold', expiryClass)}>{expiryLabel}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-text-secondary">
                {contract.startDate && (
                  <p>
                    Start:{' '}
                    <span className="text-text-primary">{formatDate(contract.startDate)}</span>
                  </p>
                )}
                {contract.endDate && (
                  <p>
                    End:{' '}
                    <span className="text-text-primary">{formatDate(contract.endDate)}</span>
                  </p>
                )}
                {contract.autoRenew && (
                  <span className="inline-block rounded-full bg-accent-blue/10 px-2 py-0.5 text-xs text-accent-blue-light">
                    Auto-renew
                  </span>
                )}
              </div>

              {contract.terms && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Terms</p>
                  <p className="text-sm text-text-primary">{contract.terms}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={onEdit}>
                Edit Contract
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/ui/ContractSlideOver.test.jsx --reporter=verbose
```
Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```
git add src/components/ui/ContractSlideOver.jsx src/components/ui/ContractSlideOver.test.jsx
git commit -m "feat: add ContractSlideOver right-side drawer with Framer Motion animation"
```

---

## Task 7: Contracts page

**Files:**
- Create: `src/pages/Contracts.jsx`
- Create: `src/pages/Contracts.test.jsx`

The stat card for "Total Value" sums active contracts only. The `Expiring <30d` count uses `daysUntil` with no reference date (uses current time). The Supplier `<select>` in the filter bar lists supplier names from `useSupplierContext()`.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Contracts.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import Contracts from './Contracts'

function renderContracts() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <ContractProvider>
          <Contracts />
        </ContractProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Contracts', () => {
  it('renders page heading and at least one seeded contract', () => {
    renderContracts()
    expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument()
    expect(screen.getByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
  })

  it('renders 4 stat cards with labelled headings', () => {
    renderContracts()
    expect(screen.getByText('Total Value')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Expiring <30d')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('filters contracts by search text', () => {
    renderContracts()
    fireEvent.change(screen.getByPlaceholderText('Search contracts...'), {
      target: { value: 'Master Supply' },
    })
    expect(screen.getByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Annual Logistics Contract — Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('opens the ContractSlideOver when a contract title is clicked', () => {
    renderContracts()
    fireEvent.click(screen.getByText('Master Supply Agreement — Atlas Steelworks'))
    expect(screen.getByRole('heading', { level: 2, name: 'Master Supply Agreement — Atlas Steelworks' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/pages/Contracts.test.jsx --reporter=verbose
```
Expected: FAIL — `Cannot find module './Contracts'`

- [ ] **Step 3: Implement Contracts page**

Create `src/pages/Contracts.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ContractModal from '../components/ui/ContractModal'
import ContractSlideOver from '../components/ui/ContractSlideOver'
import { useContractContext } from '../context/ContractContext'
import { useSupplierContext } from '../context/SupplierContext'
import { filterContracts, sortContracts } from '../utils/contractSelectors'
import { formatCurrency, formatCompactCurrency, daysUntil } from '../utils/formatters'
import { cn } from '../utils/cn'

const CONTRACT_STATUS_BADGE = { active: 'green', draft: 'amber', expired: 'red' }

export default function Contracts() {
  const { contracts, addContract, updateContract } = useContractContext()
  const { suppliers } = useSupplierContext()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)

  const displayed = sortContracts(filterContracts(contracts, { search, status, supplierId }), {
    key: 'title',
    direction: 'asc',
  })

  const activeContracts = contracts.filter((c) => c.status === 'active')
  const totalValue = activeContracts.reduce((sum, c) => sum + c.value, 0)
  const expiringSoon = activeContracts.filter((c) => {
    const d = daysUntil(c.endDate)
    return d >= 0 && d <= 30
  }).length
  const expiredCount = contracts.filter((c) => c.status === 'expired').length

  function openAdd() {
    setEditingContract(null)
    setModalOpen(true)
  }

  function openEdit(contract) {
    setEditingContract(contract)
    setSlideOverOpen(false)
    setModalOpen(true)
  }

  function openSlideOver(contract) {
    setSelectedContract(contract)
    setSlideOverOpen(true)
  }

  function handleSubmit(data) {
    if (editingContract) {
      updateContract(editingContract.id, data)
    } else {
      addContract(data)
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Contract',
      render: (row) => (
        <button
          onClick={() => openSlideOver(row)}
          className="text-left font-medium text-accent-blue-light hover:underline"
        >
          {row.title}
        </button>
      ),
    },
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
    {
      key: 'value',
      header: 'Value',
      render: (row) => formatCurrency(row.value, row.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={CONTRACT_STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>
      ),
    },
    {
      key: 'endDate',
      header: 'Expires',
      render: (row) => {
        const d = daysUntil(row.endDate)
        const cls =
          d < 0 ? 'text-accent-red' : d <= 30 ? 'text-accent-amber' : 'text-text-primary'
        return (
          <span className={cn('font-medium', cls)}>
            {d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}
          </span>
        )
      },
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
        title="Contracts"
        description="Manage your supplier contracts"
        actions={
          <Button variant="primary" onClick={openAdd}>
            <PlusCircle size={16} />
            Add Contract
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Total Value</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{formatCompactCurrency(totalValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Active</p>
          <p className="mt-1 text-xl font-bold text-accent-green">{activeContracts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Expiring &lt;30d</p>
          <p className="mt-1 text-xl font-bold text-accent-amber">{expiringSoon}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">Expired</p>
          <p className="mt-1 text-xl font-bold text-accent-red">{expiredCount}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search contracts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="expired">Expired</option>
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
        emptyMessage="No contracts match your filters"
      />

      <ContractSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        contract={selectedContract}
        supplier={selectedContract ? suppliers.find((s) => s.id === selectedContract.supplierId) : null}
        onEdit={() => openEdit(selectedContract)}
      />

      <ContractModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contract={editingContract}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/pages/Contracts.test.jsx --reporter=verbose
```
Expected: 4/4 PASS

- [ ] **Step 5: Commit**

```
git add src/pages/Contracts.jsx src/pages/Contracts.test.jsx
git commit -m "feat: add Contracts list page with stat cards, filters, and slide-over"
```

---

## Task 8: Risk page

**Files:**
- Create: `src/pages/Risk.jsx`
- Create: `src/pages/Risk.test.jsx`

`useRisk()` has a 150ms async delay. Tests use `waitFor` / `findBy*` to handle it (same pattern as `Dashboard.test.jsx`). The table rows join `riskAssessments` with `mockData.suppliers` to resolve supplier names.

From `mockData.js`, the risk level distribution across 20 suppliers:
- score < 30 → low; score 30–54 → medium; score 55–79 → high; score ≥ 80 → critical

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Risk.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Risk from './Risk'

function renderRisk() {
  return render(
    <MemoryRouter>
      <Risk />
    </MemoryRouter>
  )
}

describe('Risk', () => {
  it('shows 4 risk level summary cards after loading', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getByText('Low')).toBeInTheDocument())
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders supplier names in the table after loading', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
  })

  it('filters the table by supplier name search', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'atlas' },
    })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/pages/Risk.test.jsx --reporter=verbose
```
Expected: FAIL — `Cannot find module './Risk'`

- [ ] **Step 3: Implement Risk page**

Create `src/pages/Risk.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { useRisk } from '../hooks/useRisk'
import { suppliers } from '../lib/mockData'
import { filterRiskAssessments, sortRiskAssessments, RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { riskColor } from '../utils/formatters'
import { cn } from '../utils/cn'

export default function Risk() {
  const { riskAssessments, isLoading } = useRisk()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')

  const allAssessments = riskAssessments ?? []

  const lowCount = allAssessments.filter((a) => a.level === 'low').length
  const mediumCount = allAssessments.filter((a) => a.level === 'medium').length
  const highCount = allAssessments.filter((a) => a.level === 'high').length
  const criticalCount = allAssessments.filter((a) => a.level === 'critical').length

  const filtered = sortRiskAssessments(
    filterRiskAssessments(allAssessments, suppliers, { search, level }),
    { key: 'score', direction: 'desc' }
  )

  const rows = filtered
    .map((a) => ({ ...a, supplier: suppliers.find((s) => s.id === a.supplierId) }))
    .filter((r) => r.supplier)

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
      key: 'level',
      header: 'Level',
      render: (row) => (
        <Badge variant={RISK_LEVEL_BADGE[row.level] ?? 'muted'}>{row.level}</Badge>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) => <span className={cn('font-bold', riskColor(row.score))}>{row.score}</span>,
    },
    { key: 'financialRisk', header: 'Financial' },
    { key: 'complianceRisk', header: 'Compliance' },
    { key: 'operationalRisk', header: 'Operational' },
    { key: 'geopoliticalRisk', header: 'Geopolitical' },
  ]

  return (
    <div>
      <PageHeader title="Risk" description="Supplier risk monitoring" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-accent-green p-4">
          <p className="text-xs text-text-secondary">Low</p>
          <p className="mt-1 text-2xl font-bold text-accent-green">{lowCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-amber p-4">
          <p className="text-xs text-text-secondary">Medium</p>
          <p className="mt-1 text-2xl font-bold text-accent-amber">{mediumCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-red p-4">
          <p className="text-xs text-text-secondary">High</p>
          <p className="mt-1 text-2xl font-bold text-accent-red">{highCount}</p>
        </Card>
        <Card className="border-l-4 border-l-accent-purple p-4">
          <p className="text-xs text-text-secondary">Critical</p>
          <p className="mt-1 text-2xl font-bold text-accent-purple">{criticalCount}</p>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-text-primary">Supplier Risk Assessments</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
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

```
npx vitest run src/pages/Risk.test.jsx --reporter=verbose
```
Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```
git add src/pages/Risk.jsx src/pages/Risk.test.jsx
git commit -m "feat: add Risk dashboard page with level summary cards and filterable table"
```

---

## Task 9: SupplierDetail tab upgrades + App wiring

**Files:**
- Modify: `src/pages/SupplierDetail.jsx` — fill Contracts + Risk tabs, remove their placeholders
- Modify: `src/pages/SupplierDetail.test.jsx` — update placeholder test, add Contracts + Risk tab tests
- Modify: `src/App.jsx` — add ContractProvider, replace `/contracts` + `/risk` placeholder routes
- Modify: `src/App.test.jsx` — update `/contracts` test to expect real page, update placeholder test to `/esg`

**Context for SupplierDetail changes:**
- `TAB_PHASE` only needs ESG and Spend now (Contracts + Risk are built)
- Import `useContractContext`, `filterContracts`, `ContractModal`, `ContractSlideOver` from their new files
- Import `riskAssessments` directly from `mockData` (read-only, no hook needed)
- Import `RISK_LEVEL_BADGE` from `riskSelectors`
- `riskColor` is now imported from `formatters` (already done in Task 1)
- The existing placeholder test checks "Contracts is under construction" — replace it with a test that the Contracts tab shows real contract data

**mockData fact for tests:** `sup_1` (Atlas Steelworks) has contract `con_1` titled `"Master Supply Agreement — Atlas Steelworks"` and risk assessment `risk_1` with `level: 'low'` and `financialRisk: 5`.

- [ ] **Step 1: Write the failing tests for SupplierDetail**

Replace `src/pages/SupplierDetail.test.jsx` entirely:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import SupplierDetail from './SupplierDetail'

function renderDetail(id = 'sup_1') {
  return render(
    <MemoryRouter initialEntries={[`/suppliers/${id}`]}>
      <SupplierProvider>
        <ContractProvider>
          <Routes>
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
          </Routes>
        </ContractProvider>
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

  it('Contracts tab shows the supplier contracts table', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Contracts' }))
    expect(screen.getByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
  })

  it('Risk tab shows sub-score cards for the supplier', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Risk' }))
    expect(screen.getByText('Financial Risk')).toBeInTheDocument()
    expect(screen.getByText('Compliance Risk')).toBeInTheDocument()
    expect(screen.getByText('Operational Risk')).toBeInTheDocument()
    expect(screen.getByText('Geopolitical Risk')).toBeInTheDocument()
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
npx vitest run src/pages/SupplierDetail.test.jsx --reporter=verbose
```
Expected: "Contracts tab" and "Risk tab" tests FAIL (still showing placeholder); others still PASS

- [ ] **Step 3: Rewrite SupplierDetail.jsx**

Full replacement of `src/pages/SupplierDetail.jsx`:

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
import { filterContracts } from '../utils/contractSelectors'
import { RISK_LEVEL_BADGE } from '../utils/riskSelectors'
import { riskAssessments } from '../lib/mockData'
import { cn } from '../utils/cn'

const TABS = ['Overview', 'Contracts', 'Risk', 'ESG', 'Spend']
const TAB_PHASE = { ESG: 'Phase 4', Spend: 'Phase 4' }
const STATUS_BADGE = { active: 'green', pending: 'amber', suspended: 'red' }
const CONTRACT_STATUS_BADGE = { active: 'green', draft: 'amber', expired: 'red' }

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
  const supplierContracts = filterContracts(contracts, { supplierId: supplier.id })
  const riskAssessment = riskAssessments.find((a) => a.supplierId === supplier.id)

  function openAddContract() {
    setEditingContract(null)
    setContractModalOpen(true)
  }

  function openEditContract(contract) {
    setEditingContract(contract)
    setContractSlideOpen(false)
    setContractModalOpen(true)
  }

  function openContractSlideOver(contract) {
    setSelectedContract(contract)
    setContractSlideOpen(true)
  }

  function handleContractSubmit(data) {
    if (editingContract) {
      updateContract(editingContract.id, data)
    } else {
      addContract({ ...data, supplierId: supplier.id })
    }
  }

  const contractColumns = [
    {
      key: 'title',
      header: 'Contract',
      render: (row) => (
        <button
          onClick={() => openContractSlideOver(row)}
          className="text-left font-medium text-accent-blue-light hover:underline"
        >
          {row.title}
        </button>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (row) => formatCurrency(row.value, row.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={CONTRACT_STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>
      ),
    },
    {
      key: 'endDate',
      header: 'Expires',
      render: (row) => {
        const d = daysUntil(row.endDate)
        const cls = d < 0 ? 'text-accent-red' : d <= 30 ? 'text-accent-amber' : 'text-text-primary'
        return (
          <span className={cn('font-medium', cls)}>
            {d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}
          </span>
        )
      },
    },
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
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <Button variant="ghost" onClick={openAddContract}>
            Add Contract
          </Button>
        </div>
        <DataTable
          columns={contractColumns}
          data={supplierContracts}
          rowKey={(row) => row.id}
          emptyMessage="No contracts for this supplier"
        />
        <ContractSlideOver
          isOpen={contractSlideOpen}
          onClose={() => setContractSlideOpen(false)}
          contract={selectedContract}
          supplier={supplier}
          onEdit={() => openEditContract(selectedContract)}
        />
        <ContractModal
          isOpen={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          contract={editingContract}
          onSubmit={handleContractSubmit}
        />
      </div>
    )
  }

  function renderRiskTab() {
    if (!riskAssessment) {
      return (
        <Card className="p-6 text-center">
          <p className="text-sm text-text-secondary">No risk assessment available</p>
        </Card>
      )
    }
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
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Edit
          </Button>
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
              <p className={cn('mt-1 text-2xl font-bold', riskColor(supplier.riskScore))}>
                {supplier.riskScore}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">ESG Score</p>
              <p className="mt-1 text-2xl font-bold text-accent-blue">{supplier.esgScore}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-text-secondary">Onboarded</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {formatDate(supplier.onboardedAt)}
              </p>
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
              {supplier.website && (
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
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">About</h3>
            <p className="text-sm text-text-secondary">{supplier.description}</p>
          </Card>
        </div>
      ) : activeTab === 'Contracts' ? (
        renderContractsTab()
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

- [ ] **Step 4: Run SupplierDetail tests to verify they pass**

```
npx vitest run src/pages/SupplierDetail.test.jsx --reporter=verbose
```
Expected: 6/6 PASS

- [ ] **Step 5: Update App.jsx**

Full replacement of `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import { SupplierProvider } from './context/SupplierContext'
import { ContractProvider } from './context/ContractContext'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
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
          <ContractProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/suppliers/:id" element={<SupplierDetail />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/risk" element={<Risk />} />
                  {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                    <Route
                      key={path}
                      path={path}
                      element={<PlaceholderPage title={title} phase={phase} />}
                    />
                  ))}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ContractProvider>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 6: Update App.test.jsx**

Full replacement of `src/App.test.jsx`:

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

  it('renders the Contracts list page at /contracts', async () => {
    window.history.pushState({}, '', '/contracts')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search contracts...')).toBeInTheDocument()
  })

  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/esg')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ESG' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 4/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run the full test suite**

```
npx vitest run --reporter=verbose
```
Expected: all tests PASS. Count should be ≥ 105 (82 existing + ~23 new).

- [ ] **Step 8: Commit**

```
git add src/pages/SupplierDetail.jsx src/pages/SupplierDetail.test.jsx src/App.jsx src/App.test.jsx
git commit -m "feat: fill Contracts + Risk tabs in SupplierDetail, wire routes in App"
```
