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
    // During build, return a mock that will fail at runtime with a clear error
    // This prevents build errors
    const mockClient = {
      user: {
        findUnique: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        findMany: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        create: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        count: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        update: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        delete: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        deleteMany: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
      },
      post: {
        findUnique: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        findMany: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        create: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        count: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        update: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        delete: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
      },
      invitation: {
        findUnique: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        findFirst: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        findMany: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        create: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        update: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
      },
      passwordReset: {
        findUnique: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        findFirst: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        create: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        update: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
        deleteMany: () => { throw new Error('POSTGRES_PRISMA_URL not set') },
      },
    } as unknown as PrismaClient
    
    _prismaClient = mockClient
    return mockClient
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  _prismaClient = new PrismaClient({ adapter })
  
  return _prismaClient
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
