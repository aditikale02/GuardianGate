import "../src/config/env.config";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../src/prisma";

const migrationFiles = [
  "20260325121734_init.sql",
  "20260330155000_phase2_governance.sql",
  "20260330162000_missing_reports_module.sql",
  "20260330170500_mess_timetable_dual_mode.sql",
  "20260403120000_relationship_integrity.sql",
  "20260407123000_manual_credentials_storage.sql",
] as const;

const run = async () => {
  const baseDir = path.resolve(__dirname, "../../../supabase/migrations");

  try {
    await prisma.$connect();

    for (const file of migrationFiles) {
      const fullPath = path.join(baseDir, file);
      const sql = readFileSync(fullPath, "utf8");
      await prisma.$executeRawUnsafe(sql);
      console.log(`Applied: ${file}`);
    }

    console.log("Supabase bootstrap migrations applied successfully.");
  } catch (error) {
    console.error("Failed to bootstrap Supabase schema:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();
