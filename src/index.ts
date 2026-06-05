import app from "./app.ts";
import logger from "./lib/logger.js";
import { prisma } from "./lib/prisma.js"; // Named import matching our Prisma v7 client setup
import os from "os";

const PORT = process.env.PORT || 3000;

// Check if the user ran the script with the '--host' flag.
// If '--host' is passed, bind to '0.0.0.0' (all interfaces). Otherwise, secure it to localhost.
// If '--host' is active, find and print the actual network IP address.

const exposeToNetwork = process.argv.includes("--host");
const HOST = exposeToNetwork ? "0.0.0.0" : "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, "server listening");

  console.log(`\n🚀 Server is running!`);
  console.log(`➜  Local:   http://localhost:${PORT}`);  

  if (exposeToNetwork) {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          // Look for an external IPv4 address
          if (iface.family === "IPv4" && !iface.internal) {
            console.log(`➜  Network: http://${iface.address}:${PORT}`);
          }
        }
      }
    }
  }
  console.log(""); 
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