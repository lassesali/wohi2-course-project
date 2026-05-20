import path from "path";
import { fileURLToPath } from "url";
import express, { Request, Response, NextFunction, Router } from "express";
import multer from "multer";
import { z } from "zod";

// Central Prisma client and custom modules with explicit .js extensions
import { prisma } from "../lib/prisma.js";
import authenticate from "../middleware/auth.js";
import isOwner from "../middleware/isOwner.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: Router = express.Router();

// Define input validation schemas via Zod
const QuestionInput = z.object({
  question: z.string().trim().min(1).max(255, "Question is too long"),
  answer: z.string().trim().min(1).max(255, "Answer is too long"),
  keywords: z.union([z.array(z.string()), z.string()]).optional(),
});

const AnswerInput = z.object({
  answer: z.string().trim().min(1).max(255, "Answer is too long"),
});

// Create a unified interface to extend the core Express Request object safely
interface CustomRequest extends Request {
  user?: any;
  question?: any;
}

function getValidId(req: Request): number {
  const id = Number(req.params.questionId);
  if (isNaN(id)) {
    throw new NotFoundError("Question not found");
  }
  return id;
}

// Multer storage engine definition
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
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only image files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function parseKeywords(keywords: any): string[] {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

function formatQuestion(question: any) {
  const isSolved = !!(question.attempts && question.attempts.length > 0);

  return {
    ...question,
    keywords: question.keywords ? question.keywords.map((k: any) => k.name) : [],
    userName: question.user?.name || null,
    user: undefined,
    solved: isSolved,
    attempts: undefined,
    _count: undefined,
  };
}

// Secure all subsequent routes in this file
router.use(authenticate);

// GET /api/questions
router.get("/", async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const keyword = req.query.keyword as string | undefined;

    const rawPage = parseInt(req.query.page as string);
    const pageInput = isNaN(rawPage) ? 1 : rawPage;
    const page = Math.max(1, pageInput);

    const rawLimit = parseInt(req.query.limit as string);
    const limitInput = isNaN(rawLimit) ? 5 : rawLimit;
    const limit = Math.max(1, Math.min(100, limitInput));
    const skip = (page - 1) * limit;

    const where: any = keyword ? { keywords: { some: { name: keyword } } } : {};

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

    res.json({
      data: filteredQuestions.map(formatQuestion),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/questions/:questionId
router.get("/:questionId", async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const questionId = getValidId(req);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 },
        _count: { select: { attempts: true } },
      },
    });
    if (!question) {
      throw new NotFoundError("Question not found");
    }
    res.json(formatQuestion(question));
  } catch (err) {
    next(err);
  }
});

// POST /api/questions/:questionId/play/
router.post("/:questionId/play/", async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const questionId = getValidId(req);
    const { answer } = AnswerInput.parse(req.body);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { keywords: true, user: true },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

    const newAttempt = await prisma.attempt.create({
      data: {
        userAnswer: answer,
        isCorrect: isCorrect,
        userId: Number(req.user.userId),
        questionId: questionId,
      },
    });

    res.status(201).json({
      id: newAttempt.id,
      correct: isCorrect,
      isCorrect: isCorrect,
      submittedAnswer: answer,
      correctAnswer: question.answer,
      createdAt: newAttempt.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/questions
router.post("/", upload.single("image"), async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const { question, answer, keywords } = QuestionInput.parse(req.body);

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question,
        answer,
        userId: Number(req.user.userId),
        imageUrl,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true, user: true },
    });

    res.status(201).json(formatQuestion(newQuestion));
  } catch (err) {
    next(err);
  }
});

// PUT /api/questions/:questionId
router.put("/:questionId", isOwner, upload.single("image"), async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const questionId = req.question.id;
    const { question, answer, keywords } = QuestionInput.parse(req.body);

    if (req.question.answer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
      await prisma.attempt.deleteMany({
        where: { questionId: questionId },
      });
    }

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        question,
        answer,
        userId: Number(req.user.userId),
        imageUrl,
        keywords: {
          set: [],
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 },
      },
    });
    res.json(formatQuestion(updatedQuestion));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/questions/:questionId
router.delete("/:questionId", isOwner, async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const questionId = req.question.id;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: Number(req.user.userId), isCorrect: true }, take: 1 },
        _count: { select: { attempts: true } },
      },
    });

    await prisma.attempt.deleteMany({
      where: { questionId: questionId },
    });

    await prisma.question.delete({ where: { id: questionId } });

    res.json({
      msg: "Question deleted successfully",
      question: formatQuestion(question),
    });
  } catch (err) {
    next(err);
  }
});

export default router;