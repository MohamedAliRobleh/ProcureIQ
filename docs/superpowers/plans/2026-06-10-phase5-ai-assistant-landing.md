# Phase 5: AI Assistant + Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/ai-assistant` chat page with a deterministic, data-backed mock AI engine, and the public landing page at `/`.

**Architecture:** A pure-function `assistantEngine.js` matches keyword intents and computes answers from data passed in as arguments (reusing existing selectors/formatters). A small `ChatContext` holds the message list and simulates a 600ms "thinking" delay, nesting innermost in the provider stack so it reads live data from the Supplier/Contract/Spend contexts (risk + ESG come from mockData, matching their read-only pattern). The landing page renders at `/` outside AppShell; the old index→dashboard redirect goes away. Phase 6 swaps the engine internals for the Anthropic API behind the same `getAssistantReply` signature.

**Tech Stack:** Vite + React 19, React Router v7, Tailwind CSS v3, lucide-react, Vitest + React Testing Library + jsdom (`npm test` = `vitest run`).

---

## Scene setting (read before starting)

Key files to understand before touching any task:
- `src/context/ContractContext.jsx` — the established context pattern (ChatContext follows it, with timers added)
- `src/lib/mockData.js` — data shapes; note `riskAssessments` and `esgResponses` are read-only module-level arrays, while suppliers/contracts/spendRecords live in contexts
- `src/utils/formatters.js` — `formatCurrency`, `formatCompactCurrency`, `daysUntil` already exist
- `src/utils/esgSelectors.js` — `esgRating`, `ESG_RATING_LABEL`
- `src/utils/dashboardSelectors.js` — `getSpendByCategory`, `getAverageRiskScore`
- `src/utils/constants.js` — `NAV_ITEMS` (icons reused by the landing page)
- `src/App.jsx` — current provider stack `Supplier > Contract > Spend`; `/ai-assistant` is currently a `PlaceholderPage` route

**mockData facts used by tests:** the highest-risk supplier is **Pacific Rim Logistics** (risk score 78, level `high`). The greeting text below includes "ProcureIQ assistant" which appears nowhere else on the page.

Test runner: `npm test -- <file>` (vitest run).

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `src/lib/assistantEngine.js` | Create | Pure intent-matching reply engine |
| `src/lib/assistantEngine.test.js` | Create | Fixture-based unit tests per intent |
| `src/context/ChatContext.jsx` | Create | Message list + sendMessage with simulated delay |
| `src/context/ChatContext.test.jsx` | Create | Seed/send/reply/clear/throws tests |
| `src/pages/AIAssistant.jsx` | Create | `/ai-assistant` chat page |
| `src/pages/AIAssistant.test.jsx` | Create | Page tests |
| `src/pages/Landing.jsx` | Create | Public landing page at `/` |
| `src/pages/Landing.test.jsx` | Create | Hero/CTA/module-card tests |
| `src/App.jsx` | Modify | ChatProvider, Landing at `/`, real `/ai-assistant` route |
| `src/App.test.jsx` | Modify | Landing + AI Assistant route tests, placeholder test → `/portal` |

---

### Task 1: assistantEngine

**Files:**
- Create: `src/lib/assistantEngine.js`
- Create: `src/lib/assistantEngine.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/assistantEngine.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { getAssistantReply } from './assistantEngine'

function daysFromNow(days) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active' },
  { id: 'sup_2', name: 'Nordic Freight Solutions', category: 'Logistics', country: 'Germany', status: 'active' },
  { id: 'sup_3', name: 'Quantum IT Partners', category: 'IT Services', country: 'Japan', status: 'pending' },
]

const riskAssessments = [
  { id: 'r1', supplierId: 'sup_1', score: 20, level: 'low' },
  { id: 'r2', supplierId: 'sup_2', score: 85, level: 'critical' },
  { id: 'r3', supplierId: 'sup_3', score: 55, level: 'high' },
]

const esgResponses = [
  { id: 'e1', supplierId: 'sup_1', score: 80 },
  { id: 'e2', supplierId: 'sup_2', score: 20 },
  { id: 'e3', supplierId: 'sup_3', score: 50 },
]

const contracts = [
  { id: 'c1', supplierId: 'sup_1', title: 'Master Supply Agreement', status: 'active', endDate: daysFromNow(10) },
  { id: 'c2', supplierId: 'sup_2', title: 'Logistics Contract', status: 'active', endDate: daysFromNow(200) },
  { id: 'c3', supplierId: 'sup_1', title: 'Old Deal', status: 'expired', endDate: daysFromNow(-50) },
]

const now = new Date()
const spendRecords = [
  // 5th of the current month — always "this month" no matter what day the suite runs
  { id: 's1', supplierId: 'sup_1', amount: 1000, category: 'Raw Materials', date: new Date(now.getFullYear(), now.getMonth(), 5) },
  { id: 's2', supplierId: 'sup_2', amount: 3000, category: 'Logistics', date: daysFromNow(-95) },
]

const data = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }

describe('getAssistantReply', () => {
  it('answers help questions with a capability list', () => {
    const { text } = getAssistantReply('What can you do?', data)
    expect(text).toContain('portfolio overview')
    expect(text).toContain('riskiest')
  })

  it('returns the riskiest suppliers sorted by score descending', () => {
    const { text } = getAssistantReply('Which suppliers are riskiest?', data)
    expect(text).toContain('Nordic Freight Solutions — risk score 85 (critical)')
    expect(text).toContain('Quantum IT Partners — risk score 55 (high)')
    expect(text.indexOf('Nordic Freight Solutions')).toBeLessThan(text.indexOf('Quantum IT Partners'))
  })

  it('answers spend questions with total, this month, and top category', () => {
    const { text } = getAssistantReply('How much have we spent this month?', data)
    expect(text).toContain('$4k')
    expect(text).toContain('$1k')
    expect(text).toContain('Logistics')
  })

  it('lists active contracts expiring within 60 days', () => {
    const { text } = getAssistantReply('Which contracts expire soon?', data)
    expect(text).toContain('2 active contracts')
    expect(text).toContain('Master Supply Agreement')
    expect(text).not.toContain('Logistics Contract —')
    expect(text).not.toContain('Old Deal')
  })

  it('reports no expirations when nothing ends within 60 days', () => {
    const farOut = { ...data, contracts: [{ id: 'c9', supplierId: 'sup_1', title: 'Far Deal', status: 'active', endDate: daysFromNow(300) }] }
    const { text } = getAssistantReply('any contract renewals coming up?', farOut)
    expect(text).toContain('none expiring')
  })

  it('answers ESG questions with portfolio average and laggards', () => {
    const { text } = getAssistantReply('Who are our ESG laggards?', data)
    expect(text).toContain('50')
    expect(text).toContain('Nordic Freight Solutions')
    expect(text).not.toContain('Atlas Steelworks')
  })

  it('answers overview questions with portfolio counts', () => {
    const { text } = getAssistantReply('Give me a portfolio overview', data)
    expect(text).toContain('3 suppliers')
    expect(text).toContain('2 active')
    expect(text).toContain('3 contracts')
    expect(text).toContain('$4k')
    expect(text).toContain('53')
  })

  it('returns a supplier snapshot when the message names a supplier (case-insensitive)', () => {
    const { text } = getAssistantReply('tell me about ATLAS STEELWORKS', data)
    expect(text).toContain('Atlas Steelworks')
    expect(text).toContain('Risk: 20 (low)')
    expect(text).toContain('ESG: 80 (Strong)')
    expect(text).toContain('Contracts: 2')
    expect(text).toContain('$1,000')
  })

  it('prefers the supplier snapshot over topic intents', () => {
    const { text } = getAssistantReply("what's the risk for Atlas Steelworks?", data)
    expect(text).toContain('Risk: 20 (low)')
    expect(text).not.toContain('Nordic Freight Solutions')
  })

  it('falls back politely for unrecognized questions', () => {
    const { text } = getAssistantReply('what is the weather today?', data)
    expect(text).toContain("I'm not sure")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/assistantEngine.test.js`
Expected: FAIL — cannot find module `./assistantEngine`

- [ ] **Step 3: Implement the engine**

Create `src/lib/assistantEngine.js`:

```js
import { daysUntil, formatCurrency, formatCompactCurrency } from '../utils/formatters'
import { esgRating, ESG_RATING_LABEL } from '../utils/esgSelectors'
import { getSpendByCategory, getAverageRiskScore } from '../utils/dashboardSelectors'

const HELP_TEXT = [
  'I can answer questions about your procurement data. Try:',
  '• "Which suppliers are riskiest?"',
  '• "How much have we spent this month?"',
  '• "Which contracts expire soon?"',
  '• "Who are our ESG laggards?"',
  '• "Give me a portfolio overview"',
  'You can also ask about any supplier by name.',
].join('\n')

const FALLBACK_TEXT =
  "I'm not sure how to answer that yet. Try asking about supplier risk, spend, expiring contracts, ESG performance, or a specific supplier by name."

function supplierSnapshot(supplier, { contracts, riskAssessments, esgResponses, spendRecords }) {
  const risk = riskAssessments.find((r) => r.supplierId === supplier.id)
  const esg = esgResponses.find((r) => r.supplierId === supplier.id)
  const supplierContracts = contracts.filter((c) => c.supplierId === supplier.id)
  const totalSpend = spendRecords
    .filter((r) => r.supplierId === supplier.id)
    .reduce((sum, r) => sum + r.amount, 0)
  return [
    `${supplier.name} (${supplier.category}, ${supplier.country}) — status: ${supplier.status}.`,
    risk ? `Risk: ${risk.score} (${risk.level})` : 'Risk: no assessment on file',
    esg ? `ESG: ${esg.score} (${ESG_RATING_LABEL[esgRating(esg.score)]})` : 'ESG: no response on file',
    `Contracts: ${supplierContracts.length}`,
    `Total spend: ${formatCurrency(totalSpend)}`,
  ].join('\n')
}

function riskiestSuppliers({ suppliers, riskAssessments }) {
  const top = [...riskAssessments].sort((a, b) => b.score - a.score).slice(0, 3)
  const lines = top.map((a, i) => {
    const supplier = suppliers.find((s) => s.id === a.supplierId)
    return `${i + 1}. ${supplier ? supplier.name : a.supplierId} — risk score ${a.score} (${a.level})`
  })
  return `Your highest-risk suppliers right now:\n${lines.join('\n')}`
}

function spendSummary({ spendRecords }) {
  const total = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const now = new Date()
  const thisMonth = spendRecords
    .filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const byCategory = getSpendByCategory(spendRecords)
  const top = byCategory.length
    ? byCategory.reduce((best, c) => (c.amount > best.amount ? c : best))
    : null
  const topText = top ? `Your top category is ${top.category} at ${formatCompactCurrency(top.amount)}.` : ''
  return `Total tracked spend is ${formatCompactCurrency(total)}, including ${formatCompactCurrency(thisMonth)} this month. ${topText}`.trim()
}

function expiringContracts({ contracts }) {
  const active = contracts.filter((c) => c.status === 'active')
  const expiring = active
    .map((c) => ({ title: c.title, days: daysUntil(c.endDate) }))
    .filter((c) => c.days >= 0 && c.days <= 60)
    .sort((a, b) => a.days - b.days)
  if (expiring.length === 0) {
    return `You have ${active.length} active contracts and none expiring in the next 60 days.`
  }
  const lines = expiring.map((c) => `• ${c.title} — ${c.days}d left`)
  return `You have ${active.length} active contracts. Expiring within 60 days:\n${lines.join('\n')}`
}

function esgLaggards({ suppliers, esgResponses }) {
  const average = esgResponses.length
    ? Math.round(esgResponses.reduce((sum, r) => sum + r.score, 0) / esgResponses.length)
    : 0
  const laggards = esgResponses
    .filter((r) => esgRating(r.score) === 'needs-improvement')
    .map((r) => suppliers.find((s) => s.id === r.supplierId))
    .filter(Boolean)
  if (laggards.length === 0) {
    return `Portfolio ESG average is ${average}. No suppliers are currently rated Needs Improvement.`
  }
  const lines = laggards.map((s) => `• ${s.name}`)
  return `Portfolio ESG average is ${average}. ${laggards.length} supplier${laggards.length > 1 ? 's are' : ' is'} rated Needs Improvement:\n${lines.join('\n')}`
}

function portfolioOverview({ suppliers, contracts, riskAssessments, spendRecords }) {
  const activeSuppliers = suppliers.filter((s) => s.status === 'active').length
  const totalSpend = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const averageRisk = getAverageRiskScore(riskAssessments)
  return `You're tracking ${suppliers.length} suppliers (${activeSuppliers} active), ${contracts.length} contracts, and ${formatCompactCurrency(totalSpend)} in spend. Average risk score is ${averageRisk}.`
}

export function getAssistantReply(message, data) {
  const q = message.toLowerCase()

  if (q.includes('help') || q.includes('what can you')) return { text: HELP_TEXT }

  const supplier = data.suppliers.find((s) => q.includes(s.name.toLowerCase()))
  if (supplier) return { text: supplierSnapshot(supplier, data) }

  if (q.includes('risk')) return { text: riskiestSuppliers(data) }
  if (q.includes('spend') || q.includes('spent')) return { text: spendSummary(data) }
  if (q.includes('contract') || q.includes('expir') || q.includes('renew')) return { text: expiringContracts(data) }
  if (q.includes('esg') || q.includes('sustainab')) return { text: esgLaggards(data) }
  if (q.includes('how many') || q.includes('overview') || q.includes('summary')) return { text: portfolioOverview(data) }

  return { text: FALLBACK_TEXT }
}
```

Note the spend trigger checks both `'spend'` and `'spent'` — "How much have we spent this month?" contains neither the substring `spend` nor a supplier name, only `spent`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/assistantEngine.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/assistantEngine.js src/lib/assistantEngine.test.js
git commit -m "feat: add data-backed assistant reply engine"
```

---

### Task 2: ChatContext

**Files:**
- Create: `src/context/ChatContext.jsx`
- Create: `src/context/ChatContext.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/context/ChatContext.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SupplierProvider } from './SupplierContext'
import { ContractProvider } from './ContractContext'
import { SpendProvider } from './SpendContext'
import { ChatProvider, useChatContext } from './ChatContext'

const wrapper = ({ children }) => (
  <SupplierProvider>
    <ContractProvider>
      <SpendProvider>
        <ChatProvider>{children}</ChatProvider>
      </SpendProvider>
    </ContractProvider>
  </SupplierProvider>
)

describe('ChatContext', () => {
  it('seeds with a single assistant greeting', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].text).toContain('ProcureIQ assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('appends the user message immediately and the data-backed reply after the delay', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('Which suppliers are riskiest?'))

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].role).toBe('user')
    expect(result.current.messages[1].text).toBe('Which suppliers are riskiest?')
    expect(result.current.isThinking).toBe(true)

    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    expect(result.current.messages[2].role).toBe('assistant')
    expect(result.current.messages[2].text).toContain('Pacific Rim Logistics')
    expect(result.current.isThinking).toBe(false)
  })

  it('assigns unique ids to user and assistant messages', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('help'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    const ids = result.current.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores empty and whitespace-only messages', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('   '))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.isThinking).toBe(false)
  })

  it('clearChat resets to the greeting', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('help'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    act(() => result.current.clearChat())
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('throws when used outside ChatProvider', () => {
    expect(() => renderHook(() => useChatContext())).toThrow(
      'useChatContext must be used inside ChatProvider'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/context/ChatContext.test.jsx`
Expected: FAIL — cannot find module `./ChatContext`

- [ ] **Step 3: Implement ChatContext**

Create `src/context/ChatContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSupplierContext } from './SupplierContext'
import { useContractContext } from './ContractContext'
import { useSpendContext } from './SpendContext'
import { riskAssessments, esgResponses } from '../lib/mockData'
import { getAssistantReply } from '../lib/assistantEngine'

const ChatContext = createContext(null)

const GREETING_TEXT =
  "Hi! I'm your ProcureIQ assistant. Ask me about supplier risk, spend, expiring contracts, ESG performance, or any supplier by name."

function makeGreeting() {
  return { id: 'msg_0', role: 'assistant', text: GREETING_TEXT, createdAt: new Date() }
}

export function ChatProvider({ children }) {
  const { suppliers } = useSupplierContext()
  const { contracts } = useContractContext()
  const { spendRecords } = useSpendContext()
  const [messages, setMessages] = useState(() => [makeGreeting()])
  const [isThinking, setIsThinking] = useState(false)
  const counterRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    counterRef.current += 1
    const userMessage = { id: `msg_${counterRef.current}`, role: 'user', text: trimmed, createdAt: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setIsThinking(true)
    timerRef.current = setTimeout(() => {
      const reply = getAssistantReply(trimmed, { suppliers, contracts, riskAssessments, esgResponses, spendRecords })
      counterRef.current += 1
      setMessages((prev) => [
        ...prev,
        { id: `msg_${counterRef.current}`, role: 'assistant', text: reply.text, createdAt: new Date() },
      ])
      setIsThinking(false)
    }, 600)
  }

  function clearChat() {
    clearTimeout(timerRef.current)
    setIsThinking(false)
    setMessages([makeGreeting()])
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, isThinking, clearChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/context/ChatContext.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/ChatContext.jsx src/context/ChatContext.test.jsx
git commit -m "feat: add ChatContext with simulated assistant replies"
```

---

### Task 3: AIAssistant page

**Files:**
- Create: `src/pages/AIAssistant.jsx`
- Create: `src/pages/AIAssistant.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/AIAssistant.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { ChatProvider } from '../context/ChatContext'
import AIAssistant from './AIAssistant'

function renderPage() {
  return render(
    <SupplierProvider>
      <ContractProvider>
        <SpendProvider>
          <ChatProvider>
            <AIAssistant />
          </ChatProvider>
        </SpendProvider>
      </ContractProvider>
    </SupplierProvider>
  )
}

describe('AIAssistant', () => {
  it('renders the heading and the greeting message', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument()
    expect(screen.getByText(/ProcureIQ assistant/)).toBeInTheDocument()
  })

  it('shows 5 suggested prompt chips while the conversation is fresh', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Which suppliers are riskiest?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How much have we spent this month?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Which contracts expire soon?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Who are our ESG laggards?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })

  it('clicking a chip sends the prompt, hides the chips, and renders a data-backed reply', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Which suppliers are riskiest?' }))

    expect(screen.getByText('Which suppliers are riskiest?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Give me a portfolio overview' })).not.toBeInTheDocument()
    expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText(/Pacific Rim Logistics/)).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByTestId('thinking-indicator')).not.toBeInTheDocument()
  })

  it('sends a typed message on submit and clears the input', async () => {
    renderPage()
    const input = screen.getByPlaceholderText('Ask about suppliers, contracts, spend...')
    fireEvent.change(input, { target: { value: 'help' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(input).toHaveValue('')
    await waitFor(() => expect(screen.getByText(/portfolio overview/)).toBeInTheDocument(), { timeout: 2000 })
  })

  it('ignores submitting an empty input', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.queryByTestId('thinking-indicator')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })

  it('Clear chat resets the conversation and restores the chips', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Which contracts expire soon?' }))
    await waitFor(() => expect(screen.getByText(/active contracts/)).toBeInTheDocument(), { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(screen.queryByText(/active contracts/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })
})
```

Note: in the chip-click test, asserting `getByText('Which suppliers are riskiest?')` right after the click does not collide with the chip button — the chips hide synchronously once the user message is appended (`messages.length > 1`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/AIAssistant.test.jsx`
Expected: FAIL — cannot find module `./AIAssistant`

- [ ] **Step 3: Implement the page**

Create `src/pages/AIAssistant.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { useChatContext } from '../context/ChatContext'
import { cn } from '../utils/cn'

const SUGGESTED_PROMPTS = [
  'Which suppliers are riskiest?',
  'How much have we spent this month?',
  'Which contracts expire soon?',
  'Who are our ESG laggards?',
  'Give me a portfolio overview',
]

export default function AIAssistant() {
  const { messages, sendMessage, isThinking, clearChat } = useChatContext()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isThinking])

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const isFresh = messages.length <= 1

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Assistant"
        description="Ask questions about your procurement data"
        actions={
          <Button variant="ghost" onClick={clearChat}>
            Clear chat
          </Button>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-line rounded-xl px-4 py-3 text-sm',
                m.role === 'user'
                  ? 'bg-gradient-blue text-white'
                  : 'border border-border bg-bg-card text-text-primary'
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start" data-testid="thinking-indicator">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isFresh && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about suppliers, contracts, spend..."
          className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <Button type="submit" variant="primary">
          Send
        </Button>
      </form>
    </div>
  )
}
```

The `scrollIntoView` call uses optional chaining on the method itself (`?.scrollIntoView?.(...)`) because jsdom does not implement it — without the guard, every test would throw.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/AIAssistant.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AIAssistant.jsx src/pages/AIAssistant.test.jsx
git commit -m "feat: add AI Assistant chat page"
```

---

### Task 4: Landing page

**Files:**
- Create: `src/pages/Landing.jsx`
- Create: `src/pages/Landing.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Landing.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )
}

describe('Landing', () => {
  it('renders the hero with wordmark and tagline', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1, name: 'ProcureIQ' })).toBeInTheDocument()
    expect(screen.getByText('AI-powered procurement intelligence')).toBeInTheDocument()
  })

  it('renders an Open App CTA linking to the dashboard', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Open App/ })
    expect(cta).toHaveAttribute('href', '/dashboard')
  })

  it('renders 6 module feature cards', () => {
    renderLanding()
    for (const label of ['Dashboard', 'Suppliers', 'Contracts', 'Risk', 'ESG', 'Spend']) {
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { level: 3, name: 'Admin' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/Landing.test.jsx`
Expected: FAIL — cannot find module `./Landing`

- [ ] **Step 3: Implement the page**

Create `src/pages/Landing.jsx`:

```jsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/Landing.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.jsx src/pages/Landing.test.jsx
git commit -m "feat: add public landing page"
```

---

### Task 5: Wire routing and providers

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write the failing route tests**

In `src/App.test.jsx`, replace the FIRST test (`'redirects the root route to the Dashboard and renders the shell'`) with:

```jsx
  it('renders the public landing page at the root route', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('link', { name: /Open App/ })).toBeInTheDocument()
    expect(screen.getByText('AI-powered procurement intelligence')).toBeInTheDocument()
  })
```

and replace the LAST test (`'renders a placeholder page for not-yet-built modules'`, which currently targets `/ai-assistant`) with these two:

```jsx
  it('renders the AI Assistant page at /ai-assistant', async () => {
    window.history.pushState({}, '', '/ai-assistant')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Ask about suppliers, contracts, spend...')).toBeInTheDocument()
  })

  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/portal')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Supplier Portal' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 7/i)).toBeInTheDocument()
  })
```

The middle tests (suppliers/contracts/risk/esg/spend routes) stay unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.test.jsx`
Expected: FAIL — `/` still redirects to the Dashboard (no "Open App" link), `/ai-assistant` still renders the placeholder

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
import { ChatProvider } from './context/ChatContext'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import AIAssistant from './pages/AIAssistant'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
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
              <ChatProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route element={<AppShell />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/suppliers/:id" element={<SupplierDetail />} />
                      <Route path="/contracts" element={<Contracts />} />
                      <Route path="/risk" element={<Risk />} />
                      <Route path="/esg" element={<ESG />} />
                      <Route path="/spend" element={<Spend />} />
                      <Route path="/ai-assistant" element={<AIAssistant />} />
                      {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                        <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
                      ))}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </ChatProvider>
            </SpendProvider>
          </ContractProvider>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
```

The exact `/` path outranks the catch-all `*` inside the pathless AppShell route, so the landing page wins at the root and every other unknown path still falls through to `/dashboard`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/App.test.jsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files green (no other test renders `App` or consumes `ChatContext`, so no other wrappers change)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: wire Landing at root and AI Assistant route with ChatProvider"
```

---

## Self-Review Notes

- **Spec coverage:** Engine with 8 intents in precedence order (Task 1), ChatContext with greeting/600ms delay/monotonic ids/clearChat/cleanup (Task 2), chat page with thread/typing dots/5 chips/input bar/Clear chat (Task 3), landing with hero/CTA/6 module cards/footer (Task 4), routing with ChatProvider innermost, `/` landing, real `/ai-assistant`, placeholders trimmed to portal+admin (Task 5). All Testing-section requirements from the spec map to the test files in Tasks 1-5.
- **Keyword fix vs spec:** the spec's intent table lists the spend trigger as `"spend"`; the suggested chip "How much have we spent this month?" only contains `spent`, so the engine triggers on `'spend' || 'spent'`. This is a deliberate, minimal widening required for the chips to work.
- **Type consistency:** `getAssistantReply(message, data) → { text }` is consumed as `reply.text` in ChatContext. `useChatContext()` returns `{ messages, sendMessage, isThinking, clearChat }`, destructured identically in AIAssistant.jsx and its tests. Message shape `{ id, role, text, createdAt }` is consistent across Task 2 and Task 3. `SUGGESTED_PROMPTS` strings in Task 3 match the chip names asserted in its tests and the engine intents they trigger.
- **mockData-coupled assertions verified:** highest risk assessment is `sup_9` / Pacific Rim Logistics, score 78 (`(8*11+5)%100=93`, `(8*7+15)%100=71`, `(8*19+9)%100=61`, `(8*23+3)%100=87` → round(312/4)=78); the next-highest is 68, so the top-1 assertion is stable. The greeting phrase "ProcureIQ assistant" appears only in the greeting.
- **jsdom pitfalls handled:** `scrollIntoView` guarded with optional call; chip/user-bubble text collision avoided because chips hide synchronously on send.
- **No placeholders:** every step has complete, runnable code.
