import { Role } from "@prisma/client";
import "../src/config/env.config";
import { prisma } from "../src/prisma";

const LEGACY_ROLES: Role[] = [
  Role.DOCTOR,
  Role.MESS_MANAGER,
  Role.MAINTENANCE_STAFF,
  Role.HOUSEKEEPING_STAFF,
  Role.SECURITY_GUARD,
];

const deactivateLegacyRoles = async () => {
  try {
    await prisma.$connect();

    const updated = await prisma.user.updateMany({
      where: {
        role: { in: LEGACY_ROLES },
        is_active: true,
      },
      data: {
        is_active: false,
      },
    });

    console.log(`Deactivated ${updated.count} legacy-role account(s).`);
  } catch (error) {
    console.error("Failed to deactivate legacy roles:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void deactivateLegacyRoles();
