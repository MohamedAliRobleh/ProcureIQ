import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { buildSeedData } from '../_lib/seedData.js'

// Populates a brand-new org with the canonical demo dataset. Count-guarded so
// it never duplicates: if the org already has suppliers, it is a no-op.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const existing = await prisma.supplier.count({ where: { orgId } })
    if (existing > 0) return res.status(200).json({ seeded: false })

    const data = buildSeedData(orgId)
    // FK order: suppliers first, then everything that references them.
    await prisma.supplier.createMany({ data: data.suppliers })
    await prisma.contract.createMany({ data: data.contracts })
    await prisma.riskAssessment.createMany({ data: data.riskAssessments })
    await prisma.esgResponse.createMany({ data: data.esgResponses })
    await prisma.spendRecord.createMany({ data: data.spendRecords })
    return res.status(200).json({ seeded: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
