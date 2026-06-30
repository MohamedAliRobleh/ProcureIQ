import { requireAuth } from '../_lib/auth.js'
import { list, byId, summarize, uploadSignature, notify } from '../_handlers/contracts.js'

const SUBROUTES = {
  summarize,
  'upload-signature': uploadSignature,
  notify,
}

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  const sub = SUBROUTES[segs[0]]
  if (sub) return sub(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
