import "../src/config/env.config";
import { prisma } from "../src/prisma";

const run = async () => {
  try {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const usersByRole = await prisma.$queryRaw<Array<{ role: string; count: bigint }>>`
      SELECT role::text AS role, COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY role
      ORDER BY role
    `;

    const rlsSummary = await prisma.$queryRaw<
      Array<{ table_name: string; row_security: boolean; policy_count: bigint }>
    >`
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS row_security,
        COUNT(p.policyname)::bigint AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity
      ORDER BY c.relname
    `;

    console.log(`tables=${tables.length}`);
    for (const row of tables) {
      console.log(row.table_name);
    }

    console.log("users_by_role");
    for (const row of usersByRole) {
      console.log(`${row.role}:${row.count.toString()}`);
    }

    console.log("rls_summary");
    for (const row of rlsSummary) {
      console.log(`${row.table_name}:rls=${row.row_security}:policies=${row.policy_count.toString()}`);
    }
  } catch (error) {
    console.error("Failed to list DB state:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();
