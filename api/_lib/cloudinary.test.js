// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { isUploadConfigured, uploadConfig, signUpload } from './cloudinary.js'

const ORIGINAL = {
  name: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
}

function restore(k, v) {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

afterEach(() => {
  restore('CLOUDINARY_CLOUD_NAME', ORIGINAL.name)
  restore('CLOUDINARY_API_KEY', ORIGINAL.key)
  restore('CLOUDINARY_API_SECRET', ORIGINAL.secret)
})

describe('cloudinary lib', () => {
  it('isUploadConfigured is true only when all three vars are set', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
    expect(isUploadConfigured()).toBe(false)
    process.env.CLOUDINARY_CLOUD_NAME = 'demo'
    process.env.CLOUDINARY_API_KEY = '123'
    expect(isUploadConfigured()).toBe(false)
    process.env.CLOUDINARY_API_SECRET = 'shh'
    expect(isUploadConfigured()).toBe(true)
  })

  it('uploadConfig returns the public cloud name and api key', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'democloud'
    process.env.CLOUDINARY_API_KEY = '999'
    expect(uploadConfig()).toEqual({ cloudName: 'democloud', apiKey: '999' })
  })

  it('signUpload returns a 40-char hex signature', () => {
    process.env.CLOUDINARY_API_SECRET = 'test-secret'
    const sig = signUpload({ timestamp: 1700000000, folder: 'procureiq/org_demo/contracts' })
    expect(sig).toMatch(/^[a-f0-9]{40}$/)
  })
})
