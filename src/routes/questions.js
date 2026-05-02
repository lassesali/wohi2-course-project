const path = require("path");
const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

function formatQuestion(question) {

  const isSolved = !!(question.attempts && question.attempts.length > 0);

  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user?.name || null,
    user: undefined,
    solved: isSolved,
    attempts: undefined,
    _count: undefined
  };
}

router.use(authenticate);

// GET /api/questions?keyword=http&page=1&limit=5
// List all questions

router.get("/", async (req, res) => {
  const { keyword } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = keyword ?
  { keywords: { some: { name: keyword } } } : {};

  const [filteredQuestions, total] = await Promise.all([
      prisma.question.findMany({
          where,
          include: {
              keywords: true,
              user: true,
              attempts: { where: { userId: req.user.userId, isCorrect: true }, take: 1 },
              _count: { select: { attempts: true } },
          },
          orderBy: { id: "asc" },
          skip,
          take: limit,
      }),
      prisma.question.count({ where }),
  ]);

  res.json({  data: filteredQuestions.map(formatQuestion),
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
   });
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { 
      keywords: true, 
      user: true ,
      attempts: { where: { userId: req.user.userId, isCorrect: true }, take: 1 },
      _count: { select: { attempts: true } }
    }
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});


//POST /api/questions/q:Id/play
// Play a question

router.post("/:questionId/play/", async (req,res) => {
  const questionId = Number(req.params.questionId);

  const { answer }  = req.body;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  let isCorrect = false;
  if ( question.answer.toLowerCase() == answer.toLowerCase() ) {
      isCorrect = true;
  }

  // Save the attempt to the database
  await prisma.attempt.create({
    data: {
      userAnswer: answer,
      isCorrect: isCorrect, // Dynamically sets to true or false
      userId: req.user.userId,
      questionId: questionId
    }
  });

  return res.status(201).json({ 
      correct: isCorrect,
      correctAnswer: question.answer
  }); 

});

//POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req,res) => {

    const { question, answer, keywords }  = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "Question and answer are required"})
    }

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question, answer, userId: req.user.userId, imageUrl,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw }, create: { name: kw },
          })), 
        },
      },
      include: { keywords: true, user: true },     
    });
    
    res.status(201).json(formatQuestion(newQuestion));

 });

//PUT
//Edit a specific question
router.put("/:questionId", isOwner, upload.single("image"), async (req, res) => {
  const questionId = Number(req.params.questionId);
  const existingQuestion = await prisma.question.findUnique({
    where: { id: questionId }
  });
 
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  const {question, answer, keywords } = req.body;
  if (!question || !answer) {
    return res.status(400).json({msg: "Question and answer are required"})
  }

  // If the answer has actually changed, delete all past attempts
  if (existingQuestion.answer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
    await prisma.attempt.deleteMany({
      where: { questionId: questionId }
    });
  }

 const keywordsArray = parseKeywords(keywords);
 const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
 
 const updatedQuestion = await prisma.question.update({
   where: { id: questionId },
   data: {
     question, answer, userId: req.user.userId, imageUrl,
     keywords: {
       set: [],
       connectOrCreate: keywordsArray.map((kw) => ({
         where: { name: kw },
         create: { name: kw },
       })),
     },
   },
   include: { keywords: true, user: true },
  });
  res.json(formatQuestion(updatedQuestion));
});

//DELETE
//Delete a specific question
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Delete all the child attempts (so they aren't orphaned). 
  // We didn't want to add cascade delete to the schema.
  await prisma.attempt.deleteMany({
    where: { questionId: questionId }
  });

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    msg: "Question deleted successfully", 
    question: formatQuestion(question),
  });
});

module.exports = router;
