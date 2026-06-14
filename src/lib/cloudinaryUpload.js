// Uploads a file directly from the browser to Cloudinary using params signed
// by our backend. Cross-origin to Cloudinary — no bearer token involved.
export async function uploadToCloudinary(file, { cloudName, apiKey, timestamp, folder, signature }) {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  form.append('timestamp', String(timestamp))
  form.append('folder', folder)
  form.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.secure_url
}
