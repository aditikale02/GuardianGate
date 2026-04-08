import "../src/config/env.config";
import { prisma } from "../src/prisma";

const statements = [
  `
  DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"User"'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) ~* '^UNIQUE \\(("?role"?)\\)$'
    LOOP
      EXECUTE format('ALTER TABLE "User" DROP CONSTRAINT %I', r.conname);
    END LOOP;
  END $$;
  `,
  `
  DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'User'
        AND indexdef ~* 'CREATE UNIQUE INDEX'
        AND indexdef ~* '\\(("?role"?)\\)'
        AND indexdef !~* ','
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
  END $$;
  `,
];

const run = async () => {
  await prisma.$connect();
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Dropped any UNIQUE constraint/index on User.role if present.");
};

run()
  .catch((error) => {
    console.error("Failed to drop User.role uniqueness:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
