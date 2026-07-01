// Client-only demo sandbox: mirrors the demo org's data in localStorage so a
// read-only visitor can create/edit/delete without touching the API/DB. The
// active flag is set by the DemoBridge (src/lib/auth.jsx) only in the demo org.

const NS = 'procureiq_sandbox_v1'
const keyFor = (resource) => `${NS}:${resource}`

// CRUD-intercepted resources (path names, matching /api/<name>).
export const SANDBOX_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal-requests']

let sandboxActive = false
export function setSandboxActive(active) {
  sandboxActive = !!active
}
export function isSandboxActive() {
  return sandboxActive
}

// /api/<resource> -> {resource, id:null}; /api/<resource>/<id> -> {resource, id};
// null when the first segment is not a managed resource or the path is deeper.
export function parsePath(path) {
  const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/')
  if (parts[0] !== 'api') return null
  const resource = parts[1]
  if (!SANDBOX_RESOURCES.includes(resource)) return null
  if (parts.length === 2) return { resource, id: null }
  if (parts.length === 3) return { resource, id: parts[2] }
  return null
}

function read(resource) {
  try {
    const raw = localStorage.getItem(keyFor(resource))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function write(resource, rows) {
  localStorage.setItem(keyFor(resource), JSON.stringify(rows))
}

let counter = 0
function localId(resource) {
  counter += 1
  return `sbx_${resource}_${Date.now()}_${counter}`
}

// Returns the snapshot; seeds it once from seedFn (the real API GET) if absent.
export async function sandboxGet(resource, seedFn) {
  const existing = read(resource)
  if (existing) return existing
  const seeded = await seedFn()
  write(resource, seeded)
  return seeded
}

export function sandboxCreate(resource, data) {
  const rows = read(resource) ?? []
  const record = { ...data, id: localId(resource) }
  write(resource, [...rows, record])
  return record
}

export function sandboxUpdate(resource, id, patch) {
  const rows = read(resource) ?? []
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) throw new Error('Not found')
  const { id: _ignored, ...rest } = patch ?? {}
  const updated = { ...rows[idx], ...rest }
  const next = [...rows]
  next[idx] = updated
  write(resource, next)
  return updated
}

export function sandboxDelete(resource, id) {
  const rows = read(resource) ?? []
  write(resource, rows.filter((r) => r.id !== id))
  return { deleted: true }
}

export function resetSandbox() {
  try {
    for (const resource of SANDBOX_RESOURCES) localStorage.removeItem(keyFor(resource))
  } catch {
    /* ignore */
  }
}
