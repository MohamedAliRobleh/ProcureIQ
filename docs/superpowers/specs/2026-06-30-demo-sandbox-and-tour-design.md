# Demo Sandbox + Guided Tour — Design

**Date:** 2026-06-30
**Status:** Approved (design), pending plan

## Problem

Visitors sign into the shared, read-only demo account (`org:member` in the "ProcureIQ Demo" org) and can explore but cannot try creating/editing data — write controls are hidden and the API 403s members. We want visitors to *test* inserting/editing data and to be *guided* through the app, on the **free Clerk dev instance** (so: no per-visitor Clerk orgs, no exposing admin, no vandalism of the shared showcase, no paid infra).

## Goal

Two complementary demo-experience features, active **only in the demo org**:

1. **Local-first sandbox** — a read-only demo visitor gets write controls unlocked; create/edit/delete operate on a per-browser local store (localStorage), never touching the API/DB. Instant, optimistic, isolated per browser, self-resetting.
2. **Guided tour** — an animated spotlight walkthrough (built on the already-installed `framer-motion`, no new dependency) that auto-starts on first demo visit and is replayable via a "Take a tour" button.

## Constraints

- **Demo-org-only.** Both features activate ONLY when the active Clerk org is the demo org. A real member of a real org must see NO behaviour change (no fake writes, no unlocked buttons, no tour). Demo org identified by slug via `VITE_DEMO_ORG_SLUG` (default `procureiq-demo`).
- **No new runtime dependency.** Tour uses `framer-motion` (already a dependency). Sandbox uses `localStorage` (no library).
- **No backend change.** Sandbox is entirely client-side; the API and DB are untouched. The demo org's real seed data is read once to prime the sandbox.
- **Non-demo behaviour byte-identical.** Outside the demo org, `apiClient`, `usePermissions`, and the app render exactly as today.
- Full test suite stays green (~467); new units are added.

## Architecture

### 1. Sandbox store — `src/lib/sandbox.js` (new)

A localStorage-backed per-resource store plus a module-level demo-mode flag (mirroring the existing `setTokenGetter` seam in `apiClient.js`).

- Demo flag: `let sandboxActive = false`; `setSandboxActive(bool)`; `isSandboxActive()`.
- Storage key namespace: `procureiq_sandbox_v1:<resource>` (e.g. `…:suppliers`). One JSON array per resource.
- Resource parse: given an API path, derive `{ resource, id }` — `/api/suppliers` → `{ resource: 'suppliers' }`; `/api/suppliers/sup_1` → `{ resource: 'suppliers', id: 'sup_1' }`. Sub-routes that are not CRUD (e.g. `/api/contracts/summarize`, `/api/org/seed`) are NOT sandbox-handled and fall through to the real API (see apiClient rules).
- Operations:
  - `sandboxGet(resource, seedFn)`: if a snapshot exists in localStorage, return it; otherwise `await seedFn()` (the real API GET), persist the result as the snapshot, return it.
  - `sandboxCreate(resource, data)`: assign a local id (`sbx_<resource>_<counter>`), append to the resource array, persist, return the created record.
  - `sandboxUpdate(resource, id, patch)`: merge `patch` into the matching record (strip `id`), persist, return the updated record; throw a not-found error if absent.
  - `sandboxDelete(resource, id)`: remove the record, persist, return `{ deleted: true }`.
  - `resetSandbox()`: remove all `procureiq_sandbox_v1:*` keys (next GETs re-seed from the API).

### 2. apiClient sandbox branch — `src/lib/apiClient.js` (modify)

`request(path, options)` gains a guard at the top: when `isSandboxActive()` AND the path parses to a sandbox-managed resource (`suppliers`, `contracts`, `spend`, `portal-requests`), route to the sandbox store instead of `fetch`:

- `GET /api/<resource>` → `sandboxGet(resource, () => realFetch)` (real fetch used only to seed once).
- `POST /api/<resource>` → `sandboxCreate(resource, body)`.
- `PATCH /api/<resource>/<id>` → `sandboxUpdate(resource, id, body)`.
- `DELETE /api/<resource>/<id>` → `sandboxDelete(resource, id)`.
- Anything else (any path when not sandbox-active; non-CRUD sub-routes like `/api/contracts/summarize`, `/api/org/*`, `/api/assistant`, `/api/esg`, `/api/risk`; GET-by-id) → unchanged real `fetch`.

The public `api` object (`get/post/patch/del`) is unchanged in shape, so every data context is sandbox-aware with **zero context changes**.

### 3. Demo-mode bridge — `src/lib/auth.jsx` (modify)

Extend the existing in-`ClerkProvider` bridge (next to `TokenBridge`) with a `DemoBridge` that reads `useOrganization()` and calls `setSandboxActive(organization?.slug === DEMO_SLUG)` in an effect (reset to `false` on unmount / org change). `DEMO_SLUG = import.meta.env.VITE_DEMO_ORG_SLUG ?? 'procureiq-demo'`. Export a small `useIsDemoOrg()` hook (`organization?.slug === DEMO_SLUG`) for UI (permissions, badge, tour gating).

### 4. Permissions unlock — `src/lib/permissions.js` (modify)

`usePermissions()` becomes demo-aware: when the active org is the demo org, `canManage(resource)` returns `true` for every `MANAGE_RESOURCES` resource (so write buttons render). The pure `canManage(role, resource)` function is unchanged (still admin-only) and still used by tests and the non-demo path; only the hook layers the demo override on top via `useIsDemoOrg()`.

### 5. Sandbox badge + reset — `src/components/layout/TopBar.jsx` (modify) + `src/components/demo/SandboxBadge.jsx` (new)

In the demo org only, TopBar renders a `SandboxBadge`: a pill reading **"🧪 Sandbox — changes are local"** with a **"Reset"** button that calls `resetSandbox()` then reloads the page (re-seeds from the API). Hidden entirely outside the demo org.

### 6. Guided tour — `src/components/tour/` (new)

- `TourProvider.jsx` — context holding `{ isOpen, stepIndex, start, next, back, skip }`, plus first-visit auto-start: on mount, if `useIsDemoOrg()` and `localStorage['procureiq_tour_done_v1']` is unset, `start()`; mark done on finish/skip. Only active in the demo org.
- `Tour.jsx` — the overlay: a dimmed backdrop with a spotlight cutout around the current step's target element (located by a stable `data-tour="…"` attribute), and a tooltip card (title, body, progress dots, **Back / Skip / Next** — "Next" becomes "Done" on the last step), animated with `framer-motion`. Positioned relative to the target with a simple placement (top/bottom/left/right) and a viewport-safe fallback.
- `tourSteps.js` — the step config array: `{ target: '[data-tour="…"]', title, body, placement }`. ~6 steps: (1) welcome (centered, no target), (2) sidebar nav, (3) a dashboard KPI card, (4) the Suppliers table + the now-unlocked "Add supplier" button ("this is your sandbox — try adding one"), (5) the AI Assistant nav item, (6) the Sandbox badge ("everything you change is local — reset anytime"). Steps whose target is missing on the current route are skipped gracefully.
- `data-tour` attributes are added to the target elements (Sidebar nav container, a Dashboard stat card, Suppliers "Add" button + table, AI Assistant nav link, SandboxBadge).
- A **"Take a tour"** button in TopBar (demo org only) calls `start()` to replay.
- `TourProvider` is mounted inside the demo/org-scoped provider tree so it only exists for signed-in org routes.

## Data flow

```
Visitor (demo org) loads /suppliers
  → SupplierContext GET /api/suppliers
    → apiClient: sandboxActive? yes, resource=suppliers
      → sandboxGet: no snapshot yet → real fetch (seed data) → persist snapshot → return
  → visitor clicks "Add supplier" (button visible: usePermissions demo override)
    → SupplierContext POST /api/suppliers
      → apiClient → sandboxCreate → new record with sbx_ id, persisted locally, returned
  → table + charts update (context state), nothing hit the DB
  → "Reset" in SandboxBadge → resetSandbox() → reload → snapshots re-seed from API
```

## Testing

- `sandbox.test.js`: seed-on-first-get, create/update/delete mutate + persist, reset clears; path→`{resource,id}` parsing (incl. non-CRUD sub-routes returning null).
- `apiClient.test.js` (extend): when `setSandboxActive(true)`, CRUD on managed resources hit the store (no fetch); when inactive, every call fetches; non-CRUD sub-routes fetch even when active. `localStorage` and `fetch` are stubbed.
- `permissions.test.jsx` (extend): in the demo org, `usePermissions().canManage('suppliers')` is `true` for a member; outside it, unchanged (member → false).
- Tour: `tourReducer`/hook navigation (next/back/skip/bounds, done-flag persistence), first-visit auto-start gating on demo org + localStorage flag. Rendering-heavy overlay positioning is smoke-tested, not pixel-tested.

## Success criteria

- In the demo org: write buttons appear; add/edit/delete persist across reloads locally, never call the API (verified by no network write); "Reset" restores the seeded data; the tour auto-starts once and replays via the button.
- Outside the demo org: no badge, no tour, no unlocked writes; `apiClient`/permissions behave exactly as before.
- Full suite green; no new runtime dependency (framer-motion already present).

## Out of scope

- Real server-side persistence of visitor edits (requires per-tenant isolation → paid Clerk prod; explicitly excluded).
- Sandboxing risk/ESG scores beyond where edit UI already exists.
- Multi-tab sync of the sandbox (each tab reads localStorage on load; live cross-tab sync not required).
- Analytics on tour completion.
