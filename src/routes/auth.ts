import express, { Request, Response, NextFunction, Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

// Relative local imports matching the strict ESM .js extension rule
import { prisma } from "../lib/prisma.js";
import { ConflictError, UnauthorizedError } from "../lib/errors.js";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is missing from your configuration.");
}

const router: Router = express.Router();

const RegisterInput = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(72),
  name: z.string().min(1).max(100),
  recaptchaToken: z.string().optional(),
});

const LoginInput = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(72),
});

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await fetch(verifyUrl, { method: "POST" });
    const data = await response.json();
    return data.success; // Returns true if the user passed the captcha
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, recaptchaToken } = RegisterInput.parse(req.body);

    // Only enforce reCAPTCHA if we are NOT in the test environment
    if (process.env.NODE_ENV !== "test") {
      if (!recaptchaToken) {
        return res.status(400).json({ msg: "Please complete the reCAPTCHA" });
      }

      const isHuman = await verifyRecaptcha(recaptchaToken);
      if (!isHuman) {
        return res.status(400).json({ msg: "reCAPTCHA verification failed. Are you a robot?" });
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

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
  } catch (err) {
    next(err); // Safely forwards Zod or DB errors to central handler
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

export default router;