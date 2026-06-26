import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { buildSeedData } from '../_lib/seedData.js'
import { buildAuditData } from '../_lib/audit.js'

// Populates a brand-new org with the canonical demo dataset. Count-guarded so
// it never duplicates: if the org already has suppliers, it is a no-op.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  if (req.auth.orgRole !== 'org:admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  try {
    const existing = await prisma.supplier.count({ where: { orgId } })
    if (existing > 0) return res.status(200).json({ seeded: false })

    const data = buildSeedData(orgId)
    // FK order: suppliers first, then everything that references them — all atomic.
    await prisma.$transaction([
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
      prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.seed' }) }),
    ])
    return res.status(200).json({ seeded: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
