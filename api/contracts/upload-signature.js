import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isUploadConfigured()) return res.status(503).json({ error: 'File uploads are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: req.auth.orgId } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `procureiq/${req.auth.orgId}/contracts`
    const signature = signUpload({ timestamp, folder })
    const { cloudName, apiKey } = uploadConfig()

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
