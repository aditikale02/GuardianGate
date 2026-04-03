import { Role } from "@prisma/client";
import "../src/config/env.config";
import { prisma } from "../src/prisma";

const verify = async () => {
  try {
    await prisma.$connect();

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { email: true, is_active: true },
      orderBy: { created_at: "asc" },
    });

    const wardens = await prisma.user.count({ where: { role: Role.WARDEN } });

    const activeAdmins = admins.filter((admin) => admin.is_active).length;

    console.log(`ADMIN_TOTAL=${admins.length}`);
    console.log(`ACTIVE_ADMIN_TOTAL=${activeAdmins}`);
    console.log(`WARDEN_TOTAL=${wardens}`);
    console.log(
      `ADMIN_EMAILS=${admins
        .map((admin) => `${admin.email}:${admin.is_active ? "active" : "inactive"}`)
        .join(",")}`,
    );
  } catch (error) {
    console.error("Failed to verify admin state:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void verify();
