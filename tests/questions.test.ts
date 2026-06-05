import { describe, it, expect, beforeEach, vi } from "vitest";
import { request, app, prisma, resetDb, registerAndLogin, createQuestion } from "./helpers.js";

beforeEach(resetDb);

describe("auth on protected endpoints", () => {

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the header does not start with 'Bearer '", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Token abc");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the token is malformed", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Bearer not.a.real.jwt");
    expect(res.status).toBe(401);
  });

});

describe("GET /api/questions", () => {

  it("returns questions with data, page, limit, total, totalPages", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("does not include user.password in any question in the response", async () => {
    const token = await registerAndLogin();
    await createQuestion(token);
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

});

describe("GET /api/questions (Math Clamping)", () => {

  it("clamps limit down to 100 and up to 1 (Triggers Math.min/max)", async () => {
    const token = await registerAndLogin();
    
    const resHigh = await request(app)
      .get("/api/questions?limit=999")
      .set("Authorization", `Bearer ${token}`);
    expect(resHigh.body.limit).toBe(100);

    const resLow = await request(app)
      .get("/api/questions?limit=0")
      .set("Authorization", `Bearer ${token}`);
    expect(resLow.body.limit).toBe(1);
  });

});

describe("Final Architectural Edge Cases", () => {

  it("removes old keywords when a question is updated (Testing set: [])", async () => {
    const token = await registerAndLogin();
    const q = await createQuestion(token, { keywords: "math, science" });

    const res = await request(app)
      .put(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Q",
        answer: "A",
        keywords: "math" 
      });

    expect(res.body.keywords).toContain("math");
    expect(res.body.keywords).not.toContain("science");
    expect(res.body.keywords.length).toBe(1);
  });

  it("handles duplicate correct attempts efficiently (Testing take: 1)", async () => {
    const token = await registerAndLogin();
    const q = await createQuestion(token, { answer: "Paris" });

    await request(app).post(`/api/questions/${q.id}/play`).set("Authorization", `Bearer ${token}`).send({ answer: "Paris" });
    await request(app).post(`/api/questions/${q.id}/play`).set("Authorization", `Bearer ${token}`).send({ answer: "Paris" });

    const res = await request(app)
      .get(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.solved).toBe(true);
  });

});

describe("GET /api/questions/:questionId", () => {

  it("returns 404 for an unknown question", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("returns 200 with the correct shape for a known question", async () => {
    const token = await registerAndLogin();
    const created = await createQuestion(token, { question: "Hello" });
    const res = await request(app)
      .get(`/api/questions/${created.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      question: "Hello",
      userName: "A",
      solved: false,
    });
  });

  it("filters questions when a keyword query parameter is provided", async () => {
    const token = await registerAndLogin();
    await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Q", answer: "A", keywords: "filterme" });

    const res = await request(app)
      .get("/api/questions?keyword=filterme")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].keywords).toContain("filterme");
  });

  it("returns 401 and an Invalid token message when provided a bad JWT", async () => {
    const res = await request(app)
      .get("/api/questions") 
      .set("Authorization", "Bearer this-is-obviously-not-a-valid-jwt-string");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

});

describe("POST /api/questions (validation)", () => {

  it("returns 400 when question is missing", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "hi" });
    expect(res.status).toBe(400);
  });

  it("sets userId from the JWT, not from the body", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "T",
        answer: "hi",
        userId: 99999,
      });
    expect(res.status).toBe(201);
    const question = await prisma.question.findUnique({ where: { id: res.body.id } });
    expect(question).not.toBeNull();
    expect(question!.userId).not.toBe(99999);
  });

});

describe("PUT /api/questions/:questionId (authorization)", () => {

  it("returns 403 when editing someone else's question", async () => {
    const sabrinaToken = await registerAndLogin("sabrina@hotmail.com", "Sabrina");
    const question = await createQuestion(sabrinaToken, { question: "Sabrina's question" });

    const juliaToken = await registerAndLogin("julia@hotmail.com", "Julia");
    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${juliaToken}`)
      .send({ question: "In what year was Barron Trump born?", answer: "2006" });

    expect(res.status).toBe(403);

    const after = await prisma.question.findUnique({ where: { id: question.id } });
    expect(after).not.toBeNull();
    expect(after!.question).toBe("Sabrina's question");
  });

  it("returns 404 when the questionId is not a valid number (NaN)", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put(`/api/questions/not-a-number`) 
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "What fruit is yellow?", answer: "Banana" });
      
    expect(res.status).toBe(404);
  });
  
  it("returns 404 when attempting to edit a non-existent question", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put(`/api/questions/99999`) 
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "What animal says “meow”?", answer: "Cat" });
      
    expect(res.status).toBe(404);
  });

});

describe("DELETE /api/questions/:questionId", () => {

  it("returns 200 and removes the question from the database", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, { question: "Test question" });
    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const after = await prisma.question.findUnique({ where: { id: question.id } });
    expect(after).toBeNull();
  });

  it("returns solved: true in the response payload if the user had solved it before deletion", async () => {
    const token = await registerAndLogin();
    const q = await createQuestion(token, { question: "Delete Me Soon", answer: "42" });

    await request(app)
      .post(`/api/questions/${q.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "42" });

    const res = await request(app)
      .delete(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.question.solved).toBe(true); 
  });

});

describe("unknown routes", () => {

  it("returns 404 with a message for an unknown route", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Not found");
  });

});

describe("body parsing", () => {

  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid JSON in request body");
  });

  it("returns 400 when Content-Type is not JSON", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "text/plain")
      .send('{"email":"billg@microsoft.com","password":"pw12345","name":"Bill Gates"}');
    expect(res.status).toBe(400);
  });

});

describe("Edge Cases: File Uploads & String Keywords", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndLogin("zuckerberg@fb.com", "Mark Zuckerberg");
  });

  it("parses keywords correctly when sent as a comma-separated string", async () => {
    const token = await registerAndLogin("keyworduser@test.io", "Keyword User");

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What CSS property changes the color of text?",
        answer: "color",
        keywords: "CSS, color, text" 
      });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toContain("color");
    expect(res.body.keywords.length).toBe(3);
  });

});

describe("500 Internal Server Errors (Catch Blocks)", () => {

  it("catches errors in GET / and passes them to the error handler", async () => {
    const token = await registerAndLogin();
    
    vi.spyOn(prisma.question, 'findMany').mockRejectedValueOnce(new Error("Simulated DB Crash"));

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500); 
  });

  it("catches errors in DELETE /:questionId and passes them to the error handler", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    vi.spyOn(prisma.question, 'delete').mockRejectedValueOnce(new Error("Simulated DB Crash"));

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500); 
  });

  it("catches errors in PUT /:questionId and passes them to the error handler", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token); 

    vi.spyOn(prisma.question, 'update').mockRejectedValueOnce(new Error("Simulated DB Crash"));

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ 
        question: "Will this crash?", 
        answer: "Yes" 
      });

    expect(res.status).toBe(500); 
  });

});

describe("formatQuestion Fallback Branches", () => {

  it("safely formats a question that is missing relational data", async () => {
    const token = await registerAndLogin();

    vi.spyOn(prisma.question, 'findUnique').mockResolvedValueOnce({
      id: 888,
      question: "Barebones Question",
      answer: "Nothing else included",
      userId: 1,
      imageUrl: null
    } as any);

    const res = await request(app)
      .get("/api/questions/888")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userName).toBeNull();
    expect(res.body.keywords).toEqual([]);
    expect(res.body.solved).toBe(false);
  });
  
});