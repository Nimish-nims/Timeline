import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  // During build, if env var is missing, create a client that will fail gracefully at runtime
  // This allows the build to complete even if env vars aren't available
  if (!connectionString) {
    // Check if we're in build mode
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                        process.env.VERCEL_ENV === undefined
    
    if (isBuildTime) {
      // Return a proxy that throws a helpful error only when actually used
      return new Proxy({} as PrismaClient, {
        get() {
          throw new Error(
            'Database connection not available. POSTGRES_PRISMA_URL must be set in Vercel environment variables.'
          )
        }
      })
    }
    
    throw new Error('POSTGRES_PRISMA_URL is not defined. Please set it in your Vercel environment variables.')
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
