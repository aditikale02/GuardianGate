import "./services/api/src/config/env.config";
import { prisma } from "./services/api/src/prisma";

const test = async () => {
  try {
    console.log("Connecting via Prisma...");
    const users = await prisma.user.findFirst();
    console.log("Connection successful! First user ID:", users?.id);
  } catch (err) {
    console.error("Prisma error:", err);
  } finally {
    process.exit(0);
  }
}

test();
