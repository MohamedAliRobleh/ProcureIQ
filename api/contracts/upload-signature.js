import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isUploadConfigured()) return res.status(503).json({ error: 'File uploads are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: ORG_ID } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `procureiq/${ORG_ID}/contracts`
    const signature = signUpload({ timestamp, folder })
    const { cloudName, apiKey } = uploadConfig()

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
