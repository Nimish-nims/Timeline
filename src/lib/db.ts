import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Disable SSL certificate verification for Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _prismaClient: PrismaClient | null = null

function getConnectionString(): string | undefined {
  return (
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  )
}

function createPrismaClient(): PrismaClient {
  if (_prismaClient) {
    return _prismaClient
  }

  const connectionString = getConnectionString()
  
  if (!connectionString) {
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    
    if (isBuildPhase) {
      return {} as PrismaClient
    }
    
    throw new Error('Database connection string not found.')
  }
  
  try {
    const pool = new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
    
    const adapter = new PrismaPg(pool)
    _prismaClient = new PrismaClient({ adapter })
    return _prismaClient
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    throw error
  }
}

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
