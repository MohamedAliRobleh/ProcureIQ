# ProcureIQ Phase 6d: Cloudinary Contract Files — Design Spec

## Context

Phase 6a–6c put the app on Neon/Prisma, Clerk auth, and real Claude. 6d adds contract document storage via Cloudinary: upload a PDF to a contract, view/download it, and replace it.

**Phase 6 decomposition:** 6a backend+DB ✅ → 6b Clerk auth ✅ → 6c Anthropic AI ✅ → **6d Cloudinary files (this spec)** → 6e EmailJS. Phase 7 (Admin + Portal) follows.

**Decisions made during brainstorming:**
- **Scope:** one PDF per contract (matches the single `Contract.fileUrl` column) — upload, view/download, replace.
- **Upload path:** signed **direct-to-Cloudinary** from the browser. A backend endpoint signs the request with the Cloudinary API secret; the file uploads straight to Cloudinary (bypassing Vercel's ~4.5MB function body limit); the secret never reaches the browser.
- **Key-optional** (like 6c): no Cloudinary creds → the signature endpoint 503s and the suite stays green. User has a Cloudinary account and will add `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` to `.env`.

## Goal

A signed-in user opens a contract, uploads the signed PDF, and sees a "View document" link that persists. Re-uploading replaces it. The Cloudinary secret stays server-side; large PDFs upload without hitting the function size limit.

## Architecture

### The secret stays server-side

`api/_lib/cloudinary.js` is the only module that reads the Cloudinary env vars:

- `isUploadConfigured()` — true when all three of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are set.
- `uploadConfig()` → `{ cloudName, apiKey }` — the **public** values the browser is allowed to see.
- `signUpload(paramsToSign)` → signature string, via the Cloudinary SDK's `cloudinary.v2.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET)`.

Install `cloudinary`. The frontend never imports it or any secret.

### `POST /api/contracts/upload-signature`

Static filename (`upload-signature.js`, like `summarize.js` — static wins over the dynamic `[id].js`).

1. `requireAuth`.
2. POST-only (405); 400 if no `id`; **503** if `!isUploadConfigured()` (before any DB call).
3. Org-scoped `findFirst({ where: { id, orgId: ORG_ID } })` → 404 if absent. (Requiring a real org contract before signing prevents anyone using the Cloudinary account as a free file host.)
4. Sign `{ timestamp: <unix seconds>, folder: 'procureiq/<ORG_ID>/contracts' }` and return `{ cloudName, apiKey, timestamp, folder, signature }`.

### Frontend upload

- `src/lib/cloudinaryUpload.js` — `uploadToCloudinary(file, { cloudName, apiKey, timestamp, folder, signature })`: builds a `FormData` (`file`, `api_key`, `timestamp`, `folder`, `signature`), raw-`fetch`-POSTs to `https://api.cloudinary.com/v1_1/<cloudName>/auto/upload`, returns `data.secure_url`. (Cross-origin to Cloudinary, no bearer token. Only the signed params — `timestamp`, `folder` — plus `file`/`api_key`/`signature` are sent, so the signature matches.)
- `ContractContext.attachContractDocument(id, file)` (mirrors `summarizeContract`): `api.post('/api/contracts/upload-signature', { id })` → `uploadToCloudinary(file, sig)` → `api.patch('/api/contracts/' + id, { fileUrl })` → merge the updated contract into state. Returns the promise; `.catch` sets error and re-throws.
- `ContractSlideOver` gets an optional `onUpload(file)` prop and a **Document** section (gated on `onUpload`, so the existing tests are unaffected): if `contract.fileUrl` → a "View document" link (`target="_blank"`, `rel="noopener noreferrer"`) plus a "Replace" button; else an "Upload document" button. Both trigger a hidden `<input type="file" accept=".pdf">`; selecting a file calls `onUpload(file)` with a spinner ("Uploading…") and an inline error on failure.
- `Contracts.jsx` and `SupplierDetail.jsx` pass `onUpload={liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}` (alongside the existing `onSummarize`), using the same live-contract re-derivation so the new `fileUrl` renders immediately.

## Data Flow (after 6d)

```
ContractSlideOver (pick PDF)
   │  attachContractDocument(id, file)
   ▼
POST /api/contracts/upload-signature {id} ──requireAuth, org-scoped, 503 if unconfigured──▶ signUpload({timestamp, folder})
   │  { cloudName, apiKey, timestamp, folder, signature }
   ▼
uploadToCloudinary(file, sig) ──direct POST──▶ https://api.cloudinary.com/.../auto/upload  →  { secure_url }
   │
   ▼
PATCH /api/contracts/{id} { fileUrl: secure_url }  →  Prisma.update  →  merged into context  →  "View document"
```

## Testing

- **`api/_lib/cloudinary.test.js`** (`// @vitest-environment node`, since it loads the Cloudinary SDK like the anthropic lib test) — `isUploadConfigured` reflects the three env vars; `uploadConfig` returns `{ cloudName, apiKey }`; `signUpload` returns a 40-char hex signature when the secret is set. Restores env in `afterEach`.
- **`api/contracts/upload-signature.test.js`** — mocks `_lib/auth`, `_lib/prisma`, `_lib/cloudinary`: success returns the signed params; 404 when the contract isn't in the org; 503 when unconfigured (before `findFirst`); 400 no id; 405 non-POST.
- **`src/lib/cloudinaryUpload.test.js`** — stubs `fetch` to the Cloudinary URL, asserts the returned `secure_url` and that the form carries `signature`/`timestamp`/`folder`; throws on a non-OK response.
- **`src/test/mockApi.js`** — stub `POST /api/contracts/upload-signature` → fake signature params; stub any `https://api.cloudinary.com/...` POST → `{ secure_url: 'https://res.cloudinary.com/demo/mock.pdf' }` (the existing PATCH stub handles `fileUrl`).
- **`ContractContext.test.jsx`** — `attachContractDocument` sets `fileUrl` to the mock `secure_url` on the matching contract.
- **`ContractSlideOver.test.jsx`** — renders a "View document" link with the right href when `fileUrl` is set; selecting a file on the hidden input calls `onUpload`. (The existing tests pass no `onUpload`, so the Document section doesn't render for them.)
- **`Contracts.test.jsx`** — open the slide-over, select a PDF, assert the "View document" link appears.
- **Manual (deferred until creds):** add the three `CLOUDINARY_*` vars to `.env`, `vercel dev`, upload a PDF to a contract → "View document" opens it on Cloudinary → refresh persists → replace swaps it. Without creds, the Upload button surfaces the 503 "File uploads are not configured" message.

## Out of Scope (deferred)

- Authenticated/private delivery (Cloudinary `secure_url`s are public-but-unguessable — acceptable for the demo)
- Deleting the previous Cloudinary asset when a document is replaced (old asset is orphaned)
- Multiple files per contract (needs a new table/relation — its own sub-phase)
- Virus scanning, file-size caps beyond Cloudinary's own, upload progress bars
- Documents on other entities (suppliers, ESG, etc.)
