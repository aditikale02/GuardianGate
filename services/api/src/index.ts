import dotenv from "dotenv";
import { createServer } from "http";
import { initSocket } from "./socket";
dotenv.config();
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

const startServer = async () => {
  try {
    const { default: app, setupIntegratedDev } = await import("./app");
    const { prisma } = await import("./prisma");
    const { env } = await import("./config/env.config");
    const { PORT } = env;

    // Test database connection
    await prisma.$connect();
    console.log(`✅ Connected to PostgreSQL Database`);

    // Integrate Vite dev servers if in development mode
    await setupIntegratedDev(app);

    const httpServer = createServer(app);

    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    process.on("SIGINT", async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
