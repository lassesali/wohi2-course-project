const { request, app, prisma, resetDb, registerAndLogin, createQuestion } = require("./helpers");

beforeEach(resetDb);


describe("POST /api/questions/:questionId/play", () => {
  let token;
  let question;

  // Set up a clean user and question before all tests in this block
  beforeEach(async () => {
    token = await registerAndLogin("player@test.io", "Player One");
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
      
      // Verify it was actually saved in the DB
      const attempt = await prisma.attempt.findFirst({ where: { questionId: question.id } });
      expect(attempt).not.toBeNull();
      expect(attempt.isCorrect).toBe(true);
    });

    it("returns 201 and correct: true for a messy string (spaces and mixed case)", async () => {
      // Testing your .toLowerCase().trim() defensive logic
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

      // Verify the failure was logged in the DB
      const attempt = await prisma.attempt.findFirst({ where: { questionId: question.id } });
      expect(attempt.isCorrect).toBe(false);
    });
  });

  describe("2. Validation & Error Handling (The Strict Bouncer)", () => {
    it("returns 400 when the answer field is missing entirely", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({}); // Empty body

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid input");
    });

    it("returns 400 when the answer is an empty string", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "   " }); // Triggers Zod's .min(1) after whitespace is ignored/handled

      expect(res.status).toBe(400);
    });

    it("returns 400 when the answer is the wrong data type (number instead of string)", async () => {
      const res = await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: 42 }); // Strict Zod check

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

  describe("3. Relational Data Integrity (The Architect Checks)", () => {
    
    it("safely deletes attempts when a question is deleted (No Orphaned Records)", async () => {
      // 1. Play the question
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      // 2. Verify attempt exists
      let attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(1);

      // 3. Delete the question
      const deleteRes = await request(app)
        .delete(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`);
      
      expect(deleteRes.status).toBe(200);

      // 4. Verify the attempt was purged via your explicit deleteMany logic
      attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(0);
    });

    it("deletes previous attempts when the creator changes the correct answer (State Invalidation)", async () => {
      // 1. Play the question and win
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      // 2. Creator updates the answer to something else
      const updateRes = await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          question: "What is the capital of France?",
          answer: "Lyon", // Answer changed!
          keywords: ["geography"]
        });

      expect(updateRes.status).toBe(200);

      // 3. Verify the previous "Paris" attempts were purged
      const attemptCount = await prisma.attempt.count({ where: { questionId: question.id } });
      expect(attemptCount).toBe(0);
    });
    
    it("keeps previous attempts if the creator updates the question text but NOT the answer", async () => {
      // 1. Play the question and win
      await request(app)
        .post(`/api/questions/${question.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Paris" });

      // 2. Creator updates a typo in the question, but answer remains "Paris"
      await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          question: "What is the beautiful capital of France?", // Text changed
          answer: "Paris", // Answer same
          keywords: ["geography"]
        });

      // 3. Verify the attempt SURVIVED because the truth contract wasn't broken
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

      // 1. Initial check: should be unsolved
      const initial = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${token}`);
      expect(initial.body.data[0].solved).toBe(false);

      // 2. Play the question correctly
      await request(app)
        .post(`/api/questions/${q.id}/play`)
        .set("Authorization", `Bearer ${token}`)
        .send({ answer: "Winner" });

      // 3. Updated check: should now be solved
      const updated = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${token}`);
      expect(updated.body.data[0].solved).toBe(true);
    });
  });
    
  describe("5. Multi-User Isolation", () => {
    it("ensures 'solved' status is private to each user", async () => {
      // 1. Setup: User A creates a question
      const tokenA = await registerAndLogin("userA@test.io", "User A"); //
      const q = await createQuestion(tokenA, { answer: "Secret" }); //

      // 2. User A solves their own question
      await request(app)
        .post(`/api/questions/${q.id}/play`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ answer: "Secret" }); //

      // 3. Verify User A sees it as solved
      const resA = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${tokenA}`); //
      expect(resA.body.data[0].solved).toBe(true);

      // 4. User B logs in
      const tokenB = await registerAndLogin("userB@test.io", "User B"); //

      // 5. Verify User B sees the same question as UNSOLVED
      const resB = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${tokenB}`); //
      
      // The solved status must be false for User B because they haven't played it
      expect(resB.body.data[0].solved).toBe(false); 
    });
  });

});
