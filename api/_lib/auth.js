import { verifyToken } from '@clerk/backend'

// Wraps a handler so it only runs with a valid Clerk session token.
// Networkless verification: the JWT is checked against CLERK_SECRET_KEY.
export function requireAuth(handler) {
  return async (req, res) => {
    const header = req.headers?.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      req.auth = { userId: payload.sub }
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    return handler(req, res)
  }
}
