const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

function formatQuestion(question) {
  return {
    ...question,
  };
}

router.use(authenticate);

// GET /api/questions
// List all questions
router.get("/", async (req, res) => {

  const where = {};

  const filteredQuestions = await prisma.question.findMany({
    where,
    include: {},
    orderBy: { id: "asc" }
  });

  res.json(filteredQuestions.map(formatQuestion));
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {},
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});

//POST /api/questions
// Create a new question
router.post("/", async (req,res) => {
    const { question, answer }  = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "Question and answer are required"})
    }
    
    const newQuestion = await prisma.question.create({
      data: {
        question, answer,
      },
      include: {},     
    });
    
    res.status(201).json(formatQuestion(newQuestion));
});

//PUT
//Edit a specific question
router.put("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  const existingQuestion = await prisma.question.findUnique({
    where: { id: questionId }
  });
 
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  const {question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({msg: "Question and answer are required"})
  }

 const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      question, answer,
    },
    include: {},
  });
  
  res.json(formatQuestion(updatedQuestion));
});

//DELETE
//Delete a specific question
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    msg: "Question deleted successfully", 
    question: formatQuestion(question),
  });
});

module.exports = router;
