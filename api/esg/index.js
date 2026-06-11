import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const responses = await prisma.esgResponse.findMany({
        where: { orgId: ORG_ID },
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
