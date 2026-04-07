import app, { setupIntegratedDev } from "./app";
import { prisma } from "./prisma";
import { env } from "./config/env.config";
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

const startServer = async () => {
  try {
    const { PORT } = env;

    // Test database connection
    await prisma.$connect();
    console.log(`✅ Connected to PostgreSQL Database`);

    // Integrate Vite dev servers if in development mode
    await setupIntegratedDev(app);

    app.listen(PORT, () => {
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
