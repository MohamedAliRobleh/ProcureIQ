import { v2 as cloudinary } from 'cloudinary'

// True only when all three Cloudinary env vars are present. The signature
// endpoint checks this and 503s otherwise, so the app degrades gracefully
// when uploads aren't configured (no creds yet).
export function isUploadConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )
}

// The public values the browser is allowed to receive (never the secret).
export function uploadConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  }
}

// Signs the params the browser will send to Cloudinary. The secret is used
// here and never leaves the server.
export function signUpload(paramsToSign) {
  return cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)
}
