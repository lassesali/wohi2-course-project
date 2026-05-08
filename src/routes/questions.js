const path = require("path");
const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const { NotFoundError } = require("../lib/errors");
const { ValidationError } = require("../lib/errors");
const {z} = require("zod");

const QuestionInput = z.object({
  question: z.string().trim().min(1).max(255, "Question is too long"), 
  answer: z.string().trim().min(1).max(255, "Answer is too long"),
  keywords: z.union([z.array(z.string()), z.string()]).optional(),
  date: z.string().date(),
});

const AnswerInput = z.object({
  answer: z.string().trim().min(1).max(255, "Answer is too long"),
});

function getValidId(req) {
  const id = Number(req.params.questionId);
  if (isNaN(id)) {
    throw new NotFoundError("Question not found");
  }
  return id;
}

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
    // Add a safe fallback: if keywords exists, map it. Otherwise, return an empty array.
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
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

router.get("/", async (req, res, next) => {
  try {
    const { keyword } = req.query;

    // --- Pagination & Clamping Logic ---
    // We avoid the '||' shortcut because '0 || 5' evaluates to 5 in JS.
    // By checking isNaN, we ensure that a provided '0' is preserved as 0 
    // so that Math.max(1, ...) can correctly clamp it to the floor of 1.

    const rawPage = parseInt(req.query.page);
    const pageInput = isNaN(rawPage) ? 1 : rawPage;
    const page = Math.max(1, pageInput);
    const rawLimit = parseInt(req.query.limit);
    // Only use the default 5 if the input is actually missing or not a number (NaN)
    const limitInput = isNaN(rawLimit) ? 5 : rawLimit; 
    const limit = Math.max(1, Math.min(100, limitInput));
    const skip = (page - 1) * limit;

    const where = keyword ?
    { keywords: { some: { name: keyword } } } : {};
    
    const [filteredQuestions, total] = await Promise.all([
        prisma.question.findMany({
            where,
            include: {
                keywords: true,
                user: true,
                attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 },
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
  } catch (err) { // Catch the error
    next(err);    // Pass it to our errorHandler.js
  }  
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res, next) => {
  try {
    const questionId = getValidId(req);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { 
        keywords: true, 
        user: true ,
        attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 },
        _count: { select: { attempts: true } }
      }
    });
    if (!question) {
      throw new NotFoundError("Question not found");
    }
    res.json(formatQuestion(question));
  } catch (err) { // Catch the error
    next(err);    // Pass it to our errorHandler.js
  }


});


//POST /api/questions/q:Id/play
// Play a question

router.post("/:questionId/play/", async (req,res,next) => {
  try {
    const questionId = getValidId(req);

    const { answer }  = AnswerInput.parse(req.body);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { keywords: true, user: true },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

    // Save the attempt to the database
    const newAttempt = await prisma.attempt.create({
      data: {
        userAnswer: answer,
        isCorrect: isCorrect, 
        userId: Number(req.user.userId),
        questionId: questionId
      }
    });

    return res.status(201).json({ 
        id: newAttempt.id,
        correct: isCorrect,
        isCorrect: isCorrect,
        submittedAnswer: answer,
        correctAnswer: question.answer,
        createdAt: newAttempt.createdAt
    }); 
  } catch (err) { // Catch the error
    next(err);    // Pass it to our errorHandler.js
  }

});

//POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req,res,next) => {
    try {
      const { question, answer, keywords, date }  = QuestionInput.parse(req.body);

      const keywordsArray = parseKeywords(keywords);
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const newQuestion = await prisma.question.create({
        data: {
          question, answer, userId: Number(req.user.userId), imageUrl,
          keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
              where: { name: kw }, create: { name: kw },
            })), 
          },
        },
        include: { keywords: true, user: true },     
      });
      
      res.status(201).json(formatQuestion(newQuestion));
    } catch (err) { // Catch the error
      next(err);    // Pass it to our errorHandler.js
    }
 });

//PUT
//Edit a specific question
router.put("/:questionId", isOwner, upload.single("image"), async (req, res, next) => {
  try {
    const questionId = req.question.id;

    // REMOVED redundant prisma.findUnique and 404 check here!

    const {question, answer, keywords } = QuestionInput.parse(req.body);

    // If the answer has actually changed, delete all past attempts
    // Use req.question (provided by isOwner) instead of existingQuestion
    if (req.question.answer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
      await prisma.attempt.deleteMany({
        where: { questionId: questionId }
      });
    }

  const keywordsArray = parseKeywords(keywords);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      question, answer, userId: Number(req.user.userId), imageUrl,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true, 
                user: true, 
                attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 }   
              },
    });
    res.json(formatQuestion(updatedQuestion));
  } catch (err) { // Catch the error
    next(err);    // Pass it to our errorHandler.js
  }
});

//DELETE
//Delete a specific question
router.delete("/:questionId", isOwner, async (req, res, next) => {
  try {
    const questionId = req.question.id;

    // REMOVED redundant prisma.findUnique and 404 check here!

    // Delete all the child attempts (so they aren't orphaned). 
    // We didn't want to add cascade delete to the schema.
    await prisma.attempt.deleteMany({
      where: { questionId: questionId }
    });

    await prisma.question.delete({ where: { id: questionId } });

    res.json({
      msg: "Question deleted successfully", 
      // Use req.question provided by the isOwner middleware!
      question: formatQuestion(req.question),
    });
  } catch (err) { // Catch the error
    next(err);    // Pass it to our errorHandler.js
  } 
});

// Multer errors as JSON
router.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err?.message === "Only image files are allowed"
  ) {
    return res.status(400).json({ msg: err.message });
  }

  next(err);
});

module.exports = router;
