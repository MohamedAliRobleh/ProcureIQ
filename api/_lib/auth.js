import { verifyToken } from '@clerk/backend'

// Reads the active org id + role from a verified Clerk session token, handling
// BOTH token formats: v1 (top-level `org_id` / `org_role`, e.g. "org:admin") and
// v2 (`v:2`, claims nested under `o` with abbreviated keys: `o.id` / `o.rol`,
// where the role drops the "org:" prefix, e.g. "admin"). Returns a normalized
// `{ orgId, orgRole }` with orgRole always in the "org:<role>" form (or null).
export function readOrg(payload) {
  const orgId = payload.org_id ?? payload.o?.id ?? null
  const rawRole = payload.org_role ?? payload.o?.rol ?? null
  const orgRole = rawRole && !rawRole.startsWith('org:') ? `org:${rawRole}` : rawRole
  return { orgId, orgRole }
}

// Wraps a handler so it only runs with a valid Clerk session token that
// carries an active organization. Networkless verification: the JWT is
// checked against CLERK_SECRET_KEY.
export function requireAuth(handler) {
  return async (req, res) => {
    const header = req.headers?.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    let payload
    try {
      payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { orgId, orgRole } = readOrg(payload)
    if (!orgId) return res.status(403).json({ error: 'No active organization' })
    req.auth = { userId: payload.sub, orgId, orgRole }
    return handler(req, res)
  }
}

// Wraps a handler so it only runs for an organization admin (Clerk role
// `org:admin`). Composes requireAuth, so 401/403-no-org still apply first.
export function requireOrgAdmin(handler) {
  return requireAuth((req, res) => {
    if (req.auth.orgRole !== 'org:admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    return handler(req, res)
  })
}
