import { requireAuth } from './_lib/auth.js'
import * as suppliers from './_handlers/suppliers.js'
import * as spend from './_handlers/spend.js'
import * as contracts from './_handlers/contracts.js'
import * as portal from './_handlers/portalRequests.js'
import * as org from './_handlers/org.js'

// Single root-level catch-all that routes the multi-endpoint resources through
// ONE Serverless Function (Vercel Hobby caps a deployment at 12 functions).
//
// Why root-level: Vercel's plain (non-Next) functions DO NOT match the base
// path with an in-folder optional catch-all (`api/x/[[...path]].js` matches
// `/api/x/y` but NOT `/api/x`). From the api root, the resource name is itself
// a path segment, so `/api/suppliers` arrives here as `path=['suppliers']` and
// the base list/create route resolves correctly.
//
// The single-endpoint resources (`esg`, `risk`, `assistant`, `billing/checkout`)
// keep their own specific function files; Vercel routes specific paths before
// this catch-all, so they never reach here.

const CONTRACT_SUBROUTES = {
  summarize: 'summarize',
  'upload-signature': 'uploadSignature',
  notify: 'notify',
}

const ORG_ADMIN_ROUTES = {
  clear: 'clear',
  reset: 'reset',
  export: 'exportData',
  audit: 'audit',
}

function listOrId(mod, sub, req, res) {
  if (sub.length === 0) return mod.list(req, res)
  req.query.id = sub[0]
  return mod.byId(req, res)
}

export default requireAuth(async (req, res) => {
  // `path` arrives either as the catch-all array (direct single-segment hit,
  // e.g. /api/suppliers) or as a slash-joined string forwarded by the
  // `/api/:path*` rewrite (multi-segment hits, e.g. /api/suppliers/sup_1).
  const raw = req.query.path ?? []
  const segs = (Array.isArray(raw) ? raw : String(raw).split('/')).filter(Boolean)
  const [resource, ...sub] = segs

  switch (resource) {
    case 'suppliers':
      return listOrId(suppliers, sub, req, res)

    case 'spend':
      return listOrId(spend, sub, req, res)

    case 'contracts': {
      if (sub.length === 0) return contracts.list(req, res)
      const route = CONTRACT_SUBROUTES[sub[0]]
      if (route) return contracts[route](req, res)
      req.query.id = sub[0]
      return contracts.byId(req, res)
    }

    case 'portal-requests': {
      if (sub.length === 0) return portal.list(req, res)
      if (sub[0] === 'notify') return portal.notify(req, res)
      req.query.id = sub[0]
      return portal.byId(req, res)
    }

    case 'org': {
      const name = sub[0]
      if (name === 'seed') return org.seed(req, res)
      const adminRoute = ORG_ADMIN_ROUTES[name]
      if (!adminRoute) return res.status(404).json({ error: 'Not found' })
      if (req.auth.orgRole !== 'org:admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }
      return org[adminRoute](req, res)
    }

    default:
      return res.status(404).json({ error: 'Not found' })
  }
})
