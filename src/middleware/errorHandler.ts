import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import multer from "multer";
import { AppError } from "../lib/errors.js";

interface LoggingRequest extends Request {
  log?: any;
}

export default function errorHandler(
  err: any,
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): Response | void {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid input",
      issues: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, msg: err.message });
  }

  if (req.log) {
    req.log.error({ err }, "unhandled error");
  } else {
    console.error(err);
  }
  
  res.status(500).json({ message: "Internal server error" });
}