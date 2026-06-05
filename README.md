# 🧠 Quiz Game API 

> **Status:** 🛡️ [100% Test Coverage (87/87)](https://lassesali.github.io/wohi2-course-project/) | 🚀 [Successfully Deployed to Railway](https://wohi2-course-project-production-0d80.up.railway.app/) | ⏳ Core Complete 
> 
> This project has evolved into a robust, defensively architected backend.
> The foundational API architecture, authentication, and relational data logic are finalized and verified with a **100% test coverage** suite across all statements, branches, and functions.

## 📖 Overview
This repository contains a high-performance backend API for a user-driven quiz game. Beyond basic CRUD operations, this project focuses on **architectural integrity**, using modern middleware patterns for ownership, comprehensive error handling, cloud-native file streaming and strict schema validation. 

## 💻 Tech Stack
* **Runtime:** Node.js (v25.9.0+)
* **Framework:** Express.js
* **Language:** TypeScript / JavaScript
* **ORM:** Prisma (v7)
* **Database:** MySQL
* **File Storage:** Cloudinary
* **Testing:** Vitest & Supertest
* **Logging:** Pino & Pino-HTTP

## ✨ Features

### 🛡️ Defensive Architecture
* **TypeScript Migration:** The codebase has been strictly typed to ensure predictable data flows and unified interfaces.
* **100% Code Coverage:** Verified via Vitest and C8/V8 coverage reporting.
* **Ownership Middleware:** Custom `isOwner` logic protects `PUT` and `DELETE` routes, ensuring users can only modify their own data.
* **Strict Validation:** Every request body is parsed via Zod schemas to prevent injection and malformed data, strip unexpected fields, and enforce strict type rules before hitting the database.
* **Centralized Error Handling:** Custom `AppError` classes (NotFoundError, ForbiddenError, etc.) and a global error handler for consistent JSON responses.
* **Safe ID Parsing:** Numeric ID validation helper prevents database crashes from non-numeric (NaN) inputs.

### ☁️ Cloud-Native & Performance & Data Integrity
* **Memory Streaming Uploads:** Replaced local disk storage with multer.memoryStorage(), streaming buffers directly to Cloudinary. This ensures the app is fully serverless-ready and will not break on ephemeral file systems like Heroku or Railway.
* **Structured Logging:** Integrated Pino for environment-aware logging (`silent` in tests, `info` in development).
* **Relational Integrity:** Explicit logic to purge `Attempt` records when a question is deleted to prevent orphaned database rows.
* **State Invalidation:** Automatically clears historical user attempts if a question's correct answer is updated by the author.
* **DTO Pattern:** The API implements a data serialization layer to strip sensitive database fields (like embedded user objects or raw count queries) before sending payloads to the client.

### Other
* [x] Basic server setup and database connection
* [x] Prisma schema initialization for core models
* [x] Authentication (JWT)
* [x] **Full-Stack Integration:** Connected the Express.js backend with the provided frontend UI.
* [x] **M:N Attempt Logging:** Implemented an `Attempt` database model that records a complete history of user submissions (using `prisma.create`) without overwriting previous guesses.
* [x] **Unrestricted Gameplay:** Configured the backend to accept consecutive submissions and allow authors to play their own questions, matching the frontend's open UI design.
* [x] **Object-Oriented UI:** Completely refactored the frontend into a modular Vanilla JS architecture. This includes robust client-side state management (utilizing sessionStorage) and a scalable class-based structure, all adjusted step-by-step to match the original UI.
* [x] **Double-Shuffle Randomization:** Implemented a /random endpoint that pulls 10 random questions, bypassing typical SQL IN(...) ordering limitations to guarantee a truly randomized payload.

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

   Create a .env file in the root directory and add your connection strings:
   ```bash
   DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/quiz_db"
   JWT_SECRET="your_secret_key"
   NODE_ENV="production"
   LOG_LEVEL="silent"
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_api_secret"
   RECAPTCHA_SECRET_KEY="your_api_secret"

4. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init

5. **Populate the database**
   ```bash
   npx prisma db seed

6. **Start the development server**
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

**GET /api/questions/random** - Fetch 10 truly randomized questions

**GET /api/questions/:qId** - Show a specific question

**POST /api/questions** - Create a question (supports Cloudinary image upload)

**PUT	/api/questions/:id** -	Edit a question (Owner only)

**DELETE	/api/questions/:id** -	Delete a question (Owner only)

**POST	/api/questions/:id/play** - Submit an answer and log an attempt

