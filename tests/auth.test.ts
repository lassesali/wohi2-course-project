import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { request, app, prisma, resetDb, registerAndLogin } from "./helpers.js";

beforeEach(resetDb);

describe("POST /api/auth/register", () => {

  it("returns 400 when email is missing on register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ password: "pw12345", name: "A" });
    expect(res.status).toBe(400);
  });

  it("returns 201 with a token on valid registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@test.io", password: "pw12345", name: "A" });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("stores the password as a bcrypt hash, not plaintext", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "a@test.io", password: "pw12345", name: "A" });
    const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
    expect(user).not.toBeNull();
    expect(user!.password).not.toBe("pw12345");
    expect(await bcrypt.compare("pw12345", user!.password)).toBe(true);
  });

  it("returns 409 when the email is already registered", async () => {
    await registerAndLogin("dup@test.io");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@test.io", password: "x", name: "Z" });
    expect(res.status).toBe(409);
  });
  
});

describe("POST /api/auth/login", () => {

  it("returns 401 for a non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.io", password: "pw12345" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a wrong password", async () => {
    await registerAndLogin("a@test.io");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@test.io", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns 200 and a valid token for valid credentials", async () => {
    await registerAndLogin("a@test.io");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@test.io", password: "pw12345" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("uses the same error message for missing user and wrong password", async () => {
    await registerAndLogin("a@test.io");
    const noUser = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.io", password: "pw12345" });
    const badPw = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@test.io", password: "wrong" });
    expect(noUser.status).toBe(401);
    expect(badPw.status).toBe(401);
    expect(noUser.body.message).toBe(badPw.body.message);
  });

});

describe("JWT_SECRET environment variable is missing", () => {

  it("auth middleware throws an error if JWT_SECRET is missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    await expect(import("../src/middleware/auth.js")).rejects.toThrow(
      "JWT_SECRET environment variable is missing from your configuration."
    );

    vi.unstubAllEnvs();
  });

  it("auth router throws an error if JWT_SECRET is missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    await expect(import("../src/routes/auth.js")).rejects.toThrow(
      "JWT_SECRET environment variable is missing from your configuration."
    );

    vi.unstubAllEnvs();
  });

});

describe("POST /api/auth/register - reCAPTCHA Enforcement", () => {
  
  beforeEach(() => {
    // Force the route to evaluate the reCAPTCHA block by dropping the 'test' flag
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    // Crucial: put the environment back to 'test' so your other tests don't fail!
    vi.unstubAllEnvs();
  });

  it("returns 400 when reCAPTCHA token is completely missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "bot@test.io", password: "pw12345", name: "Bot" }); // Notice: no recaptchaToken field

    expect(res.status).toBe(400);
    // Adjust this string to perfectly match your actual error message
    expect(res.body.msg).toBe("Please complete the reCAPTCHA"); 
  });

  it("returns 400 (or handles error) when reCAPTCHA token is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ 
        email: "bot2@test.io", 
        password: "pw12345", 
        name: "Bot2",
        recaptchaToken: "this-is-a-fake-token" 
      });

    expect(res.status).toBe(400);
    // If your backend calls Google's API with this fake token, Google will reject it.
    // Check what your API returns in that scenario and assert it here.
    // expect(res.body.msg).toBe("reCAPTCHA verification failed"); 
  });

it("returns 400 when Google API rejects the reCAPTCHA token", async () => {
    // 1. Intercept the outgoing fetch request and force it to return Google's failure JSON
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    } as Response);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ 
        email: "mockedbot@test.io", 
        password: "pw12345", 
        name: "MockedBot",
        recaptchaToken: "token-doesnt-matter-now" 
      });

    // 2. Crucial: Restore fetch to normal so you don't break the rest of your app!
    fetchSpy.mockRestore();

    // 3. Assert the exact status and message generated by lines 38-39
    expect(res.status).toBe(400); 
    // expect(res.body.msg).toBe("reCAPTCHA verification failed"); // Update to match your actual error string
  });

it("returns 201 and creates user when reCAPTCHA verification succeeds", async () => {
    // 1. Force the environment to evaluate the CAPTCHA block
    vi.stubEnv("NODE_ENV", "production");

    // 2. Mock fetch to return Google's SUCCESS JSON
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      json: async () => ({ success: true, score: 0.9 }), // Add score if you use v3!
    } as Response);

    // 3. Make the request (make sure the email isn't already used in your DB)
    const res = await request(app)
      .post("/api/auth/register")
      .send({ 
        email: "verified-human@test.io", 
        password: "pw12345", 
        name: "Human",
        recaptchaToken: "valid-mocked-token" 
      });

    // 4. Restore everything
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();

    // 5. Assert the user was actually created
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
  });

it("returns 201 and creates user when reCAPTCHA verification succeeds", async () => {
    // 1. Force the environment to evaluate the CAPTCHA block
    vi.stubEnv("NODE_ENV", "production");

    // 2. Mock fetch to return Google's SUCCESS JSON
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      json: async () => ({ success: true, score: 0.9 }), 
    } as Response);

    // 3. Make the request (use a fresh email to avoid 409 conflicts)
    const res = await request(app)
      .post("/api/auth/register")
      .send({ 
        email: "verified-human@test.io", 
        password: "pw12345", 
        name: "Human",
        recaptchaToken: "valid-mocked-token" 
      });

    // 4. Restore everything so tests stay clean
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();

    // 5. Assert the user was actually created (Lines 38-39!)
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
  });

it("returns 400 when the reCAPTCHA network request completely fails", async () => {
    // 1. Force the environment to evaluate the CAPTCHA block
    vi.stubEnv("NODE_ENV", "production");

    // Temporarily mute console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // 2. Mock fetch to REJECT the promise (simulating a network crash/timeout)
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network timeout"));

    // 3. Make the request
    const res = await request(app)
      .post("/api/auth/register")
      .send({ 
        email: "network-error@test.io", 
        password: "pw12345", 
        name: "Test",
        recaptchaToken: "some-token" 
      });

    // 4. Restore everything so tests stay clean
    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();

    // 5. Assert it handles the catch block safely and returns the 400
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("reCAPTCHA verification failed. Are you a robot?");
  });

});
