import { requireAuth } from '../_lib/auth.js'
import { seed, clear, reset, exportData, audit } from '../_handlers/org.js'

const ADMIN_ROUTES = { clear, reset, export: exportData, audit }

export default requireAuth(async (req, res) => {
  const name = [].concat(req.query.path ?? [])[0]
  if (name === 'seed') return seed(req, res)
  const adminHandler = ADMIN_ROUTES[name]
  if (!adminHandler) return res.status(404).json({ error: 'Not found' })
  if (req.auth.orgRole !== 'org:admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return adminHandler(req, res)
})
