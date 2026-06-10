# ProcureIQ Phase 5: AI Assistant + Landing Page — Design Spec

## Context

Phase 4 delivered the ESG and Spend modules. Phase 5 builds the AI Assistant chat page and the public landing page.

**Phase decomposition reminder:**
1. Foundation ✅ — scaffold, design system, AppShell, Dashboard
2. Suppliers module ✅ — list, detail, CRUD, SupplierContext
3. Contracts + Risk modules ✅ — contract CRUD, risk dashboard
4. ESG + Spend modules ✅ — ESG dashboard, spend analytics + CRUD
5. **AI Assistant + Landing Page** (this spec)
6. Real integrations (Clerk, Neon/Prisma, Anthropic, Cloudinary, EmailJS)
7. Admin Panel + Supplier Portal

All AI behavior in Phase 5 is **mocked** — a deterministic, data-backed engine. Phase 6 replaces the engine internals with real Anthropic API calls behind the same interface; the context and UI stay untouched.

## Goal

- `/ai-assistant` — a chat page where a mock assistant answers procurement questions with real numbers computed from the live app data
- `/` — a public, shell-less landing page (hero, module highlights, CTA into the app)

## Architecture

### Assistant engine: pure and data-backed

`src/lib/assistantEngine.js` exports one pure function:

```js
getAssistantReply(message, { suppliers, contracts, riskAssessments, esgResponses, spendRecords })
// → { text: string }   (plain text; '\n' line breaks for lists)
```

No timers, no state, no imports of mockData — all data comes in as arguments, so answers always reflect live context state (e.g. a contract added this session). Reuses existing selectors/formatters (`esgRating`, `daysUntil`, `formatCurrency`, `formatCompactCurrency`).

**Intents, checked in precedence order** (case-insensitive keyword match):

| # | Intent | Trigger | Answer |
|---|--------|---------|--------|
| 1 | Help | "help", "what can you" | Capability list |
| 2 | Supplier lookup | message contains a supplier name (case-insensitive substring) | Snapshot: status, risk score + level, ESG score + rating, contract count, total spend |
| 3 | Riskiest suppliers | "risk" | Top 3 by risk score (name, score, level) |
| 4 | Spend | "spend" | Total spend, this-month spend, top category |
| 5 | Expiring contracts | "contract", "expir", "renew" | Active contracts with endDate within 60 days (title, days left); count of active contracts |
| 6 | ESG laggards | "esg", "sustainab" | Portfolio average + list of suppliers rated needs-improvement |
| 7 | Portfolio overview | "how many", "overview", "summary" | Counts: suppliers (by status), contracts, total spend, average risk |
| 8 | Fallback | anything else | Polite redirect listing what it can answer |

Supplier lookup outranks topic intents so "what's the risk for Atlas Steelworks" returns the Atlas snapshot, not the generic risk top-3.

### ChatContext

`src/context/ChatContext.jsx` — mirrors the established context pattern:

```js
{
  messages: [{ id, role: 'user' | 'assistant', text, createdAt }],
  sendMessage: (text) => void,
  isThinking: boolean,
  clearChat: () => void,
}
```

- Seeded with one assistant greeting message.
- `sendMessage` appends the user message, sets `isThinking`, and after a 600ms `setTimeout` appends the engine reply and clears `isThinking`. Timer is cleaned up on unmount.
- Message ids come from a monotonic counter ref (`msg_1`, `msg_2`, …) — `Date.now()` alone could collide for the user/assistant pair.
- `clearChat` resets to the greeting message.
- `useChatContext()` throws `'useChatContext must be used inside ChatProvider'` outside the provider.
- `ChatProvider` consumes `useSupplierContext`, `useContractContext`, `useSpendContext` for live data and imports `riskAssessments` + `esgResponses` from mockData (read-only modules' established pattern). It therefore nests **innermost** in App.jsx: `Supplier > Contract > Spend > Chat`.

### AIAssistant page

`src/pages/AIAssistant.jsx`:

- `PageHeader` title "AI Assistant", description "Ask questions about your procurement data".
- Scrollable message thread: user messages right-aligned in accent-blue bubbles, assistant messages left-aligned in Card-style bubbles. Auto-scrolls to the newest message (ref + `scrollIntoView` in an effect).
- While `isThinking`, an assistant-side typing indicator (three animated dots).
- **Suggested prompt chips** — 5 buttons shown only while the conversation is fresh (`messages.length <= 1`): "Which suppliers are riskiest?", "How much have we spent this month?", "Which contracts expire soon?", "Who are our ESG laggards?", "Give me a portfolio overview". Clicking a chip sends it as a message.
- Input bar pinned below the thread: text input (Enter submits, empty input ignored) + Send button + a ghost "Clear chat" button.

### Landing page

`src/pages/Landing.jsx` — rendered at `/` **outside** AppShell (no sidebar/topbar):

- **Hero**: ProcureIQ wordmark, tagline "AI-powered procurement intelligence", one-paragraph value prop, primary CTA Button "Open App" → `Link` to `/dashboard`.
- **Feature grid**: 6 cards for the built modules — Dashboard, Suppliers, Contracts, Risk, ESG, Spend — each with its lucide icon (reuse `NAV_ITEMS` icons from `src/utils/constants.js`), name, and a one-line description.
- **Footer**: minimal — product name + "Demo build" note.
- Uses the existing dark Tailwind design tokens (bg-bg-primary, text-text-primary, accent-blue, Card). No new design system work.

### Routing (App.jsx)

```jsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route element={<AppShell />}>
    {/* index redirect removed */}
    <Route path="/dashboard" element={<Dashboard />} />
    ... existing module routes ...
    <Route path="/ai-assistant" element={<AIAssistant />} />
    {/* placeholders shrink to /portal and /admin (Phase 7) */}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route>
</Routes>
```

`ChatProvider` joins the provider stack innermost. The `/ai-assistant` entry leaves `PLACEHOLDER_ROUTES`.

## Testing

- `assistantEngine.test.js` — one test per intent (including precedence: supplier name + "risk" → snapshot) + fallback; assertions check computed numbers against the same mockData-derived expectations the dashboards use.
- `ChatContext.test.jsx` — greeting seed, send → user message appears immediately → assistant reply after delay (`waitFor`), `isThinking` toggling, `clearChat`, throws outside provider.
- `AIAssistant.test.jsx` — renders heading + greeting; chips visible when fresh and gone after first send; chip click sends prompt and yields reply; typed send flow; Clear chat restores chips.
- `Landing.test.jsx` — hero heading, CTA links to `/dashboard`, 6 module cards.
- `App.test.jsx` — `/` renders Landing (replaces the old "redirects root to Dashboard" test), `/ai-assistant` renders the real page (replaces the placeholder test), `/portal` still placeholder.

Existing test wrappers don't change: no existing page consumes ChatContext.

## Out of Scope (deferred)

- Real Anthropic API calls, streaming responses (Phase 6)
- Contract `aiSummary` / risk `aiAnalysis` backfill (Phase 6, with real AI)
- Geopolitical risk map visualization (deferred from Phase 3; revisit in Phase 6)
- Chat persistence across refreshes (Phase 6, with backend)
- Landing page sign-in/sign-up flows (Phase 6 — Clerk)
- Markdown rendering in assistant replies (plain text with line breaks is enough for the mock)
