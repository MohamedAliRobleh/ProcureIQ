# ProcureIQ Phase 7b: Admin Panel (`/admin`) — Design Spec

## Context

Phase 7a made `orgId` real end-to-end (Clerk Organizations: per-request `req.auth.orgId`, a `RequireOrg` gate, org-keyed providers, and `POST /api/org/seed`). `/admin` is still a `PlaceholderPage` ("Phase 7"). Phase 7b turns it into a real **Admin Panel** — the natural home for the org administration that 7a explicitly deferred ("member/role management and invites", "per-org settings", danger-zone data ops).

**Phase 7 decomposition:** 7a real multi-org (done) → **7b Admin Panel (this spec)** → 7c Supplier Portal (`/portal`).

**Decisions made during brainstorming:**
- **Scope = members/roles (via Clerk) + Danger zone (reset/clear) + admin-only access.** Granular per-feature permissions, billing/branding, and an admin audit log are **out of scope** (later phases).
- **Members/invitations/roles use Clerk's prebuilt `<OrganizationProfile/>`** (themed to match), not a custom members table — more secure, faster, Clerk-managed.
- **Danger zone exposes both "Reload demo data" (reset) and "Clear all data" (clear)**, each behind a typed confirmation, admin-only.
- **Admin enforcement is server-side AND UI.** Destructive endpoints check the Clerk org role and 403 non-admins; the UI also hides the panel/actions from non-admins.

## Goal

`/admin` becomes a real, admin-only page where an org admin manages members (invite, promote/demote, remove) and the org's name/logo via Clerk's `<OrganizationProfile/>`, plus a Danger zone to **reload the demo dataset** or **clear all org data**. Both destructive operations are enforced admin-only on the server (`org:admin`), run in a transaction, and are scoped to the active org.

## Architecture

### Access control — org role end-to-end

Clerk includes `org_role` (e.g. `org:admin`, `org:member`) as a default session-token claim when an org is active, and `useOrganization().membership.role` exposes the current user's role client-side.

- **Backend.** `api/_lib/auth.js` `requireAuth` is extended to surface the role: `req.auth = { userId, orgId, orgRole }` where `orgRole = payload.org_role ?? null`. This is **backwards compatible** — all existing 7a handlers ignore `orgRole`. A new composable wrapper `requireOrgAdmin(handler)` wraps `requireAuth` and returns **403 `{ error: 'Admin access required' }`** when `req.auth.orgRole !== 'org:admin'`. The destructive endpoints use `requireOrgAdmin`.
- **Frontend.** The `Admin` page reads `useOrganization().membership?.role`; `isAdmin = role === 'org:admin'`. Non-admins see an "Admin access required" notice instead of the panel. The "Admin" sidebar item is hidden for non-admins.

### Backend — org data operations

Prisma relations have **no `onDelete: Cascade`**, so deletes must run child-first. Both new endpoints live under `api/org/` alongside the existing `seed.js`.

- **`POST /api/org/clear`** (`requireOrgAdmin`): POST-only (405). Runs a single `prisma.$transaction([...])` of `deleteMany({ where: { orgId } })` in child-first order — `contract`, `riskAssessment`, `esgResponse`, `spendRecord`, then `supplier` — and returns `{ cleared: true }`.
- **`POST /api/org/reset`** (`requireOrgAdmin`): POST-only (405). Runs one `prisma.$transaction([...])`: the five child-first `deleteMany` calls above, **then** the five `createMany` calls of `buildSeedData(orgId)` in FK order (`supplier` → `contract` → `riskAssessment` → `esgResponse` → `spendRecord`). Returns `{ reset: true }`. (Wrapping the seed inserts in a transaction here also resolves the 7a review's "seed isn't transactional" note for the reset path.)
- **`POST /api/org/seed`** (existing, 7a): **unchanged.** Stays available to any org member so the Dashboard empty-state onboarding still works (the org creator is a Clerk admin anyway). Reset/clear are the admin-gated operations.

`buildSeedData(orgId)` (from 7a, `api/_lib/seedData.js`) is reused as-is — it already namespaces ids per org and rewrites foreign keys.

### Frontend — the Admin page

- **`src/lib/auth.jsx`** adds `OrganizationProfile` to its exports (the real Clerk component, alongside `OrganizationSwitcher`).
- **Routing.** `App.jsx` removes `/admin` from `PLACEHOLDER_ROUTES` and adds a real route. Because `<OrganizationProfile routing="path" path="/admin" />` owns internal sub-navigation, the route path becomes **`/admin/*`** (a splat) rendering `<Admin/>`. It stays inside the existing `ProtectedRoute → RequireOrg → OrgScopedProviders → AppShell` group.
- **`src/pages/Admin.jsx`** (new):
  - Reads `useOrganization().membership?.role`. **Non-admin** → `PageHeader` + a single "Admin access required" `Card` (lock icon, guidance), nothing else.
  - **Admin** → two stacked `Card`s:
    1. **Organization & members** — renders `<OrganizationProfile routing="path" path="/admin" />` (Clerk handles members list, invitations, role changes, and org name/logo/slug). No custom member UI.
    2. **Danger zone** — two actions, "Reload demo data" (reset) and "Clear all data" (clear). Each opens a **typed-confirmation dialog** requiring the user to type the action word (`reset` / `clear`) before the confirm button enables. On confirm: `api.post('/api/org/reset', {})` or `api.post('/api/org/clear', {})`, then `window.location.reload()` (org-keyed providers remount with fresh data — same one-shot pattern as the 7a seed).
  - Reset/clear are called via the `api` client directly from the page (no new context), mirroring the Dashboard seed handler. A small local `busy`/`error` state drives button disabled/label.
- **`src/components/layout/Sidebar.jsx`** filters the `Admin` nav item out for non-admins (reads `useOrganization().membership?.role`). All other items unchanged.
- **Confirmation dialog** is a small reusable piece (`ConfirmDialog`): title, body, a required typed phrase, Cancel + a destructive confirm button enabled only when the typed text matches. Used for both danger-zone actions.

## Data Flow (destructive action)

```
Admin Danger zone → typed confirmation ("reset"/"clear") → confirm enabled
        │  api.post('/api/org/reset' | '/api/org/clear', {})
        ▼
getToken() → Bearer token carries org_role
        │
        ▼
requireOrgAdmin → requireAuth (401/403-no-org) → orgRole !== 'org:admin' ? 403
        │  req.auth = { userId, orgId, orgRole }
        ▼
prisma.$transaction:
   clear  → deleteMany ×5 (contract,risk,esg,spend → supplier), where { orgId }
   reset  → the 5 deleteMany, then createMany ×5 buildSeedData(orgId) in FK order
        ▼
{ cleared|reset: true } → window.location.reload() → providers refetch the org
```

## Testing

- **`api/_lib/auth.test.js`** — extend: the existing 7a success test asserts `req.auth` `toEqual({ userId, orgId })`; that assertion must be **updated** to include `orgRole` (e.g. the token now carries `org_role` and `req.auth` becomes `{ userId, orgId, orgRole }`). Add a case where a verified token has **no** `org_role` → `req.auth.orgRole === null`. New `requireOrgAdmin` tests: `org:admin` → handler called; `org:member` → 403, handler not called; missing role → 403.
- **`api/org/clear.test.js`** — mocks auth (identity) + prisma. Admin request (`auth.orgRole:'org:admin'`): asserts `$transaction` is called with five `deleteMany({ where: { orgId: 'org_test' } })` in child-first order, returns `{ cleared: true }`; 405 on non-POST. (Because `requireOrgAdmin` is mocked as identity here, add one **integration-style** assertion in `auth.test.js` that the real wrapper 403s a member — the per-endpoint tests focus on the data logic.)
- **`api/org/reset.test.js`** — admin request: asserts the `$transaction` payload contains the five `deleteMany` then five `createMany` (suppliers first), `buildSeedData` mocked; returns `{ reset: true }`; 405 on non-POST.
- **Frontend** — `src/test/setup.js` stubs `OrganizationProfile` as `<div data-testid="org-profile">` and the mocked `useOrganization` returns `membership` from `authState`; `src/test/authState.js` gains a mutable `membership: { role: 'org:admin' }` (reset each test; tests flip to `'org:member'`).
  - **`src/pages/Admin.test.jsx`** — admin: renders `org-profile` + "Danger zone" with both buttons; clicking a danger button shows the confirm dialog, typing the phrase enables confirm, confirming POSTs the right endpoint and triggers reload (mocked). Member: shows "Admin access required", no `org-profile`, no danger zone.
  - **`layout.test.jsx`** — Sidebar shows the Admin link for an admin (default) and **hides** it for a member.
- **Manual (deferred until Organizations enabled in Clerk):** sign in as org admin → invite a teammate by email → they accept → promote/demote/remove them → "Reload demo data" wipes + re-seeds → "Clear all data" empties the org → sign in as a member → no Admin nav item, `/admin` shows the refusal screen, and a direct `POST /api/org/clear` returns 403.

## Out of Scope (deferred)

- Granular per-feature permissions (e.g. "only admins may delete a supplier" across the app)
- Billing, plans, and org branding beyond Clerk's `<OrganizationProfile/>`
- An audit log / history of admin actions
- Bulk member import, SCIM, SSO configuration
- Soft-delete / export-before-clear (clear is a hard delete)
