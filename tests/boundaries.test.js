const {
  request,
  app,
  resetDb,
  registerAndLogin,
  createQuestion,
} = require("./helpers");

beforeEach(resetDb);

describe("pagination clamping", () => {
  it("clamps limit above 100 to 100", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions?limit=999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  it("treats page=0 as page=1", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions?page=0")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.page).toBe(1);
  });

  it("treats page=-1 as page=1", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions?page=-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.page).toBe(1);
  });
});

describe("title length boundary", () => {
  it("accepts a title of exactly 255 characters", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "a".repeat(255), date: "2026-01-01", answer: "C" });
    expect(res.status).toBe(201);
  });

  it("returns 400 for a title of 256 characters", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "a".repeat(256), date: "2026-01-01", answer: "C" });
    expect(res.status).toBe(400);
  });
});

describe("ID parsing", () => {
  it("returns 404 for /api/questions/0", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions/0")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for /api/questions/abc", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions/abc")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("file size boundary", () => {
  const FIVE_MB = 5 * 1024 * 1024;

  it("accepts a file just under 5 MB", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Q")
      .field("answer", "A")
      .field("date", "2026-01-01")
      .attach("image", Buffer.alloc(FIVE_MB - 1), {
        filename: "ok.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(201);
  });

  it("rejects a file at exactly the 5 MB limit (multer's limit is exclusive)", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Q")
      .field("answer", "A")
      .field("date", "2026-01-01")
      .attach("image", Buffer.alloc(FIVE_MB), {
        filename: "limit.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
  });
});

describe("bcrypt 72-byte ceiling", () => {
  it("rejects passwords over 72 bytes at registration", async () => {
    const tooLong = "a".repeat(100);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "x@test.io", password: tooLong, name: "X" });
    expect(res.status).toBe(400);
  });

  it("accepts a password of exactly 72 bytes", async () => {
    const exactly72 = "a".repeat(72);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "x@test.io", password: exactly72, name: "X" });
    expect(res.status).toBe(201);
  });
});