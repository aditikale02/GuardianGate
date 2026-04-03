import { Role } from "@prisma/client";
import "../src/config/env.config";
import { env } from "../src/config/env.config";
import { prisma } from "../src/prisma";

const enforceSingleAdmin = async () => {
  try {
    await prisma.$connect();

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      orderBy: [{ created_at: "asc" }],
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        created_at: true,
      },
    });

    if (admins.length <= 1) {
      if (admins[0]) {
        if (!admins[0].is_active) {
          await prisma.user.update({
            where: { id: admins[0].id },
            data: { is_active: true },
          });
          console.log(`Single admin kept active: ${admins[0].email}`);
        } else {
          console.log(`Single admin already enforced: ${admins[0].email}`);
        }
      } else {
        console.log("No admin account found.");
      }
      return;
    }

    const preferred = admins.find((admin) => admin.email === env.DEFAULT_ADMIN_EMAIL);
    const firstActive = admins.find((admin) => admin.is_active);
    const keeper = preferred ?? firstActive ?? admins[0];

    const demotedIds = admins
      .filter((admin) => admin.id !== keeper.id)
      .map((admin) => admin.id);

    await prisma.user.update({
      where: { id: keeper.id },
      data: {
        role: Role.ADMIN,
        is_active: true,
      },
    });

    if (demotedIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: demotedIds } },
        data: {
          role: Role.WARDEN,
          is_active: false,
        },
      });
    }

    console.log(`Kept admin: ${keeper.email}`);
    console.log(`Demoted/deactivated admins: ${demotedIds.length}`);
  } catch (error) {
    console.error("Failed to enforce single-admin policy:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void enforceSingleAdmin();
