//require("express-async-errors"); // if we included this in index.js, we wouldn't need to catch and next errors in every route handler. 
//But we didn't want to add it as a dependency, so we'll do it manually in each route handler for now.
const app = require("./app");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "server listening");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  // Check if prisma exists before trying to disconnect
  if (typeof prisma !== 'undefined') {
    await prisma.$disconnect();
  }
  server.close(() => process.exit(0));
}

// Graceful shutdown
process.on("SIGINT", async () => {
  shutdown("SIGINT");
});

process.on('SIGTERM', async () => {
  shutdown("SIGTERM");
});

