const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const SECRET = process.env.JWT_SECRET;
const { ValidationError } = require("../lib/errors");
const { ConflictError } = require("../lib/errors");
const { UnauthorizedError } = require("../lib/errors");

const RegisterInput = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(72),
  name: z.string().min(1).max(100),
});

const LoginInput = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(72),
});

// Here we will add all routes related to authentication

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = RegisterInput.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email },});

  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the user
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "24h" });

  res.status(201).json({
    message: "User registered successfully",
    token,
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = LoginInput.parse(req.body);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Verify the password
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.json({ token });
});

module.exports = router; // This should be the last line
