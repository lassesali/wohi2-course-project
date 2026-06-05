import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../lib/errors.js";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is missing from your configuration.");
}

// Extend the Request interface to support user and logging objects
interface AuthenticatedRequest extends Request {
  user?: any;
  log?: any;
}

export default function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (req.log) {
      req.log.warn({ err }, "Error authenticating");
    }
    next(err); // Pass the original JWT error to the central error handler
  }
}