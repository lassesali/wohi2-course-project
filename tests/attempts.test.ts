import { describe, it, expect, beforeEach } from "vitest";
import { request, app, prisma, resetDb, registerAndLogin, createQuestion } from "./helpers.js";

beforeEach(resetDb);

describe("POST /api/questions/:questionId/play", () => {
  let token: string;
  let question: any;
  
  beforeEach(async () => {
    token = await registerAndLogin("zuckerberg@fb.com", "Player One");
    question = await createQuestion(token, {
      question: "What is the capital of France?",
      answer: "Paris",
    });
  });

  describe("1. Core Logic & Edge Cases", () => {

    it("returns 201 and correct: true for an exact match", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      expect(res.status).toBe(201);
      expect(res.body.correct).toBe(true);
      expect(res.body.submittedAnswer).toBe("Paris");
      
      const attempt = await prisma.attempt.findFirst({ where: { questionId: question.id } });
      expect(attempt).not.toBeNull();
      expect(attempt!.isCorrect).toBe(true);
    });

    it("returns 201 and correct: true for a messy string (spaces and mixed case)", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "   pArIs  " });

      expect(res.status).toBe(201);
      expect(res.body.correct).toBe(true);
    });

    it("returns 201 and correct: false for a wrong answer", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "London" });

      expect(res.status).toBe(201);
      expect(res.body.correct).toBe(false);

      const attempt = await prisma.attempt.findFirst({ where: { questionId: question.id } });
      expect(attempt).not.toBeNull();
      expect(attempt!.isCorrect).toBe(false);
    });

  });

  describe("2. Validation & Error Handling", () => {

    it("returns 400 when the answer field is missing entirely", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({}); 

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid input");
    });

    it("returns 400 when the answer is an empty string", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "   " }); 

      expect(res.status).toBe(400);
    });

    it("returns 400 when the answer is the wrong data type (number instead of string)", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: 42 }); 

      expect(res.status).toBe(400);
      expect(res.body.issues[0].message).toMatch(/Expected string, received number/i);
    });

    it("returns 404 when playing a question that does not exist", async () => {
      const res = await request(app)
        .post("/api/questions/99999/play")
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Question not found");
    });

  });

  describe("3. Relational Data Integrity", () => {
    
    it("safely deletes attempts when a question is deleted (No Orphaned Records)", async () => {
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      let attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(1);

      const deleteRes = await request(app)
        .delete(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`);
      
      expect(deleteRes.status).toBe(200);

      attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(0);
    });

    it("deletes previous attempts when the creator changes the correct answer (State Invalidation)", async () => {
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      const updateRes = await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          question: "What is the capital of France?",
          answer: "Lyon", 
          keywords: ["geography"]
        });

      expect(updateRes.status).toBe(200);

      const attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(0);
    });
    
    it("keeps previous attempts if the creator updates the question text but NOT the answer", async () => {
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          question: "What is the beautiful capital of France?", 
          answer: "Paris", 
          keywords: ["geography"]
        });

      const attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(1);
    });

  });

});

describe("POST /api/questions/:questionId/play", () => {

  describe("4. Advanced Integration & Defensive Checks", () => {

    it("updates the 'solved' status in the question list after a successful play", async () => {
      const token = await registerAndLogin();
      const q = await createQuestion(token, { answer: "Winner" });

      const initial = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${token}`);
      expect(initial.body.data[0].solved).toBe(false);

      await request(app)
        .post(`/api/questions/${q.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Winner" });

      const updated = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${token}`);
      expect(updated.body.data[0].solved).toBe(true);
    });

  });
    
  describe("5. Multi-User Isolation", () => {

    it("ensures 'solved' status is private to each user", async () => {
      const tokenA = await registerAndLogin("billg@microsoft.com", "Bill Gates");
      const q = await createQuestion(tokenA, { answer: "Secret" }); 

      await request(app)
        .post(`/api/questions/${q.id}/play`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ answer: "Secret" }); 

      const resA = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${tokenA}`); 
      expect(resA.body.data[0].solved).toBe(true);

      const tokenB = await registerAndLogin("zuckerberg@fb.com", "Mark Zuckerberg"); 

      const resB = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${tokenB}`); 
      
      expect(resB.body.data[0].solved).toBe(false); 
    });

  });

});