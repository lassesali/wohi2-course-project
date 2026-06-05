import path from "path";
import { fileURLToPath } from "url";
import express, { Request, Response } from "express";
import pinoHttp from "pino-http";

// Local imports must use the explicit .js extension
import questionsRouter from "./routes/questions.js";
import authRouter from "./routes/auth.js";
import errorHandler from "./middleware/errorHandler.js";
import { NotFoundError } from "./lib/errors.js";
import logger from "./lib/logger.js";

// Recreating __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) =>
        Boolean(req.url?.startsWith("/uploads") || req.url?.startsWith("/static")),
    },
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

// Middleware to parse JSON bodies
app.use(express.json());

app.use("/api/auth", authRouter);

// Everything under /api/questions
app.use("/api/questions", questionsRouter);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export default app;