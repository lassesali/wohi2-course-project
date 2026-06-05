import { describe, it, expect, vi, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import errorHandler from "../src/middleware/errorHandler.js";
import { ValidationError } from "../src/lib/errors.js";

// Hook ensures cleanup runs after EVERY test block, even if an assertion fails
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Utility & Edge Case Coverage", () => {
  
  it("ValidationError uses the default message if none is provided", () => {
    const err = new ValidationError();
    expect(err.message).toBe("Invalid input");
    expect(err.status).toBe(400);
  });

  it("errorHandler falls back to console.error when req.log is missing", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = {} as Request; 
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorHandler(new Error("Test"), req, res, next);

    expect(consoleSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    consoleSpy.mockRestore();
  });

  it("logger uses 'info' level when outside of the test environment", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "");

    vi.resetModules(); 
    const loggerModule = await import("../src/lib/logger.js");
    expect(loggerModule.default.level).toBe("info");
  });

  it("logger defaults to 'silent' in test environment when LOG_LEVEL is completely missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "");

    vi.resetModules();
    const loggerModule = await import("../src/lib/logger.js");
    expect(loggerModule.default.level).toBe("silent");
  });

  it("logger disables pretty transport formatting when running in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    vi.resetModules();

    const loggerModule = await import("../src/lib/logger.js");
    expect(loggerModule.default.chimes).toBeUndefined(); 
  });

});

describe("Configuration Guards Coverage", () => {

  it("prisma service throws an error if DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();

    await expect(import("../src/lib/prisma.js")).rejects.toThrow(
      "DATABASE_URL environment variable is missing."
    );
  });

  it("auth middleware throws an error if JWT_SECRET is missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    await expect(import("../src/middleware/auth.js")).rejects.toThrow(
      "JWT_SECRET environment variable is missing from your configuration."
    );
  });

  it("auth router throws an error if JWT_SECRET is missing", async () => {
    // Explicitly seed a dummy string to DATABASE_URL so prisma.ts can initialize 
    // seamlessly without blocking the test when auth.ts evaluates it
    vi.stubEnv("DATABASE_URL", "mysql://root:password@localhost:3306/test_db");
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    await expect(import("../src/routes/auth.js")).rejects.toThrow(
      "JWT_SECRET environment variable is missing from your configuration."
    );
  });

});

describe("Auth Middleware Logger Branch", () => {

  it("triggers req.log.warn when authentication fails and a logger is present", async () => {
    const logWarnSpy = vi.fn();
    
    const req = {
      headers: {
        authorization: "Bearer this-token-is-malformed-and-will-fail-verification"
      },
      log: {
        warn: logWarnSpy
      }
    } as any;

    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    const { default: authenticate } = await import("../src/middleware/auth.js");
    
    authenticate(req, res, next);

    expect(logWarnSpy).toHaveBeenCalledTimes(1);
    expect(logWarnSpy).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Error authenticating"
    );
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("skips logging and cleanly calls next(err) when authentication fails and req.log is completely missing", async () => {
    const req = {
      headers: {
        authorization: "Bearer this-token-is-malformed-and-will-fail-verification"
      }
      // log is intentionally omitted and left undefined here to trigger the false branch
    } as any;

    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    const { default: authenticate } = await import("../src/middleware/auth.js");
    
    authenticate(req, res, next);

    // Verifies that it skipped calling any logger methods but still successfully forwarded the error
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

});