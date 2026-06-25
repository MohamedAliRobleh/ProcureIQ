# Lot D — Granular Permissions — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Summary

Replace the binary admin/member access with a declarative, per-resource permission
layer. Reads stay open to every org member; **write/manage actions** (create, edit,
delete, and derived actions) are gated. With the in-app map keyed on the Clerk org role,
the default tiers are: `org:member` = **read-only**; `org:admin` = full manage + admin.
The permission layer is enforced on BOTH the backend (the security boundary — write
endpoints return `403` for members) and the frontend (write affordances are hidden).

The map is the deliverable: a single declarative source (`canManage(orgRole, resource)`)
mirrored on backend and frontend, trivially extensible to more roles/resources later
without touching call sites.

## Scope (and non-goals)

In scope:
- `api/_lib/permissions.js` + `src/lib/permissions.js` (mirrored `canManage` + resources).
- `usePermissions()` frontend hook.
- Backend `403` gating on every write/action endpoint of the six data resources, plus
  `POST /api/org/seed` (now admin-only).
- Frontend hiding/disabling of write affordances across the data pages + the Dashboard
  "Load sample data" panel.
- Tests for all of the above.

Non-goals (YAGNI):
- No Clerk-dashboard custom roles/permissions (the map is in-app, on the two existing roles).
- No DB role/permission model.
- No third role tier (the map supports it later, but we ship admin + member only).
- No change to read endpoints, and no change to the already-admin-only
  clear/reset/export/audit endpoints.

## Permission model

`MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'risk', 'esg', 'portal']`.

`canManage(orgRole, resource)`: returns `true` iff `orgRole === 'org:admin'` (and
`resource` is a known manage-resource). Member → `false`. This is the single product rule;
keeping it in one function means a future "manager" role or per-resource grant is a
one-place change.

Backend `api/_lib/permissions.js`:

```js
export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'risk', 'esg', 'portal']

// True if the given Clerk org role may create/edit/delete the resource. Reads are
// open to all members; only "manage" actions are gated. Admin manages everything.
export function canManage(orgRole, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return orgRole === 'org:admin'
}
```

Frontend `src/lib/permissions.js` is the same `MANAGE_RESOURCES` + `canManage`, plus a
hook:

```js
import { useOrganization } from './auth'
export function usePermissions() {
  const { membership } = useOrganization()
  const role = membership?.role ?? null
  return { role, canManage: (resource) => canManage(role, resource) }
}
```

## Backend enforcement (security boundary)

`req.auth.orgRole` is already set by `requireAuth`. In the **write branch** of each
handler (GET stays open), add at the top of the branch:

```js
if (!canManage(req.auth.orgRole, '<resource>')) {
  return res.status(403).json({ error: 'You do not have permission to manage <resource>' })
}
```

Endpoints to gate (resource in parens):
- `api/suppliers/index.js` POST, `api/suppliers/[id].js` PATCH — `suppliers`.
- `api/contracts/index.js` POST, `api/contracts/[id].js` PATCH, `api/contracts/summarize.js`,
  `api/contracts/upload-signature.js`, `api/contracts/notify.js` — `contracts`.
- `api/spend/index.js` POST, `api/spend/[id].js` PATCH — `spend`.
- `api/risk/index.js` POST, `api/risk/[id].js` PATCH — `risk`.
- `api/esg/index.js` POST, `api/esg/[id].js` PATCH — `esg`.
- `api/portal-requests/index.js` POST, `api/portal-requests/[id].js` PATCH+DELETE,
  `api/portal-requests/notify.js` — `portal`.
- `api/org/seed.js` — now admin-only: gate with `req.auth.orgRole !== 'org:admin'` → `403`
  (seed is org-wide, not a single resource; use the role check directly, or `canManage`
  is not a fit — use an explicit admin check to keep intent clear).

The check runs after the method guard and any 503/“unconfigured” guard that must precede
DB work (e.g. notify's `isEmailConfigured`), but before any write. For the action
endpoints (summarize/upload-signature/notify) which are POST-only, the check goes right
after the method guard.

## Frontend enforcement (UX)

`usePermissions()` drives hiding/disabling of write affordances. A member sees data
read-only with no action buttons. Pages/components to gate (resource):
- `src/pages/Suppliers.jsx` — "Add Supplier" + row Edit (`suppliers`).
- `src/pages/SupplierDetail.jsx` — edit affordances (`suppliers`).
- `src/pages/Contracts.jsx` + `ContractSlideOver` — "Add Contract", Edit, and the
  slide-over Summarize/Upload/Notify actions (`contracts`).
- `src/pages/Spend.jsx` — Add/Edit (`spend`).
- `src/pages/Risk.jsx` — write affordances if any (`risk`).
- `src/pages/ESG.jsx` — write affordances if any (`esg`).
- `src/pages/Portal.jsx` + `PortalRequestSlideOver` — "New request", status actions,
  notify, delete (`portal`).
- `src/pages/Dashboard.jsx` — the empty-org "Load sample data" panel becomes admin-only;
  a member sees a short "Ask an organization admin to load data." note instead.

Implementation pattern: each page calls `usePermissions()` and conditionally renders the
write controls (`{canManage('contracts') && <Button>Add Contract</Button>}`). For
slide-over components that already take optional action props (e.g. `onNotify`,
`onSummarize`, `onUpload`, `onUpdate`), the page passes those props only when the user can
manage, so the existing "gated section" pattern hides them automatically.

## Testing

Suite must stay green (currently 386). Existing handler tests use
`auth: { orgRole: 'org:admin' }` (or set it) so they stay green; add a member-403 case per
gated endpoint.

- `api/_lib/permissions.test.js`: `canManage('org:admin', r)` true for each resource;
  `canManage('org:member', r)` false; unknown resource false.
- `src/lib/permissions.test.js` (+ the hook): same `canManage`; `usePermissions()` returns
  `canManage` bound to the current role (test with a mocked `useOrganization`).
- Each gated endpoint test (extend): a member (`orgRole: 'org:member'`) write → `403`, no
  prisma write; the existing admin happy-paths stay green (they already use admin or have
  `orgRole` added).
- `api/org/seed.test.js`: a member → `403`; admin still seeds.
- Page tests (extend, per page): with a member role (set `authState.membership.role =
  'org:member'`), the page renders without its write button(s); with admin, the buttons
  appear. Reuse the existing `authState` test seam.

NOTE on test infra: many handler tests don't currently set `orgRole` on `auth`. Where a
gated branch now reads `req.auth.orgRole`, the test must provide it. The plan spells out,
per file, adding `orgRole: 'org:admin'` to the existing happy-path `auth` objects so they
keep passing, plus the new member-403 case.

## Execution

Lot D of the deferred-hardening roadmap (the first that is a full feature, not hardening).
Built via `superpowers:subagent-driven-development` from a plan in
`docs/superpowers/plans/`, committed on a `7d-permissions` branch, merged `--no-ff` to
main. Decomposed into: the two permission helpers; backend gating grouped by resource;
frontend gating grouped by page. Each task ends green and independently reviewable.
