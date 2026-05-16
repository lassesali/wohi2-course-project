import app from "./app.ts";
import logger from "./lib/logger.js";
import { prisma } from "./lib/prisma.js"; // Named import matching our Prisma v7 client setup

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  
  try {
    // Safely disconnect Prisma Client during shutdown steps
    if (prisma) {
      await prisma.$disconnect();
    }
  } catch (error) {
    logger.error({ error }, "Error disconnecting Prisma during graceful shutdown");
  }
  
  server.close(() => process.exit(0));
}

// Graceful shutdown listeners
process.on("SIGINT", async () => {
  await shutdown("SIGINT");
});

process.on("SIGTERM", async () => {
  await shutdown("SIGTERM");
});