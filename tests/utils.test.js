const errorHandler = require("../src/middleware/errorHandler");
const { ValidationError } = require("../src/lib/errors");

describe("Utility & Edge Case Coverage", () => {
  
  it("ValidationError uses the default message if none is provided", () => {
    // Triggers Line 10 in errors.js
    const err = new ValidationError();
    expect(err.message).toBe("Invalid input");
    expect(err.status).toBe(400);
  });

  it("errorHandler falls back to console.error when req.log is missing", () => {
    // Triggers Line 36 in errorHandler.js
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = {}; // Simulate a request that bypassed Pino
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(new Error("Test"), req, res, next);

    expect(consoleSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    consoleSpy.mockRestore();
  });

  it("logger uses 'info' level when outside of the test environment", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", ""); // Falsy forces the ternary to run

    // THE NUCLEAR OPTION: Manually delete the logger from the cache
    delete require.cache[require.resolve("../src/lib/logger")];

    const logger = require("../src/lib/logger");
    expect(logger.level).toBe("info");

    vi.unstubAllEnvs();
  });

  it("logger defaults to 'silent' in test environment when LOG_LEVEL is completely missing", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", ""); // Falsy forces the ternary to run

    // Clean the cache again so it re-reads the "test" environment
    delete require.cache[require.resolve("../src/lib/logger")];

    const logger = require("../src/lib/logger");
    expect(logger.level).toBe("silent");

    vi.unstubAllEnvs();
  });

});


