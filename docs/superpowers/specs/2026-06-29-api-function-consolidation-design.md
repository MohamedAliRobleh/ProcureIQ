# API Function Consolidation — Design

**Date:** 2026-06-29
**Status:** Approved (design), pending plan

## Problem

Vercel's **Hobby (free) plan caps a deployment at 12 Serverless Functions.** Every `.js`
file under `api/` (except `_`-prefixed dirs and the `**/*.test.js` files excluded by
`.vercelignore`) is deployed as one function. ProcureIQ currently has **21** such files,
so production deployment is rejected even though the build succeeds. We must get to
**≤ 12 functions** without losing features, without changing public API URLs, and while
keeping the full test suite (~418 tests) green.

## Goal

Consolidate each multi-endpoint resource folder under `api/` into a **single catch-all
router function**, moving the endpoint logic into `api/_handlers/` (ignored by Vercel).
Target: **9 functions**, all public URLs and behaviour unchanged.

## Current endpoint inventory (21 functions)

| Folder | Files | Methods / auth / id source |
|---|---|---|
| `suppliers/` | `index.js`, `[id].js` | GET+POST list (`requireAuth`); PATCH byId (`req.query.id`) |
| `contracts/` | `index.js`, `[id].js`, `summarize.js`, `upload-signature.js`, `notify.js` | list GET+POST; byId PATCH (`req.query.id`); `summarize`/`upload-signature`/`notify` POST (`req.body.id`); all `requireAuth` |
| `spend/` | `index.js`, `[id].js` | list GET+POST; byId PATCH (`req.query.id`); `requireAuth` |
| `portal-requests/` | `index.js`, `[id].js`, `notify.js` | list GET+POST; byId PATCH+DELETE (`req.query.id`); `notify` POST; `requireAuth` |
| `org/` | `seed.js`, `clear.js`, `reset.js`, `export.js`, `audit.js` | `seed` POST (`requireAuth`); `clear`/`reset` POST, `export`/`audit` GET (all `requireOrgAdmin`) |
| singles | `esg/index.js`, `risk/index.js`, `assistant.js`, `billing/checkout.js` | esg/risk GET (`requireAuth`); assistant POST (`requireAuth`); checkout POST (`requireOrgAdmin`) |

## Target inventory (9 functions)

5 catch-all routers + 4 unchanged singles:

1. `api/suppliers/[[...path]].js`
2. `api/contracts/[[...path]].js`
3. `api/spend/[[...path]].js`
4. `api/portal-requests/[[...path]].js`
5. `api/org/[[...path]].js`
6. `api/esg/index.js` *(unchanged)*
7. `api/risk/index.js` *(unchanged)*
8. `api/assistant.js` *(unchanged)*
9. `api/billing/checkout.js` *(unchanged)*

## Architecture

### 1. Relocate handler logic → `api/_handlers/<resource>.js`

`api/_handlers/` is `_`-prefixed, so Vercel ignores it for the functions build (exactly
like the existing `api/_lib/`). Each current handler's body moves here **unchanged** in
logic — same `(req, res)` signature, still reading `req.method`, `req.auth`,
`req.query.id`, `req.body` — but exported as **bare named functions without** the
`requireAuth`/`requireOrgAdmin` wrapper (the router applies auth once). Reserved-word
note: the org `export` endpoint becomes a function named `exportData` (can't bind
`export`); the router maps the path segment `'export'` to it.

Exports per file:
- `_handlers/suppliers.js` → `list`, `byId`
- `_handlers/contracts.js` → `list`, `byId`, `summarize`, `uploadSignature`, `notify`
- `_handlers/spend.js` → `list`, `byId`
- `_handlers/portalRequests.js` → `list`, `byId`, `notify`
- `_handlers/org.js` → `seed`, `clear`, `reset`, `exportData`, `audit`

### 2. Catch-all routers → `api/<resource>/[[...path]].js`

The **optional** catch-all `[[...path]]` matches both the base path (`/api/suppliers`)
and sub-paths (`/api/suppliers/sup_1`). Vercel populates `req.query.path` as a string
array (absent/`undefined` at the base). Each router applies auth at the boundary, then
dispatches:

```js
// api/suppliers/[[...path]].js
import { requireAuth } from '../_lib/auth.js'
import { list, byId } from '../_handlers/suppliers.js'

export default requireAuth(async (req, res) => {
  const path = req.query.path ?? []          // [] | ['sup_1']
  if (path.length === 0) return list(req, res)
  req.query.id = path[0]
  return byId(req, res)
})
```

**Resource + sub-route dispatch (contracts, portal-requests).** A reserved set of
sub-route names is checked first; anything else is treated as a record id:

```js
// api/contracts/[[...path]].js (sketch)
const SUBROUTES = { summarize, 'upload-signature': uploadSignature, notify }
const seg = (req.query.path ?? [])[0]
if (!seg) return list(req, res)
if (SUBROUTES[seg]) return SUBROUTES[seg](req, res)   // POST, body.id
req.query.id = seg; return byId(req, res)
```

Record ids (`con_*`, `por_*`, namespaced `${orgId}__*`) never collide with the reserved
names (`summarize`, `upload-signature`, `notify`), so the rule is unambiguous.

**Mixed-auth dispatch (org).** `seed` is open to any member; `clear`/`reset`/`export`/
`audit` are admin-only. The router applies `requireAuth` (populating `req.auth`,
including `orgRole`), routes `seed` directly, and gates the admin routes inline —
returning the **same 403 response shape that `requireOrgAdmin` currently returns** (the
plan copies that status + body verbatim from `api/_lib/auth.js`). Unknown segment → 404.

### 3. No frontend changes

Public URLs are identical (`/api/suppliers`, `/api/suppliers/:id`,
`/api/contracts/summarize`, `/api/org/clear`, …). The catch-all routers match them, so no
`src/` change is required.

### 4. `vercel.json`

The existing SPA rewrite `/((?!api/).*) → /index.html` already excludes everything under
`api/`, so catch-all functions resolve normally. **No `vercel.json` change required.**

## Testing

Existing handler tests call the handler **function directly** with a hand-built `req`
(`handler({ method, auth, query, body }, res)`) — they never exercise Vercel routing. So:

- **Logic tests** (suppliers, contracts, spend, portal-requests, org test files): change
  only their **import lines** to pull the bare functions from `api/_handlers/<resource>.js`
  (e.g. `import listHandler from './index.js'` → `import { list as listHandler } from
  '../_handlers/suppliers.js'`). The test bodies are unchanged. The now-unnecessary
  `vi.mock('../_lib/auth.js', …)` becomes a harmless no-op (the bare handlers no longer
  import auth); remove it where trivial, leave it otherwise.
- **New router tests** — one small test file per router asserting dispatch:
  - base path (`path` absent) → `list`
  - `path: ['x']` → sets `req.query.id` and calls `byId`
  - reserved sub-route (`path: ['summarize']` / `['notify']`) → the sub-route handler
  - org: member hitting `clear`/`reset`/`export`/`audit` → 403; member hitting `seed` →
    allowed; admin hitting an admin route → allowed; unknown segment → 404.
  The routers' handler dependencies are mocked so router tests assert *dispatch*, not
  business logic.

Run convention is unchanged: api and src halves, src serial via `--no-file-parallelism`.

## Success criteria

- `git`-tracked `api/**/*.js` minus `_`-dirs and `*.test.js` ⇒ **9 function files**.
- Full suite green (~418 tests), including new router-dispatch tests.
- All current endpoint behaviours (status codes, org-scoping, permission 403s,
  read-only member gating) preserved; public URLs unchanged.
- Production deploy on the Hobby plan no longer rejected by the 12-function limit.

## Out of scope

- Upgrading the Vercel plan (rejected alternative).
- A single mega-router `api/[[...path]].js` (rejected: one fragile catch-all file).
- Any change to handler business logic, validation, or the data model.
- The deferred prod env-var / migration steps already tracked elsewhere.
