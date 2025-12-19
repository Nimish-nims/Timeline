import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use POSTGRES_PRISMA_URL (pooled) for migrations, fallback to non-pooling if needed
const databaseUrl = process.env.POSTGRES_PRISMA_URL || 
                   process.env.POSTGRES_URL_NON_POOLING || 
                   process.env.DATABASE_URL || 
                   "postgresql://placeholder"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
