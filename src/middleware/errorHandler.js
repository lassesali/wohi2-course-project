const { ZodError } = require("zod");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { AppError } = require("../lib/errors");

function errorHandler(err, req, res, next) {
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

  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (req.log) {
    req.log.error({ err }, "unhandled error");
  } else {
    console.error(err);
  }
  res.status(500).json({ message: "Internal server error" });
}

module.exports = errorHandler;