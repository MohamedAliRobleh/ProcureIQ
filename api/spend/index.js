import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const records = await prisma.spendRecord.findMany({
        where: { orgId: ORG_ID },
        orderBy: { date: 'asc' },
      })
      return res.status(200).json(records)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.supplierId || body.amount == null || !body.category || !body.date) {
        return res.status(400).json({ error: 'supplierId, amount, category, and date are required' })
      }
      const record = await prisma.spendRecord.create({
        data: {
          ...coerceDates(body, ['date']),
          id: `spend_${Date.now()}`,
          orgId: ORG_ID,
          createdAt: new Date(),
        },
      })
      return res.status(201).json(record)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
