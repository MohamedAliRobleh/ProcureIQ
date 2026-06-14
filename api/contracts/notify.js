import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { id, toEmail } = req.body ?? {}
  if (!id || !toEmail) return res.status(400).json({ error: 'id and toEmail are required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: ORG_ID } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const subject = `Reminder: ${contract.title}`
    const end = contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>Contract reminder</h2>`,
      `<p>Here is a reminder about <strong>${contract.title}</strong>.</p>`,
      `<ul>`,
      `<li>Value: ${contract.currency} ${contract.value}</li>`,
      `<li>Status: ${contract.status}</li>`,
      `<li>End date: ${end}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: toEmail, subject, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireAuth(handler)
