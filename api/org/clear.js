import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'

// Admin-only: permanently delete every record in the active org. Children are
// deleted before suppliers (no onDelete cascade in the schema), all in one
// transaction.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
    ])
    return res.status(200).json({ cleared: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
