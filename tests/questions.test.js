const {
  request,
  app,
  prisma,
  resetDb,
  registerAndLogin,
  createQuestion,
} = require("./helpers");

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
    
    // Test the ceiling (100)
    const resHigh = await request(app)
      .get("/api/questions?limit=999")
      .set("Authorization", `Bearer ${token}`);
    expect(resHigh.body.limit).toBe(100);

    // Test the floor (1)
    const resLow = await request(app)
      .get("/api/questions?limit=0")
      .set("Authorization", `Bearer ${token}`);
    expect(resLow.body.limit).toBe(1);
  });
});

describe("Final Architectural Edge Cases", () => {
  it("removes old keywords when a question is updated (Testing set: [])", async () => {
    const token = await registerAndLogin();
    // 1. Create with two keywords
    const q = await createQuestion(token, { keywords: "math, science" });

    // 2. Update to only one keyword
    const res = await request(app)
      .put(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Q",
        answer: "A",
        keywords: "math" // 'science' is omitted
      });

    expect(res.body.keywords).toContain("math");
    expect(res.body.keywords).not.toContain("science");
    expect(res.body.keywords.length).toBe(1);
  });

  it("handles duplicate correct attempts efficiently (Testing take: 1)", async () => {
    const token = await registerAndLogin();
    const q = await createQuestion(token, { answer: "Paris" });

    // 1. Play correctly TWICE
    await request(app).post(`/api/questions/${q.id}/play`).set("Authorization", `Bearer ${token}`).send({ answer: "Paris" });
    await request(app).post(`/api/questions/${q.id}/play`).set("Authorization", `Bearer ${token}`).send({ answer: "Paris" });

    // 2. Fetch the question
    const res = await request(app)
      .get(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`);

    // 3. formatQuestion should still show solved: true and not crash
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
    // 1. Create a specific question with a specific keyword
    await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Q", answer: "A", keywords: "filterme" });

    // 2. Fetch using the query parameter to trigger Line 76's true branch
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
    expect(question.userId).not.toBe(99999);
  });
});

describe("PUT /api/questions/:questionId (authorization)", () => {
   
  it("returns 403 when editing someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");
    const question = await createQuestion(aliceToken, { question: "Alice's question" });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");
    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ question: "hijacked", answer: "x" });

    expect(res.status).toBe(403);

    const after = await prisma.question.findUnique({ where: { id: question.id } });
    expect(after.question).toBe("Alice's question");
  });

  it("returns 404 when the questionId is not a valid number (NaN) (Triggers Line 10)", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put(`/api/questions/not-a-number`) // Testing a PUT request with NaN
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Q", answer: "A" });
      
    expect(res.status).toBe(404);
  });

  it("returns 404 when attempting to edit a non-existent question (Triggers Line 18)", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put(`/api/questions/99999`) // Testing a PUT request with a ghost ID
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Q", answer: "A" });
      
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

  it("returns solved: true in the response payload if the user had solved it before deletion (Regression check)", async () => {
    const token = await registerAndLogin();
    
    // 1. Create a target question
    const q = await createQuestion(token, { question: "Delete Me Soon", answer: "42" });

    // 2. Play it correctly to set the database state to 'solved' for this user
    await request(app)
      .post(`/api/questions/${q.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "42" });

    // 3. Perform the DELETE request and capture the response
    const res = await request(app)
      .delete(`/api/questions/${q.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // 4. The Regression Assertion: Ensure the 'question' object in the response 
    // correctly parsed the snapshot and retained the solved: true status.
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
      .send('{"email":"a@b.io","password":"pw12345","name":"A"}');
    expect(res.status).toBe(400);
  });
});

describe("Edge Cases: File Uploads & String Keywords", () => {
  let token;

  // SETUP: Create a user and get an auth token before running these tests
  beforeEach(async () => {
    token = await registerAndLogin("edgecase@test.io", "Edge Case User");
  });

  it("creates a question with an image upload", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What color is the sky?")
      .field("answer", "Blue")
      .attach("image", Buffer.from("fake-image-data"), "test.png"); 

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toMatch(/^\/uploads\//); 
  });

  it("updates a question with a new image upload (triggering the truthy branch)", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Updated question text")
      .field("answer", "Updated answer text")
      .attach("image", Buffer.from("fake-updated-image"), "updated.png");

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^\/uploads\//);
  });

  it("returns 400 and catches the Multer error if the file is not an image", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What is 2+2?")
      .field("answer", "4")
      .attach("image", Buffer.from("fake-text-data"), "document.txt"); 

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("Only image files are allowed"); 
  });

  it("parses keywords correctly when sent as a comma-separated string", async () => {
    // 1. Generate the token directly inside the test so it can't escape scope!
    const token = await registerAndLogin("keyworduser@test.io", "Keyword User");

    // 2. Make the request using our fresh token
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What does HTML stand for?",
        answer: "HyperText Markup Language",
        keywords: "web, frontend, basics" 
      });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toContain("frontend");
    expect(res.body.keywords.length).toBe(3);
  });

});

describe("500 Internal Server Errors (Catch Blocks)", () => {
  it("catches errors in GET / and passes them to the error handler", async () => {
    const token = await registerAndLogin();
    
    // Force Prisma to throw a simulated crash for the next call only
    vi.spyOn(prisma.question, 'findMany').mockRejectedValueOnce(new Error("Simulated DB Crash"));

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500); // Handled safely by your errorHandler.js!
  });

  it("catches errors in DELETE /:questionId and passes them to the error handler", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    // Force Prisma to throw a simulated crash when attempting to delete
    vi.spyOn(prisma.question, 'delete').mockRejectedValueOnce(new Error("Simulated DB Crash"));

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500); 
  });
});

it("catches errors in PUT /:questionId and passes them to the error handler", async () => {
  const token = await registerAndLogin();
  const question = await createQuestion(token); // Ensure ownership so isOwner passes

  // Force Prisma to throw a simulated crash when attempting to update
  vi.spyOn(prisma.question, 'update').mockRejectedValueOnce(new Error("Simulated DB Crash"));

  const res = await request(app)
    .put(`/api/questions/${question.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ 
      question: "Will this crash?", 
      answer: "Yes" 
    });

  expect(res.status).toBe(500); // Verified by your global errorHandler.js
});

describe("formatQuestion Fallback Branches (Coverage Restorer)", () => {
  it("safely formats a question that is missing relational data", async () => {
    const token = await registerAndLogin();

    // 1. Hijack Prisma to return a completely stripped-down question
    // with NO keywords, NO user, and NO attempts.
    vi.spyOn(prisma.question, 'findUnique').mockResolvedValueOnce({
      id: 888,
      question: "Barebones Question",
      answer: "Nothing else included",
      userId: 1,
      imageUrl: null
      // Notice: We are intentionally leaving out 'keywords', 'user', and 'attempts'
    });

    // 2. Hit the GET route. The route will try to 'include' the relations, 
    // but our mock will force it to return the barebones object above.
    const res = await request(app)
      .get("/api/questions/888")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // 3. This proves that formatQuestion hit the 'false' branches on lines 63-64
    // without crashing your app!
    expect(res.body.userName).toBeNull();
    expect(res.body.keywords).toEqual([]);
    expect(res.body.solved).toBe(false);
  });
});
