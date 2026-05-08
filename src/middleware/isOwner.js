const prisma = require("../lib/prisma");
const { NotFoundError, ForbiddenError } = require("../lib/errors");

async function isOwner (req, res, next) {
  try { 
    const id = Number(req.params.questionId);
    
    // NaN CHECK
    if (isNaN(id)) {
      throw new NotFoundError("Question not found"); 
    }

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    if (question.userId !== req.user.userId) {
      throw new ForbiddenError("You can only modify your own questions");
    }

    req.question = question;
    next();
  } catch (error) { // CATCH AND FORWARD ERROR
    next(error);
  }
}

module.exports = isOwner;