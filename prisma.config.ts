import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.POSTGRES_URL_NON_POOLING!,
  },
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { Pool } = await import("pg");
      const pool = new Pool({ 
        connectionString: process.env.POSTGRES_URL_NON_POOLING 
      });
      return new PrismaPg(pool);
    },
  },
});
