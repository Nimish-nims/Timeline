import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  if (!connectionString) {
    // During build time, return a mock client that will fail at runtime
    // This prevents build errors when env vars aren't available
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('POSTGRES_PRISMA_URL is not defined. Please set it in your Vercel environment variables.')
    }
    // For local development, throw immediately
    throw new Error('POSTGRES_PRISMA_URL is not defined. Please check your .env file.')
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
