import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const assessments = await prisma.riskAssessment.findMany({
        where: { orgId: ORG_ID },
        orderBy: { assessedAt: 'asc' },
      })
      return res.status(200).json(assessments)
    }
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
