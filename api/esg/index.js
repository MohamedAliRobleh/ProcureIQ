import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const responses = await prisma.esgResponse.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { submittedAt: 'asc' },
      })
      return res.status(200).json(responses)
    }
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
