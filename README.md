# 🧠 Quiz Game API 

> **Status:** 🧪 Core Logic 100% Tested | 🐳 Deployment Pending (Week 8)
> This project has evolved into a robust, defensively architected backend.
> The foundational API architecture, authentication, and relational data logic are finalized and verified with a **100% test coverage** suite across all statements, branches, and functions.

## 📖 Overview
This repository contains a high-performance backend API for a user-driven quiz game. Beyond basic CRUD operations, this project focuses on **architectural integrity**, using modern middleware patterns for ownership, comprehensive error handling, and strict schema validation. It is currently in the transition phase between core development and containerized deployment.

## 💻 Tech Stack
* **Runtime:** Node.js (v25.9.0+)
* **Framework:** Express.js
* **Language:** JavaScript / TypeScript
* **ORM:** Prisma
* **Database:** MySQL
* ~~**API Testing:** Bruno (`.bru` files included)~~
* **Testing:** Vitest & Supertest
* **Logging:** Pino & Pino-HTTP

## ✨ Features

### 🛡️ Defensive Architecture
* **100% Code Coverage:** Verified via Vitest and C8/V8 coverage reporting.
* **Ownership Middleware:** Custom `isOwner` logic protects `PUT` and `DELETE` routes, ensuring users can only modify their own data.
* **Strict Validation:** Every request body is parsed via Zod schemas to prevent injection and malformed data.
* **Centralized Error Handling:** Custom `AppError` classes (NotFoundError, ForbiddenError, etc.) and a global error handler for consistent JSON responses.
* **Safe ID Parsing:** Numeric ID validation helper prevents database crashes from non-numeric (NaN) inputs.

### 📊 Performance & Integrity
* **Structured Logging:** Integrated Pino for environment-aware logging (`silent` in tests, `info` in development).
* **Relational Integrity:** Explicit logic to purge `Attempt` records when a question is deleted to prevent orphaned database rows.
* **State Invalidation:** Automatically clears historical user attempts if a question's correct answer is updated by the author.

### Other
* [x] Basic server setup and database connection
* [x] Prisma schema initialization for core models
* [x] Authentication (JWT)
* [x] **Full-Stack Integration:** Connected the Express.js backend with the provided frontend UI.
* [x] **M:N Attempt Logging:** Implemented an `Attempt` database model that records a complete history of user submissions (using `prisma.create`) without overwriting previous guesses.
* [x] **Unrestricted Gameplay:** Configured the backend to accept consecutive submissions and allow authors to play their own questions, matching the frontend's open UI design.

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [MySQL](https://www.mysql.com/) installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lassesali/wohi2-course-project.git
   cd wohi2-course-project

2. **Install dependencies**
   ```bash
   npm install

3. **Set up environment variables**

   Create a .env file in the root directory and add your database connection string:
   ```bash
   DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/quiz_db"

5. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init

6. **Populate the database**
   ```bash
   npx prisma db seed

7. **Start the development server**
   ```bash
   npm run dev

### Database & Testing

1. **Initialize Production DB:**
   ```bash
   npx prisma db push

2. **Prepare Test Environment:**
   ```bash 
   npm run test:setup

3. **Run Full Test Suite:**
   ```bash
   npm run test

4. **Generate Coverage Report:**
   ```bash
   npm run test:coverage

## 📡 API Endpoints 

### 🔐 Authentication

**POST /api/auth/login** - Login

**POST /api/auth/register** - Register a new user

### 📝 Questions

**GET /api/questions** - List all questions (supports pagination & keywords)

**GET /api/questions/:qId** - Show a specific question

**POST /api/questions** - Create a question (supports image upload)

**PUT	/api/questions/:id** -	Edit a question (Owner only)

**DELETE	/api/questions/:id** -	Delete a question (Owner only)

**POST	/api/questions/:id/play** - Submit an answer and log an attempt

