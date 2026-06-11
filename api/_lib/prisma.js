import { PrismaClient } from '@prisma/client'

// Cache on globalThis so dev hot-reload doesn't exhaust DB connections.
export const prisma = globalThis.__prisma ?? new PrismaClient()
if (!globalThis.__prisma) globalThis.__prisma = prisma
