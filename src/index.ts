import app from "./app.ts";
import logger from "./lib/logger.js";
import { prisma } from "./lib/prisma.js"; // Named import matching our Prisma v7 client setup
import os from "os";

// Railway provides process.env.PORT automatically.
// We parse it to a number just to be safe, defaulting to 3000 locally.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Railway sets NODE_ENV to "production" by default. 
const isProduction = process.env.NODE_ENV === "production";

// Expose to network if we pass the flag locally, OR if we are deployed to Railway.
const exposeToNetwork = process.argv.includes("--host") || isProduction;

// Railway needs 0.0.0.0 to route traffic. Locally, we default to localhost (127.0.0.1) for security.
const HOST = exposeToNetwork ? "0.0.0.0" : "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, "server listening");

  console.log(`\n🚀 Server is running!`);

  if (isProduction) {
    // What prints on Railway
    console.log(`➜  Environment: Production (Railway)`);
    // Add your Railway public URL here if you map it to an env variable
  } else {
    // What prints on your machine
    console.log(`➜  Local:   http://localhost:${PORT}`);  

    if (exposeToNetwork) {
      const networkInterfaces = os.networkInterfaces();
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        if (interfaces) {
          for (const iface of interfaces) {
            if (iface.family === "IPv4" && !iface.internal) {
              console.log(`➜  Network: http://${iface.address}:${PORT}`);
            }
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