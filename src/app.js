const path = require("path");
const express = require('express');
const questionsRouter = require ("./routes/questions");
const authRouter = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");
const { NotFoundError } = require("./lib/errors");
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");

const app = express();

app.use(pinoHttp({logger,
  autoLogging: {ignore: req => 
    req.url.startsWith("/uploads") || req.url.startsWith("/static"),
  },
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware to parse JSON bodies (will be useful in later steps)
app.use(express.json());

app.use("/api/auth", authRouter);

// everything under /api/questions
app.use("/api/questions", questionsRouter);

app.use((req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

module.exports = app;