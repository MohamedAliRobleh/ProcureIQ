import {
  isSandboxActive, parsePath, sandboxGet, sandboxCreate, sandboxUpdate, sandboxDelete,
} from './sandbox'

let getToken = null

// Registered by the auth provider's TokenBridge; null in tests and when
// signed out, in which case requests go out without an Authorization header.
export function setTokenGetter(fn) {
  getToken = fn
}

async function realRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(path, { headers, ...options })
  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`Request failed: ${path} did not return JSON (status ${res.status})`)
  }
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`)
  return body
}

async function request(path, options = {}) {
  const method = options.method ?? 'GET'
  if (isSandboxActive()) {
    const parsed = parsePath(path)
    if (parsed) {
      const body = options.body ? JSON.parse(options.body) : undefined
      if (method === 'GET' && parsed.id === null) {
        return sandboxGet(parsed.resource, () => realRequest(path, options))
      }
      if (method === 'POST' && parsed.id === null) {
        return sandboxCreate(parsed.resource, body)
      }
      if (method === 'PATCH' && parsed.id !== null) {
        return sandboxUpdate(parsed.resource, parsed.id, body)
      }
      if (method === 'DELETE' && parsed.id !== null) {
        return sandboxDelete(parsed.resource, parsed.id)
      }
      // POST/GET with an id segment (e.g. named sub-routes) → fall through
    }
  }
  return realRequest(path, options)
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
