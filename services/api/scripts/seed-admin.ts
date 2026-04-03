import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import "../src/config/env.config";
import { env } from "../src/config/env.config";
import { prisma } from "../src/prisma";

const generateUniqueUsername = async (seed: string) => {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20) || "admin";

  let candidate = normalized;
  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${normalized}${i}`;
  }

  return `${normalized}${Date.now()}`;
};

const seedAdmin = async () => {
  const adminEmail = env.DEFAULT_ADMIN_EMAIL;
  const adminPassword = env.DEFAULT_ADMIN_PASSWORD;

  try {
    await prisma.$connect();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const existingDefaultAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    let keeperId: string;
    let seededAction: "created" | "updated";

    if (existingDefaultAdmin) {
      keeperId = existingDefaultAdmin.id;
      seededAction = "updated";

      await prisma.user.update({
        where: { id: keeperId },
        data: {
          role: Role.ADMIN,
          password_hash: passwordHash,
          is_active: true,
          first_login: false,
        },
      });
    } else {
      const anyAdmin = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
        orderBy: { created_at: "asc" },
        select: { id: true },
      });

      if (anyAdmin) {
        keeperId = anyAdmin.id;
        seededAction = "updated";

        await prisma.user.update({
          where: { id: keeperId },
          data: {
            email: adminEmail,
            role: Role.ADMIN,
            password_hash: passwordHash,
            is_active: true,
            first_login: false,
          },
        });
      } else {
        const username = await generateUniqueUsername(adminEmail.split("@")[0]);
        const created = await prisma.user.create({
          data: {
            full_name: "Default Admin",
            username,
            email: adminEmail,
            password_hash: passwordHash,
            role: Role.ADMIN,
            is_active: true,
            first_login: false,
          },
          select: { id: true },
        });

        keeperId = created.id;
        seededAction = "created";
      }
    }

    await prisma.user.updateMany({
      where: {
        role: Role.ADMIN,
        id: { not: keeperId },
      },
      data: {
        role: Role.WARDEN,
        is_active: false,
      },
    });

    console.log(`Default admin ${seededAction} successfully`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  } catch (error) {
    console.error("Failed to seed default admin:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void seedAdmin();
