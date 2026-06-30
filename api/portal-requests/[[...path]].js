import { requireAuth } from '../_lib/auth.js'
import { list, byId, notify } from '../_handlers/portalRequests.js'

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  if (segs[0] === 'notify') return notify(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
