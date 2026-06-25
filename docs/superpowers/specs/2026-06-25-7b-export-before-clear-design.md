# Lot B — Export-before-clear — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Summary

The admin Danger zone has two irreversible actions — `POST /api/org/clear` (wipe) and
`POST /api/org/reset` (wipe + re-seed). There is currently no way to recover the data.
This lot adds a **full JSON export** of the org's data so an admin can download a backup
before wiping. Per the UX decision, the export is a **standalone "Download backup" button**
at the top of the Danger zone (downloadable any time), plus a one-line reminder in the
clear/reset confirm dialogs. The shared `ConfirmDialog` component is **not** modified.

## Scope (and non-goals)

In scope:
- New admin-only `GET /api/org/export` returning all six models for the org as JSON.
- `src/lib/downloadJson.js` browser helper (object → downloaded file).
- An "Download backup (JSON)" button + reminder copy in `src/pages/Admin.jsx`.
- Tests for all of the above.

Non-goals (YAGNI):
- No import/restore endpoint (export only; restore would be a separate lot).
- No CSV/Excel — JSON only.
- No change to `ConfirmDialog`, `clear.js`, or `reset.js` behaviour (only the dialog
  description copy in Admin.jsx gains a reminder line).
- No forced/blocking export (the user chose the non-intrusive standalone option).

## Component: `GET /api/org/export`

New file `api/org/export.js`, wrapped in `requireOrgAdmin` (same gate as clear/reset).

- Method guard: non-GET → `405` with `Allow: GET`.
- Fetches each model org-scoped via `findMany({ where: { orgId } })`:
  `supplier`, `contract`, `riskAssessment`, `esgResponse`, `spendRecord`, `portalRequest`.
- Returns `200` with:

```json
{
  "exportedAt": "2026-06-25T12:00:00.000Z",
  "orgId": "org_...",
  "data": {
    "suppliers": [...],
    "contracts": [...],
    "riskAssessments": [...],
    "esgResponses": [...],
    "spendRecords": [...],
    "portalRequests": [...]
  }
}
```

`exportedAt` = `new Date().toISOString()`. `orgId` = `req.auth.orgId`. On error → `500`
with `{ error }` (matches the codebase convention).

This is read-only and additive — it does not touch clear/reset.

## Component: `src/lib/downloadJson.js`

A small, pure-ish browser helper (no React) so it is unit-testable:

```js
// Triggers a browser download of `data` serialized as pretty JSON, named `filename`.
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

## Frontend: `src/pages/Admin.jsx`

- Add an export handler that calls `api.get('/api/org/export')`, then
  `downloadJson(payload, \`procureiq-backup-${new Date().toISOString().slice(0, 10)}.json\`)`.
  Track a `exporting` busy flag and an `exportError` message (surfaced inline, same style
  as other inline errors in the app). Note: `api.get` already parses JSON, so the handler
  passes the parsed object straight to `downloadJson`.
- Render a **"Download backup (JSON)"** button at the TOP of the Danger zone card (above
  the Reload/Clear rows), with a short helper line ("Download a full JSON backup of this
  organization's data before clearing or resetting.").
- Append a reminder sentence to the `description` text of BOTH the reset and clear
  `ConfirmDialog`s: "Tip: download a backup from the Danger zone first." (copy only — no
  ConfirmDialog API change).
- The export button is inside the existing admin-gated render path, so non-admins never
  see it (the page already early-returns the access-required notice for non-admins).

## Testing

Suite must stay green (currently 375).

- `api/org/export.test.js` (mirror `clear.test.js` style): mock
  `requireOrgAdmin: (handler) => handler`; mock `prisma` with `findMany` for the six
  models. Assert each `findMany` is called with `{ where: { orgId: 'org_test' } }`; assert
  the response object has `exportedAt`, `orgId: 'org_test'`, and `data` with all six keys
  carrying the mocked rows; assert non-GET → `405`.
- `src/lib/downloadJson.test.js`: stub `URL.createObjectURL`/`URL.revokeObjectURL` and
  spy on anchor `click`; call `downloadJson({a:1}, 'x.json')`; assert a Blob URL was
  created, an anchor with `download === 'x.json'` was clicked, and the URL was revoked.
- `src/pages/Admin.test.jsx` (extend): add a test that clicking "Download backup (JSON)"
  calls `fetch('/api/org/export', ...)` (GET) and triggers the download (stub
  `URL.createObjectURL` + anchor `click`, mock fetch to return the export JSON). Reuse the
  existing `vi.stubGlobal('fetch', ...)` + `authState` admin setup.

## Execution

Lot B of the deferred-hardening roadmap. Built via
`superpowers:subagent-driven-development` from a plan in `docs/superpowers/plans/`,
committed on a `7b-export` branch, merged `--no-ff` to main (matching the established
phase/lot pattern).
