# Phase 6d: Cloudinary Contract Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload, view, and replace one PDF per contract — signed direct-to-Cloudinary so the secret stays server-side and large files bypass the function body limit.

**Architecture:** A backend endpoint signs a Cloudinary upload with the API secret (server-side only); the browser uploads the file directly to Cloudinary, then PATCHes the contract's `fileUrl`. A lazy cloudinary lib keeps the whole suite green **without credentials** (handler tests mock it; the endpoint 503s when unconfigured). The contract slide-over gets a Document section (upload / view / replace), wired through a new `ContractContext.attachContractDocument`.

**Tech Stack:** `cloudinary` SDK, Vite + React 19, existing Vercel `api/` + Prisma/Neon (6a) + Clerk auth (6b), Vitest + RTL + jsdom.

---

## KEY-OPTIONAL EXECUTION

`CLOUDINARY_*` creds are not required to implement or test this phase. Tasks 1–6 are fully implementable and testable without them — every handler test mocks `api/_lib/cloudinary.js`, the signature endpoint 503s when unconfigured, and the frontend tests stub both our signature route and the Cloudinary upload URL. **Only Task 7's live upload needs real creds and is explicitly deferred.**

---

## Scene setting (read before starting)

- Spec: `docs/superpowers/specs/2026-06-14-phase6d-cloudinary-files-design.md`.
- `Contract.fileUrl String?` already exists in the schema (6a) — no migration needed; it's been `null` until now.
- The established patterns to mirror:
  - **AI lib + key-optional:** `api/_lib/anthropic.js` (lazy `getAnthropic`/`isAiConfigured`); its test uses `// @vitest-environment node` because it loads the SDK. The cloudinary lib test mirrors this.
  - **Endpoint:** `api/contracts/summarize.js` — POST-only/405 → 400 (id) → 503 (unconfigured) → org-scoped `findFirst` (404) → work → return; `export default requireAuth(handler)`. Static filename wins over `[id].js`.
  - **Context method:** `ContractContext.summarizeContract(id)` (6c) — returns a promise, merges the updated contract, `.catch` sets error + re-throws. `attachContractDocument` mirrors it.
  - **Slide-over gating:** `ContractSlideOver` renders the AI Summary block only when `onSummarize` is passed; the Document block follows the same gate on `onUpload`.
  - **Frontend fetch stub:** `src/test/mockApi.js` (`createMockFetch`) already stubs `/api/assistant`, `/api/contracts/summarize`, the collections, and PATCH. Add the signature route + the Cloudinary URL.
- `src/lib/apiClient.js` exports `api.get/post/patch` (attaches the Clerk bearer token). The Cloudinary upload does NOT use apiClient (cross-origin, no token) — it uses raw `fetch`.
- Suite baseline: 43 files / 267 tests green. ESLint baseline: 9 errors (3 `set-state-in-effect`, 6 `only-export-components`); `api/**` has Node globals via `eslint.config.js`.
- Test runner: `npm test -- <file>`; full `npm test`.

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `package.json` | Modify | add `cloudinary` |
| `.env.example` | Modify | document the 3 `CLOUDINARY_*` vars |
| `api/_lib/cloudinary.js` (+ `cloudinary.test.js`) | Create | `isUploadConfigured`, `uploadConfig`, `signUpload` |
| `api/contracts/upload-signature.js` (+ `.test.js`) | Create | org-scoped signed-upload params |
| `src/lib/cloudinaryUpload.js` (+ `.test.js`) | Create | browser → Cloudinary direct upload |
| `src/test/mockApi.js` | Modify | stub signature route + Cloudinary URL |
| `src/context/ContractContext.jsx` (+ test) | Modify | `attachContractDocument(id, file)` |
| `src/components/ui/ContractSlideOver.jsx` (+ test) | Modify | Document section (upload/view/replace) |
| `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx` | Modify | pass `onUpload` |
| `src/pages/Contracts.test.jsx` | Modify | upload-from-slide-over test |

---

### Task 1: Cloudinary lib + env docs

**Files:**
- Modify: `package.json` (via npm install), `.env.example`
- Create: `api/_lib/cloudinary.js`, `api/_lib/cloudinary.test.js`

- [ ] **Step 1: Install the SDK**

```bash
npm install cloudinary
```

- [ ] **Step 2: Document the env keys**

Append to `.env.example`:

```
# Cloudinary (get yours at cloudinary.com → dashboard → API Keys)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

- [ ] **Step 3: Write the failing tests**

Create `api/_lib/cloudinary.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { isUploadConfigured, uploadConfig, signUpload } from './cloudinary.js'

const ORIGINAL = {
  name: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
}

function restore(k, v) {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

afterEach(() => {
  restore('CLOUDINARY_CLOUD_NAME', ORIGINAL.name)
  restore('CLOUDINARY_API_KEY', ORIGINAL.key)
  restore('CLOUDINARY_API_SECRET', ORIGINAL.secret)
})

describe('cloudinary lib', () => {
  it('isUploadConfigured is true only when all three vars are set', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
    expect(isUploadConfigured()).toBe(false)
    process.env.CLOUDINARY_CLOUD_NAME = 'demo'
    process.env.CLOUDINARY_API_KEY = '123'
    expect(isUploadConfigured()).toBe(false)
    process.env.CLOUDINARY_API_SECRET = 'shh'
    expect(isUploadConfigured()).toBe(true)
  })

  it('uploadConfig returns the public cloud name and api key', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'democloud'
    process.env.CLOUDINARY_API_KEY = '999'
    expect(uploadConfig()).toEqual({ cloudName: 'democloud', apiKey: '999' })
  })

  it('signUpload returns a 40-char hex signature', () => {
    process.env.CLOUDINARY_API_SECRET = 'test-secret'
    const sig = signUpload({ timestamp: 1700000000, folder: 'procureiq/org_demo/contracts' })
    expect(sig).toMatch(/^[a-f0-9]{40}$/)
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- api/_lib/cloudinary.test.js`
Expected: FAIL — cannot find module `./cloudinary.js`

- [ ] **Step 5: Implement**

Create `api/_lib/cloudinary.js`:

```js
import { v2 as cloudinary } from 'cloudinary'

// True only when all three Cloudinary env vars are present. The signature
// endpoint checks this and 503s otherwise, so the app degrades gracefully
// when uploads aren't configured (no creds yet).
export function isUploadConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )
}

// The public values the browser is allowed to receive (never the secret).
export function uploadConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  }
}

// Signs the params the browser will send to Cloudinary. The secret is used
// here and never leaves the server.
export function signUpload(paramsToSign) {
  return cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- api/_lib/cloudinary.test.js`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example api/_lib/cloudinary.js api/_lib/cloudinary.test.js
git commit -m "feat: add Cloudinary lib (config guard + upload signing)"
```

---

### Task 2: `/api/contracts/upload-signature` endpoint

**Files:**
- Create: `api/contracts/upload-signature.js`, `api/contracts/upload-signature.test.js`

> Static filename — Vercel routes `POST /api/contracts/upload-signature` here (static wins over the dynamic `[id].js`).

- [ ] **Step 1: Write the failing tests**

Create `api/contracts/upload-signature.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn() } },
}))
vi.mock('../_lib/cloudinary.js', () => ({
  isUploadConfigured: vi.fn(),
  uploadConfig: vi.fn(),
  signUpload: vi.fn(),
}))

import handler from './upload-signature.js'
import { prisma } from '../_lib/prisma.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/upload-signature', () => {
  it('returns signed upload params for a contract in the org', async () => {
    isUploadConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    uploadConfig.mockReturnValue({ cloudName: 'democloud', apiKey: '999' })
    signUpload.mockReturnValue('SIGNATURE')
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' } }, res)

    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })
    const signedParams = signUpload.mock.calls[0][0]
    expect(signedParams.folder).toBe('procureiq/org_demo/contracts')
    expect(typeof signedParams.timestamp).toBe('number')
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toMatchObject({
      cloudName: 'democloud',
      apiKey: '999',
      folder: 'procureiq/org_demo/contracts',
      signature: 'SIGNATURE',
    })
    expect(typeof payload.timestamp).toBe('number')
  })

  it('returns 404 when the contract is not in the org', async () => {
    isUploadConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(signUpload).not.toHaveBeenCalled()
  })

  it('returns 503 when uploads are not configured (before any DB call)', async () => {
    isUploadConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- api/contracts/upload-signature.test.js`
Expected: FAIL — cannot find module `./upload-signature.js`

- [ ] **Step 3: Implement**

Create `api/contracts/upload-signature.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isUploadConfigured()) return res.status(503).json({ error: 'File uploads are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: ORG_ID } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `procureiq/${ORG_ID}/contracts`
    const signature = signUpload({ timestamp, folder })
    const { cloudName, apiKey } = uploadConfig()

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- api/contracts/upload-signature.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add api/contracts/upload-signature.js api/contracts/upload-signature.test.js
git commit -m "feat: add /api/contracts/upload-signature (org-scoped signed upload)"
```

---

### Task 3: Browser upload helper

**Files:**
- Create: `src/lib/cloudinaryUpload.js`, `src/lib/cloudinaryUpload.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/cloudinaryUpload.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { uploadToCloudinary } from './cloudinaryUpload'

const sig = {
  cloudName: 'democloud',
  apiKey: '999',
  timestamp: 1700000000,
  folder: 'procureiq/org_demo/contracts',
  signature: 'SIGNATURE',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadToCloudinary', () => {
  it('POSTs the file with the signed params and returns secure_url', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/democloud/x.pdf' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['pdf-bytes'], 'contract.pdf', { type: 'application/pdf' })
    const url = await uploadToCloudinary(file, sig)

    expect(url).toBe('https://res.cloudinary.com/democloud/x.pdf')
    const [calledUrl, options] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.cloudinary.com/v1_1/democloud/auto/upload')
    expect(options.method).toBe('POST')
    const form = options.body
    expect(form.get('signature')).toBe('SIGNATURE')
    expect(form.get('timestamp')).toBe('1700000000')
    expect(form.get('folder')).toBe('procureiq/org_demo/contracts')
    expect(form.get('api_key')).toBe('999')
    expect(form.get('file')).toBe(file)
  })

  it('throws when Cloudinary responds non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: { message: 'bad' } }) })))
    const file = new File(['x'], 'c.pdf', { type: 'application/pdf' })
    await expect(uploadToCloudinary(file, sig)).rejects.toThrow('Upload failed')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/cloudinaryUpload.test.js`
Expected: FAIL — cannot find module `./cloudinaryUpload`

- [ ] **Step 3: Implement**

Create `src/lib/cloudinaryUpload.js`:

```js
// Uploads a file directly from the browser to Cloudinary using params signed
// by our backend. Cross-origin to Cloudinary — no bearer token involved.
export async function uploadToCloudinary(file, { cloudName, apiKey, timestamp, folder, signature }) {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  form.append('timestamp', String(timestamp))
  form.append('folder', folder)
  form.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.secure_url
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/cloudinaryUpload.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cloudinaryUpload.js src/lib/cloudinaryUpload.test.js
git commit -m "feat: add browser->Cloudinary direct upload helper"
```

---

### Task 4: ContractContext.attachContractDocument + stub routes

**Files:**
- Modify: `src/test/mockApi.js`, `src/context/ContractContext.jsx`, `src/context/ContractContext.test.jsx`

- [ ] **Step 1: Add the stub routes**

In `src/test/mockApi.js`, add these two checks immediately after the existing `if (method === 'POST' && url === '/api/contracts/summarize') {...}` block (and before the `if (method === 'GET')` block):

```js
    if (method === 'POST' && url === '/api/contracts/upload-signature') {
      return jsonResponse({
        cloudName: 'democloud',
        apiKey: '999',
        timestamp: 1700000000,
        folder: 'procureiq/org_demo/contracts',
        signature: 'MOCK_SIGNATURE',
      })
    }
    if (method === 'POST' && url.startsWith('https://api.cloudinary.com/')) {
      return jsonResponse({ secure_url: 'https://res.cloudinary.com/democloud/mock.pdf' })
    }
```

- [ ] **Step 2: Write the failing test**

In `src/context/ContractContext.test.jsx`, add this test before the `'throws when used outside ContractProvider'` test:

```jsx
  it('attachContractDocument uploads and sets fileUrl on the matching contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    const file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })
    await act(async () => {
      await result.current.attachContractDocument(id, file)
    })
    expect(result.current.contracts.find((c) => c.id === id).fileUrl).toBe(
      'https://res.cloudinary.com/democloud/mock.pdf'
    )
  })
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: FAIL — `result.current.attachContractDocument is not a function`

- [ ] **Step 4: Implement**

In `src/context/ContractContext.jsx`:

Add the import at the top (after the `apiClient` import):

```jsx
import { uploadToCloudinary } from '../lib/cloudinaryUpload'
```

Add this function after `summarizeContract`:

```jsx
  function attachContractDocument(id, file) {
    return api
      .post('/api/contracts/upload-signature', { id })
      .then((sig) => uploadToCloudinary(file, sig))
      .then((fileUrl) => api.patch(`/api/contracts/${id}`, { fileUrl }))
      .then((updated) => {
        setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
        return updated
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }
```

Add `attachContractDocument` to the provider value:

```jsx
    <ContractContext.Provider
      value={{ contracts, isLoading, error, addContract, updateContract, setContractStatus, summarizeContract, attachContractDocument }}
    >
```

- [ ] **Step 5: Run to verify pass, then the full suite**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: PASS (7 tests)

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 6: Commit**

```bash
git add src/test/mockApi.js src/context/ContractContext.jsx src/context/ContractContext.test.jsx
git commit -m "feat: add attachContractDocument to ContractContext + upload stubs"
```

---

### Task 5: ContractSlideOver Document section

**Files:**
- Modify: `src/components/ui/ContractSlideOver.jsx`, `src/components/ui/ContractSlideOver.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/ui/ContractSlideOver.test.jsx`, add these two tests at the end of the `describe` block:

```jsx
  it('renders a View document link when the contract has a fileUrl', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: { ...mockContract, fileUrl: 'https://res.cloudinary.com/democloud/x.pdf' },
      supplier: mockSupplier,
      onEdit: () => {},
      onUpload: vi.fn(),
    })
    const link = screen.getByRole('link', { name: 'View document' })
    expect(link).toHaveAttribute('href', 'https://res.cloudinary.com/democloud/x.pdf')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('calls onUpload with the selected file', () => {
    const onUpload = vi.fn().mockResolvedValue({})
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onUpload,
    })
    const input = screen.getByTestId('contract-file-input')
    const file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onUpload).toHaveBeenCalledWith(file)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: FAIL — no "View document" link / `contract-file-input` not found

- [ ] **Step 3: Implement**

In `src/components/ui/ContractSlideOver.jsx`:

Add `useRef` to the React import (line 1):

```jsx
import { useEffect, useRef, useState } from 'react'
```

Add `onUpload` to the component signature:

```jsx
export default function ContractSlideOver({ isOpen, onClose, contract, supplier, onEdit, onSummarize, onUpload }) {
```

Add upload state + handlers right after the existing `summaryError` state declaration (before `if (!contract) return null`):

```jsx
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await onUpload(file)
    } catch {
      setUploadError('Could not upload the document. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }
```

Add the Document block inside the scroll area, immediately after the `{onSummarize && (...)}` block and before the closing `</div>` of the `flex-1 ... overflow-y-auto` container:

```jsx
              {onUpload && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Document</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    data-testid="contract-file-input"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {contract.fileUrl ? (
                    <div className="flex items-center gap-3">
                      <a
                        href={contract.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent-blue-light hover:underline"
                      >
                        View document
                      </a>
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {isUploading ? 'Uploading…' : 'Replace'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? 'Uploading…' : 'Upload document'}
                    </Button>
                  )}
                  {uploadError && <p className="mt-1 text-xs text-accent-red">{uploadError}</p>}
                </div>
              )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: PASS (9 tests — 7 existing + 2 new; the 7 existing pass no `onUpload`, so the Document section doesn't render for them)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ContractSlideOver.jsx src/components/ui/ContractSlideOver.test.jsx
git commit -m "feat: add Document upload/view section to ContractSlideOver"
```

---

### Task 6: Wire onUpload into the pages

**Files:**
- Modify: `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx`, `src/pages/Contracts.test.jsx`

- [ ] **Step 1: Write the failing page test**

In `src/pages/Contracts.test.jsx`, add this test at the end of the `describe('Contracts', ...)` block:

```jsx
  it('uploads a document from the contract slide-over', async () => {
    renderContracts()
    fireEvent.click(await screen.findByText('Master Supply Agreement — Atlas Steelworks'))
    const input = screen.getByTestId('contract-file-input')
    const file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole('link', { name: 'View document' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/pages/Contracts.test.jsx`
Expected: FAIL — `contract-file-input` not found (the page doesn't pass `onUpload` yet)

- [ ] **Step 3: Wire Contracts.jsx**

In `src/pages/Contracts.jsx`:

- Add `attachContractDocument` to the context destructuring (line 18):

```jsx
  const { contracts, addContract, updateContract, summarizeContract, attachContractDocument } = useContractContext()
```

- Add `onUpload` to the `<ContractSlideOver>` (the block at lines 205–212), after the `onSummarize` line:

```jsx
        onSummarize={liveSelected ? () => summarizeContract(liveSelected.id) : undefined}
        onUpload={liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}
      />
```

- [ ] **Step 4: Wire SupplierDetail.jsx**

In `src/pages/SupplierDetail.jsx`:

- Add `attachContractDocument` to the context destructuring (line 32):

```jsx
  const { contracts, addContract, updateContract, summarizeContract, attachContractDocument } = useContractContext()
```

- Add `onUpload` to the `<ContractSlideOver>` (the block at lines 196–203), after the `onSummarize` line:

```jsx
          onSummarize={liveSelected ? () => summarizeContract(liveSelected.id) : undefined}
          onUpload={liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}
        />
```

- [ ] **Step 5: Run the page tests, then the full suite**

Run: `npm test -- src/pages/Contracts.test.jsx src/pages/SupplierDetail.test.jsx`
Expected: PASS

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Contracts.jsx src/pages/SupplierDetail.jsx src/pages/Contracts.test.jsx
git commit -m "feat: wire contract document upload into Contracts and SupplierDetail slide-overs"
```

---

### Task 7: Final gate

**Files:** none (verification only; commit stragglers if real fixes surface).

- [ ] **Step 1: Full suite** — `npm test`, run twice; report exact counts (baseline 43 files / 267 tests + new: `cloudinary` 3, `upload-signature` 5, `cloudinaryUpload` 2, `ContractContext` +1, `ContractSlideOver` +2, `Contracts` +1 ≈ +14 tests across +3 files → ~46 files / ~281 tests).

- [ ] **Step 2: Lint** — `npx eslint src api`; expect no NEW categories beyond the 9-error baseline (`set-state-in-effect`, `only-export-components`). Fix any unused-var/import the new files introduce.

- [ ] **Step 3: Confirm key-optional posture** — verify the whole suite is green with NO `CLOUDINARY_*` vars set (it is — every handler test mocks `_lib/cloudinary.js`; the lib test sets/restores its own env). Do NOT print `.env` or env vars to confirm this; rely only on the passing suite.

- [ ] **Step 4: DEFERRED live verification (requires `CLOUDINARY_*` creds)** — do NOT run now. When the user adds `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` to `.env`:
  1. `vercel dev`, sign in.
  2. Open a contract → "Upload document" → pick a PDF → it uploads to Cloudinary and a "View document" link appears that opens the PDF.
  3. Refresh → the link persists (fileUrl in the DB).
  4. "Replace" → swaps to a new PDF.
  5. Temporarily blank a `CLOUDINARY_*` var → the Upload button surfaces the "File uploads are not configured" error (503).

- [ ] **Step 5: Report** — suite counts, lint result, and the deferred-step checklist for the user.

---

## Self-Review Notes

- **Spec coverage:** cloudinary lib + secret-server-side (Task 1); signed signature endpoint, org-scoped, 503/404/400/405 (Task 2); browser direct-upload helper (Task 3); `attachContractDocument` + stub routes (Task 4); slide-over Document section with upload/view/replace (Task 5); page wiring (Task 6); testing strategy and deferred live check (Task 7). Spec's "static filename wins over `[id].js`" → Task 2. Spec's "signed params = upload params" → Task 3 sends exactly `timestamp`/`folder` + `file`/`api_key`/`signature`, matching what Task 2 signs.
- **Key-optional:** the central constraint. Lib never reads the secret except in `signUpload`; the endpoint 503s before any DB call when unconfigured; every handler/frontend test mocks the cloudinary boundary; the lib test sets/restores its own env. Only Task 7 Step 4 needs creds, and it's deferred.
- **Type consistency:** `isUploadConfigured`/`uploadConfig`/`signUpload` (Task 1) consumed in Task 2. The signature payload shape `{ cloudName, apiKey, timestamp, folder, signature }` (Task 2) is exactly what `uploadToCloudinary` destructures (Task 3) and what the mockApi stub returns (Task 4). `attachContractDocument(id, file)` (Task 4) is the prop the slide-over's `onUpload(file)` calls (Task 5), supplied by the pages (Task 6). `contract-file-input` testid (Task 5) used in Tasks 5–6. The Cloudinary URL `https://api.cloudinary.com/v1_1/<cloud>/auto/upload` (Task 3) matches the mockApi `startsWith('https://api.cloudinary.com/')` stub (Task 4).
- **Slide-over regression:** the Document block is gated on `onUpload`; the 7 existing ContractSlideOver tests pass no `onUpload`, so it doesn't render for them — they stay green (Task 5 expects 9 total).
- **No App.jsx change.** No migration (the `fileUrl` column already exists).
- **No placeholders:** every step has complete, runnable code; existing-file edits give exact anchors.
