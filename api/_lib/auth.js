import { verifyToken } from '@clerk/backend'

// Wraps a handler so it only runs with a valid Clerk session token that
// carries an active organization. Networkless verification: the JWT is
// checked against CLERK_SECRET_KEY. `org_id` and `org_role` are default Clerk
// session-token claims, present only when an org is active.
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
    const orgId = payload.org_id ?? null
    if (!orgId) return res.status(403).json({ error: 'No active organization' })
    req.auth = { userId: payload.sub, orgId, orgRole: payload.org_role ?? null }
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
