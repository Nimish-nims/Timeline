import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _prismaClient: PrismaClient | null = null

function createPrismaClient(): PrismaClient {
  // Return cached client if exists
  if (_prismaClient) {
    return _prismaClient
  }

  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  if (!connectionString) {
    // Check if we're in build phase
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    
    if (isBuildPhase) {
      // During build, return a mock that won't be used
      // This prevents build errors
      return {} as PrismaClient
    }
    
    // At runtime, throw a clear error
    throw new Error(
      'POSTGRES_PRISMA_URL is not defined. Please set it in your Vercel environment variables. ' +
      'Go to: Settings → Environment Variables → Add POSTGRES_PRISMA_URL'
    )
  }
  
  try {
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    _prismaClient = new PrismaClient({ adapter })
    return _prismaClient
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    throw new Error(
      `Failed to connect to database. Please check your POSTGRES_PRISMA_URL environment variable. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// Use Proxy to make it truly lazy - only initialize on first property access
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma.prisma ?? createPrismaClient()
    
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = client
    }
    
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
