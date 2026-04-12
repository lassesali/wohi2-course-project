const express = require("express");
const router = express.Router();

const questions = require("../data/questions");

// GET /questions
// List all questions
router.get("/", (req, res) => {
  return res.json(questions);
});

// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);

   const question = questions.find((q) => q.id === questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

//POST /api/questions
router.post("/", (req,res) => {
    const { question, answer }  = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "Question and answer are required"})
    }
    
    const existingIds = questions.map(q => q.id);
    const maxId = Math.max(...existingIds);

    const newQuestion = {
        id: questions.length ? maxId + 1 : 1,
        question, answer
    };    
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
});

//PUT
router.put("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);
  const questionItem = questions.find((q) => q.id === questionId);

  if (!questionItem) {
    return res.status(404).json({ message: "Question not found" });
  }

  const {question, answer } = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "Question and answer are required"})
    }

  questionItem.question = question;
  questionItem.answer = answer;
  
  res.json(questionItem);
});

//DELETE
router.delete("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);
  const questionIndex = questions.findIndex(q => q.id === questionId);

  if(questionIndex === -1){
    return res.status(404).json({msg:"Question not found"})
  }
  const deletedQuestion = questions.splice(questionIndex, 1);
  res.json({
    msg: "Question deleted successfully", 
    question: deletedQuestion
  });
});

module.exports = router;
