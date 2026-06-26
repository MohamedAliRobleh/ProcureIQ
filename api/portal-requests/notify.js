import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { canManage } from '../_lib/permissions.js'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'portal')) {
    return res.status(403).json({ error: 'You do not have permission to manage portal' })
  }
  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const request = await prisma.portalRequest.findFirst({
      where: { id, orgId: req.auth.orgId },
      include: { supplier: { select: { name: true, email: true } } },
    })
    if (!request || !request.supplier) return res.status(404).json({ error: 'Not found' })

    const due = request.dueDate ? new Date(request.dueDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>${escapeHtml(request.title)}</h2>`,
      `<p>Hello ${escapeHtml(request.supplier.name)},</p>`,
      `<p>ProcureIQ has a request for you:</p>`,
      request.message ? `<p>${escapeHtml(request.message)}</p>` : '',
      `<ul>`,
      `<li>Due date: ${escapeHtml(due)}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: request.supplier.email, subject: `Request: ${request.title}`, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireAuth(handler)
