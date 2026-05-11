const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET;
const { ForbiddenError } = require("../lib/errors");
const { UnauthorizedError } = require("../lib/errors");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided"); // This correctly throws a 401 for NO token
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.log.warn({ err }, "Error authenticating");
    next(err); // Pass the original JWT error to the central error handler
  }
}

module.exports = authenticate;
