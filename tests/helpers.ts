import request from "supertest";
import app from "../src/app.js"; // Explicit .js extension required for ESM
import { prisma } from "../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();
}

export async function registerAndLogin(email: string = "a@test.io", name: string = "A"): Promise<string> {
  const regRes = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "pw12345", name });
    
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "pw12345" });
    
  // --- NEW: Loudly fail if the token is missing ---
  if (!loginRes.body || !loginRes.body.token) {
    console.error("🔴 REGISTER RESPONSE:", regRes.body);
    console.error("🔴 LOGIN RESPONSE:", loginRes.body);
    throw new Error(`Test Helper failed to get token! Login status: ${loginRes.status}`);
  }
    
  return loginRes.body.token;
}

export async function createQuestion(token: string, overrides: Record<string, any> = {}): Promise<any> {
  const res = await request(app)
    .post("/api/questions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      question: "Q",
      answer: "C",
      ...overrides,
    });
  return res.body;
}

export { request, app, prisma };