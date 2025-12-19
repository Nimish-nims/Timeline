import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _prismaClient: PrismaClient | null = null

function getConnectionString(): string | undefined {
  // Check multiple possible environment variable names
  // Supabase/Vercel integration uses these
  return (
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  )
}

function createPrismaClient(): PrismaClient {
  // Return cached client if exists
  if (_prismaClient) {
    return _prismaClient
  }

  const connectionString = getConnectionString()
  
  if (!connectionString) {
    // Check if we're in build phase
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    
    if (isBuildPhase) {
      return {} as PrismaClient
    }
    
    // Log available env vars for debugging
    const dbEnvVars = Object.keys(process.env)
      .filter(key => key.includes('POSTGRES') || key.includes('DATABASE') || key.includes('SUPABASE'))
    
    console.error('Available database env vars:', dbEnvVars)
    
    throw new Error(
      'Database connection string not found. Please ensure Supabase is properly connected to your Vercel project.'
    )
  }
  
  try {
    // Use standard pg Pool with SSL for Supabase
    const pool = new pg.Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    })
    
    const adapter = new PrismaPg(pool)
    _prismaClient = new PrismaClient({ adapter })
    return _prismaClient
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// Use Proxy for lazy initialization
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
