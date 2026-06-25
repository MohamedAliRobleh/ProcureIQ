import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'

// Admin-only: return every record in the active org as one JSON payload, so an
// admin can download a backup before a clear/reset. Read-only, org-scoped.
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const where = { where: { orgId } }
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests] =
      await Promise.all([
        prisma.supplier.findMany(where),
        prisma.contract.findMany(where),
        prisma.riskAssessment.findMany(where),
        prisma.esgResponse.findMany(where),
        prisma.spendRecord.findMany(where),
        prisma.portalRequest.findMany(where),
      ])
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      orgId,
      data: { suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
