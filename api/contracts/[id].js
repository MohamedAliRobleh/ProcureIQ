import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const updated = await prisma.contract.update({
        where: { id: req.query.id },
        data: coerceDates(req.body ?? {}, ['startDate', 'endDate']),
      })
      return res.status(200).json(updated)
    }
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}
