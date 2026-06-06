import { vi } from "vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { request, app, prisma, resetDb, registerAndLogin } from "./helpers.js";

beforeEach(resetDb);

describe("GET /api/questions/random", () => {
  let token: string;
  let userId: number;

  beforeEach(async () => {
    // Register a user and grab their ID from the DB so we can assign questions to them
    token = await registerAndLogin("elon@spacex.com", "Elon Musk");
    const user = await prisma.user.findFirst();
    userId = user!.id;
  });

  it("returns exactly 10 questions when there are more than 10 in the database", async () => {
    // 1. Seed 15 dummy questions into the database
    const questionsData = Array.from({ length: 15 }).map((_, i) => ({
      question: `Question ${i}`,
      answer: `Answer ${i}`,
      userId: userId,
    }));
    await prisma.question.createMany({ data: questionsData });

    // 2. Fetch the random questions
    const res = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    // 3. Assert it capped perfectly at 10
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(10);
  });

  it("returns all questions if there are fewer than 10 in the database", async () => {
    // 1. Seed only 4 dummy questions
    const questionsData = Array.from({ length: 4 }).map((_, i) => ({
      question: `Question ${i}`,
      answer: `Answer ${i}`,
      userId: userId,
    }));
    await prisma.question.createMany({ data: questionsData });

    const res = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    // 2. Assert it didn't crash and just returned all 4
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  it("formats the returned questions correctly", async () => {
    await prisma.question.create({
      data: {
        question: "Is this formatted?",
        answer: "Yes",
        userId: userId,
      }
    });

    const res = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // Check that formatQuestion() was applied successfully
    const returnedQuestion = res.body[0];
    expect(returnedQuestion).toHaveProperty("id");
    expect(returnedQuestion).toHaveProperty("question", "Is this formatted?");
    expect(returnedQuestion).toHaveProperty("userName", "Elon Musk");
    expect(returnedQuestion).toHaveProperty("solved", false);
    
    // Ensure sensitive/unwanted relational data is stripped
    expect(returnedQuestion).not.toHaveProperty("user"); 
    expect(returnedQuestion).not.toHaveProperty("_count");
  });

  it("returns questions in a randomized order", async () => {
    // Seed 15 questions
    const questionsData = Array.from({ length: 15 }).map((_, i) => ({
      question: `Question ${i}`,
      answer: `Answer ${i}`,
      userId: userId,
    }));
    await prisma.question.createMany({ data: questionsData });

    // Make two separate requests
    const res1 = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    const res2 = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    // Map the responses to arrays of just their IDs
    const ids1 = res1.body.map((q: any) => q.id);
    const ids2 = res2.body.map((q: any) => q.id);

    // Because the endpoint selects 10 random out of 15 AND shuffles them, 
    // the statistical probability of these two arrays being completely identical is virtually zero.
    expect(ids1).not.toEqual(ids2);
  });

  it("calls next(err) if the database throws an unexpected error", async () => {
    // 1. Seed a question so count > 0
    await prisma.question.create({
      data: { question: "Q1", answer: "A1", userId: userId }
    });

    // 2. Spy on findMany
    const spy = vi.spyOn(prisma.question, "findMany").mockRejectedValueOnce(new Error("Database completely lost!"));

    const res = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    spy.mockRestore();
  });
  
  it("returns a 200 OK with an empty array when the database is completely empty", async () => {
    // 1. We do NOT seed any questions here. 
    // The database is guaranteed empty because of beforeEach(resetDb).

    // 2. Attempt to fetch random questions
    const res = await request(app)
      .get("/api/questions/random")
      .set("Authorization", `Bearer ${token}`);

    // 3. Assert that the request succeeded (200 OK)
    expect(res.status).toBe(200);
    
    // 4. Assert that the payload is exactly an empty array
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(0);
    expect(res.body).toEqual([]);
  });

});