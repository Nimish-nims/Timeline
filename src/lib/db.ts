import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Required for Supabase SSL connections in Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Use non-pooling URL for direct connection (works better with pg adapter)
  const connectionString = process.env.POSTGRES_URL_NON_POOLING

  if (!connectionString) {
    throw new Error('POSTGRES_URL_NON_POOLING is not defined')
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: true
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
