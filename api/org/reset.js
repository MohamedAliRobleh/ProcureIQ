import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'
import { buildSeedData } from '../_lib/seedData.js'
import { buildAuditData } from '../_lib/audit.js'

// Admin-only: wipe the org then re-seed the canonical demo dataset, all in one
// transaction. Deletes child-first, inserts parent-first.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const data = buildSeedData(orgId)
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
      prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.reset' }) }),
    ])
    return res.status(200).json({ reset: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
