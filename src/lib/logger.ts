import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
  transport: isProd 
    ? undefined 
    : { 
        target: "pino-pretty", 
        options: { colorize: true } 
      },
});

export default logger;