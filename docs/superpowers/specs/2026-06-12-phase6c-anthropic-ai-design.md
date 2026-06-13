# ProcureIQ Phase 6c: Anthropic AI — Design Spec

## Context

Phase 6a put the app on Neon/Prisma behind Vercel functions; 6b gated everything behind Clerk auth. 6c replaces the mock AI with real Claude: the chat assistant answers from the live database, and contracts gain on-demand AI summaries.

**Phase 6 decomposition:** 6a backend+DB ✅ → 6b Clerk auth ✅ → **6c Anthropic AI (this spec)** → 6d Cloudinary → 6e EmailJS. Phase 7 (Admin + Portal) follows.

**Decisions made during brainstorming:**
- **Scope:** the chat assistant + contract `aiSummary`. Risk `aiAnalysis` and ESG `aiSuggestions` are a later pass.
- **Model:** `claude-opus-4-8`, adaptive thinking, non-streaming.
- **Fallback:** the existing deterministic `getAssistantReply` engine becomes the assistant's server-side fallback.
- User has an Anthropic API key and will add `ANTHROPIC_API_KEY` to `.env` (documented in `.env.example`).

## Goal

A signed-in user asks the assistant a procurement question and gets a real Claude answer grounded in their actual supplier/contract/risk/ESG/spend data. On any contract, they can generate a concise AI summary that persists to the database.

## Architecture

### The key stays server-side

`ANTHROPIC_API_KEY` lives only in Vercel functions — never in the bundle. Both AI features are new functions behind the existing `requireAuth` wrapper, called from the frontend through `apiClient` (which already attaches the Clerk bearer token).

`api/_lib/anthropic.js` exports an `Anthropic()` client singleton (cached on `globalThis`, mirroring `api/_lib/prisma.js`). The default constructor reads `ANTHROPIC_API_KEY` from the environment.

### `POST /api/assistant`

1. `requireAuth` → org-scoped (`ORG_ID`).
2. Fetch the org's full dataset from Prisma (suppliers, contracts, risk assessments, ESG responses, spend records — all small).
3. Build a compact **text digest**: one line per supplier (name, category, country, status, risk score, ESG score), one per contract (title, supplier, value, status, term, days-to-expiry), one per risk assessment and ESG response (scores + sub-scores), and spend rolled up by supplier, by category, plus total and this-month. Roughly 2–3K tokens.
4. Call `claude-opus-4-8` with the digest as the **system prompt** (role + "answer only from this data; say so if it's not answerable; be concise, plain text") and the conversation turns as `messages`.
5. Return `{ reply: string }`.

**Conversation history:** the request body carries the prior turns (`[{ role, content }]`) so follow-ups work ("what about the second one?"). The frontend sends turns from the first user message onward — the assistant greeting (an `assistant`-first message) is excluded so the Claude `messages` array starts with `user`.

**Model params:** `thinking: {type: "adaptive"}` (self-moderates, keeps simple lookups fast, and avoids Opus 4.8 leaking reasoning into the answer when thinking is off), `max_tokens: 2048`, non-streaming. No `temperature`/`top_p`/`budget_tokens` (all 400 on 4.8).

**Graceful fallback:** if `ANTHROPIC_API_KEY` is absent or the Claude call throws, the endpoint computes a reply with the existing pure `getAssistantReply(message, data)` engine over the same fetched dataset and returns it (with `{ reply, fallback: true }`). The engine is pure (no React) and server-importable; DB rows with ISO-string dates work unchanged because every consumer does `new Date(x)`. This keeps the assistant always-answering and prevents the engine from becoming dead code.

### `POST /api/contracts/summarize`

Flat filename (not `api/contracts/[id]/summary.js`, which would collide with the existing `[id].js` dynamic route).

1. `requireAuth` → org-scoped.
2. Body `{ id }`; `findFirst({ where: { id, orgId: ORG_ID } })` → 404 if absent (same IDOR-safe pattern as the 6b PATCH handlers).
3. Call `claude-opus-4-8` (adaptive thinking, `max_tokens: 1024`) with a prompt to summarize the contract in 2–3 sentences for a procurement manager (value, term, renewal, notable terms).
4. `prisma.contract.update` writing the text to `aiSummary`; return the updated contract.
5. If the key is missing / Claude errors → 503 `{ error: 'AI features are not configured' }` (no fallback for summaries — they're explicit, on-demand, and persisted).

### Frontend

**`ChatContext` simplifies.** It drops the engine import, the `dataRef`, and the `useRisk`/`useEsg`/data-context wiring — the server now owns the grounded data. `sendMessage(text)` appends the user message, sets `isThinking`, POSTs the conversation (turns after the greeting) to `/api/assistant`, appends `reply`, clears `isThinking`. On a network/API error it appends a friendly assistant message ("Sorry, I couldn't reach the assistant just now."). The greeting seed, monotonic ids, and `clearChat` are unchanged. `useChatContext` still throws outside its provider.

**`ContractContext`** gains `summarizeContract(id)`, which POSTs to `/api/contracts/summarize`, merges the returned contract into state, and returns a promise so callers can show a spinner.

**`ContractSlideOver`** gets an "AI Summary" section: if the contract has `aiSummary`, render it; otherwise show a "Generate summary" button that calls `summarizeContract(id)`, shows a spinner (local `isSummarizing` state) while awaiting, then renders the result. Both consumers (`Contracts.jsx`, `SupplierDetail.jsx`) re-derive the live contract from context by id so the summary appears once persisted.

## Data Flow (after 6c)

```
ChatContext ──POST /api/assistant {messages}──▶ requireAuth → Prisma (org data)
                                                      │  → digest (system prompt)
                                                      ▼
                                          claude-opus-4-8  ──(error/no key)──▶ getAssistantReply fallback
                                                      │
                                                  { reply }

ContractSlideOver ──summarizeContract(id)──▶ POST /api/contracts/summarize
                                                  → contract (org-scoped, 404)
                                                  → claude-opus-4-8 → aiSummary → Prisma.update
                                                  → updated contract
```

## Testing

- **`api/assistant.test.js`** — mock `_lib/anthropic.js` and `_lib/prisma.js`: returns the mocked Claude reply on success; on the mock throwing (or a simulated missing key) returns the deterministic engine reply (assert a known computed fact); requireAuth identity-mocked.
- **`api/contracts/summarize.test.js`** (or folded into `contracts.test.js`) — 404 when the id isn't in the org; on success calls `contract.update` with the generated `aiSummary` and returns the updated contract; 503 when the client is unavailable.
- **Frontend** — `src/test/mockApi.js` handles `POST /api/assistant` (canned `{ reply }`) and `POST /api/contracts/summarize` (echo the contract with a stub `aiSummary`). `ChatContext.test.jsx` and `AIAssistant.test.jsx` change from asserting the old deterministic "Pacific Rim Logistics" reply to the stubbed reply. New tests: the slide-over "Generate summary" button (button → spinner → rendered summary) and `summarizeContract` in `ContractContext.test.jsx`.
- **Manual:** add `ANTHROPIC_API_KEY` to `.env`, `vercel dev`, sign in → ask the assistant a data question (real answer, numbers match the dashboards) → generate a contract summary → refresh (summary persists). Temporarily blank the key → assistant still answers via fallback; summary returns the 503 message.

## Out of Scope (deferred)

- Streaming responses (non-streaming JSON keeps the apiClient unchanged; short outputs don't need it)
- Prompt caching of the digest (low demo volume; the constant-system-prompt shape leaves room for it later)
- Risk `aiAnalysis` and ESG `aiSuggestions` (later pass — nullable columns already exist)
- Tool use / agentic retrieval (the dataset is tiny; the digest fits in one call)
- Chat persistence (history stays in-memory per the Phase 5 decision)
- Rate limiting and per-org cost guardrails (beyond `max_tokens`)
