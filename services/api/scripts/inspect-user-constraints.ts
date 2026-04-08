import "../src/config/env.config";
import { prisma } from "../src/prisma";

const run = async () => {
  const indexes = await prisma.$queryRawUnsafe(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='User'",
  );
  const constraints = await prisma.$queryRawUnsafe(
    "SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='\"User\"'::regclass",
  );

  console.log(JSON.stringify({ indexes, constraints }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
