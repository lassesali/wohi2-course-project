import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Explicitly load your test environment variables before tests boot
dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Kept false to completely prevent the foreign key race conditions in MySQL/MariaDB
    fileParallelism: false, 
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"], // 👈 Updated from .js to monitor TypeScript source files
      exclude: ["src/generated/**", "src/index.ts"], // 👈 Updated wrapper target extension to .ts
    },
  },
});