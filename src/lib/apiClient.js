let getToken = null

// Registered by the auth provider's TokenBridge; null in tests and when
// signed out, in which case requests go out without an Authorization header.
export function setTokenGetter(fn) {
  getToken = fn
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(path, {
    headers,
    ...options,
  })
  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`Request failed: ${path} did not return JSON (status ${res.status})`)
  }
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`)
  return body
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
