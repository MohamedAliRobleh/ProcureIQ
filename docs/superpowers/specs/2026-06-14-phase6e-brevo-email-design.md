# ProcureIQ Phase 6e: Brevo Email Notifications — Design Spec

## Context

Phase 6a–6d put the app on Neon/Prisma, Clerk auth, real Claude, and Cloudinary file uploads. 6e adds email notifications — the last integration in Phase 6.

**Phase 6 decomposition:** 6a backend+DB ✅ → 6b Clerk auth ✅ → 6c Anthropic AI ✅ → 6d Cloudinary files ✅ → **6e Email (this spec)**. Phase 7 (Admin + Portal) follows.

**Decisions made during brainstorming:**
- **Provider: Brevo** (transactional email REST API), not EmailJS. Brevo is server-side-first — a single API key, no public/private split, no browser SDK — which fits the established "secrets stay in a Vercel function" pattern.
- **Feature:** a manual "Email reminder" button on the contract slide-over (alongside the AI Summary and Document sections).
- **Recipient:** the signed-in user's own email (from Clerk's `useUser`).
- **Key-optional** (like 6c/6d): no Brevo creds → the notify endpoint 503s and the suite stays green. User has a Brevo account and will add the `BREVO_*` vars to `.env`.

## Goal

A signed-in user opens a contract, clicks "Email reminder", and receives an email with that contract's details (title, value, status, expiry). The Brevo API key stays server-side; the suite runs green without creds.

## Architecture

### The key stays server-side

`api/_lib/email.js` is the only module that reads the Brevo env vars:

- `isEmailConfigured()` — true when `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are both set.
- `sendEmail({ to, subject, html })` — `POST`s to `https://api.brevo.com/v3/smtp/email` with header `api-key: <BREVO_API_KEY>` and body `{ sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME ?? 'ProcureIQ' }, to: [{ email: to }], subject, htmlContent: html }`. Throws on a non-OK response. Raw `fetch` (available in the Vercel Node runtime) — **no SDK to install**.

The frontend never imports this module or any key.

> Brevo requires the sender to be a **verified sender or domain** in the account; unverified senders fail at send time (surfaced as a 502 from the notify endpoint).

### `POST /api/contracts/notify`

Static filename (`notify.js`, like `summarize.js` / `upload-signature.js` — static wins over the dynamic `[id].js`).

1. `requireAuth`.
2. POST-only (405); 400 if `id` or `toEmail` is missing; **503** if `!isEmailConfigured()` (before any DB call).
3. Org-scoped `findFirst({ where: { id, orgId: ORG_ID } })` → 404 if absent.
4. Build a subject (`Reminder: <contract title>`) and inline HTML (title, supplier value/currency, status, end date / expiry) from the contract.
5. `sendEmail({ to: toEmail, subject, html })` → `{ ok: true }`. A Brevo failure throws → **502** `{ error }`.

### Frontend

- `ContractContext.notifyContract(id, toEmail)` (mirrors `summarizeContract`/`attachContractDocument`, but performs no state mutation — sending an email isn't contract data): `api.post('/api/contracts/notify', { id, toEmail })`, returns the promise; `.catch` re-throws so the slide-over can show an error.
- `ContractSlideOver` gets an optional `onNotify` prop and a **Notifications** section (gated on `onNotify`, so the existing tests are unaffected): an "Email reminder" button with local `isSending`/`notifyError` state, showing "Reminder sent ✓" on success and an inline error on failure.
- `Contracts.jsx` and `SupplierDetail.jsx` read the signed-in user's email via `useUser()` from the auth seam (`src/lib/auth.jsx`; its test mock already provides `amara.chen@procureiq-demo.com`) and pass `onNotify={liveSelected ? () => notifyContract(liveSelected.id, userEmail) : undefined}` (alongside the existing `onSummarize`/`onUpload`).

## Data Flow (after 6e)

```
ContractSlideOver ("Email reminder")
   │  notifyContract(id, userEmail)
   ▼
POST /api/contracts/notify {id, toEmail} ──requireAuth, org-scoped, 503 if unconfigured──▶ build subject+html
   │
   ▼
sendEmail({to, subject, html}) ──api-key──▶ POST https://api.brevo.com/v3/smtp/email  →  { ok: true } | 502
```

## Testing

- **`api/_lib/email.test.js`** — stubs global `fetch`: `isEmailConfigured` reflects the two required env vars; `sendEmail` POSTs to the Brevo URL with the `api-key` header and a body carrying `sender`/`to`/`subject`/`htmlContent`; throws on a non-OK response. Restores env in `afterEach`. (No SDK loaded → default jsdom env is fine.)
- **`api/contracts/notify.test.js`** — mocks `_lib/auth`, `_lib/prisma`, `_lib/email`: success returns `{ ok: true }` and calls `sendEmail` with the recipient + a subject containing the contract title; 404 when the contract isn't in the org; 503 when unconfigured (before `findFirst`); 400 for missing `id`/`toEmail`; 405 non-POST; 502 when `sendEmail` throws.
- **`src/test/mockApi.js`** — stub `POST /api/contracts/notify` → `{ ok: true }`.
- **`ContractContext.test.jsx`** — `notifyContract(id, email)` resolves to `{ ok: true }` (no contract mutation).
- **`ContractSlideOver.test.jsx`** — with `onNotify`: the "Email reminder" button calls `onNotify`; after it resolves, "Reminder sent" appears. (Existing tests pass no `onNotify`, so the Notifications section doesn't render for them.)
- **`Contracts.test.jsx`** — open the slide-over, click "Email reminder", assert "Reminder sent" appears.
- **Manual (deferred until creds):** add `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` (+ optional `BREVO_SENDER_NAME`) to `.env`, verify the sender in Brevo, `vercel dev`, open a contract → "Email reminder" → the signed-in user receives the email. Without creds, the button surfaces the 503 "Email notifications are not configured" message.

## Out of Scope (deferred)

- Automated/scheduled expiry alerts (no scheduler in the app yet)
- Brevo email templates / template IDs (inline HTML built in the endpoint is enough)
- Other recipients (typed address, supplier contact)
- Notification history / audit log
- Notifications on other entities (suppliers, risk, ESG)
