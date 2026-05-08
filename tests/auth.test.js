const bcrypt = require("bcrypt");
const { request, app, prisma, resetDb, registerAndLogin } = require("./helpers");

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
    expect(user.password).not.toBe("pw12345");
    expect(await bcrypt.compare("pw12345", user.password)).toBe(true);
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