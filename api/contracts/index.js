import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const contracts = await prisma.contract.findMany({
        where: { orgId: ORG_ID },
        orderBy: { createdAt: 'asc' },
      })
      return res.status(200).json(contracts)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.title || !body.supplierId || body.value == null) {
        return res.status(400).json({ error: 'title, supplierId, and value are required' })
      }
      const contract = await prisma.contract.create({
        data: {
          ...coerceDates(body, ['startDate', 'endDate']),
          id: `con_${Date.now()}`,
          orgId: ORG_ID,
          createdBy: 'user_demo_admin',
        },
      })
      return res.status(201).json(contract)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
