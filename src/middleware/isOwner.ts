import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";

interface OwnerValidationRequest extends Request {
  user?: any;
  question?: any;
}

export default async function isOwner(
  req: OwnerValidationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    if (!req.user || Number(question.userId) !== Number(req.user.userId)) {
      throw new ForbiddenError("You can only modify your own questions");
    }

    req.question = question;
    next();
  } catch (error) {
    next(error); // CATCH AND FORWARD ERROR
  }
}