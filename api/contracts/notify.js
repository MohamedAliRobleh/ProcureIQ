import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { escapeHtml } from '../_lib/htmlEscape.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
  const { id, toEmail } = req.body ?? {}
  if (!id || !toEmail) return res.status(400).json({ error: 'id and toEmail are required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: req.auth.orgId } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const subject = `Reminder: ${contract.title}`
    const end = contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>Contract reminder</h2>`,
      `<p>Here is a reminder about <strong>${escapeHtml(contract.title)}</strong>.</p>`,
      `<ul>`,
      `<li>Value: ${escapeHtml(contract.currency)} ${escapeHtml(contract.value)}</li>`,
      `<li>Status: ${escapeHtml(contract.status)}</li>`,
      `<li>End date: ${escapeHtml(end)}</li>`,
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
