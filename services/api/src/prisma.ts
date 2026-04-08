import "./config/env.config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const isServerless = Boolean(process.env.VERCEL);

if (!databaseUrl) {
  throw new Error("DATABASE_URL or SUPABASE_DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: isServerless ? 1 : 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
