import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  _initialized: boolean
}

let prismaClient: PrismaClient | undefined

function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient
  }

  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  if (!connectionString) {
    throw new Error('POSTGRES_PRISMA_URL is not defined. Please set it in your Vercel environment variables.')
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  prismaClient = new PrismaClient({ adapter })
  
  return prismaClient
}

// Lazy initialization - only create when actually accessed
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma.prisma ?? getPrismaClient()
    
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
