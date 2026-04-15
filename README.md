# 🧠 Quiz Game API (WIP)

> **Status:** 🚧 Work in Progress
> This project is currently in active development. It is being built as a step-by-step backend project to master modern server-side development and database management.

## 📖 Overview
This repository contains the backend API for a user-driven quiz game. The core loop allows users to both submit custom questions and answer questions submitted by others. It is designed to demonstrate robust relational database modeling, data validation, and RESTful API routing.

## 💻 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Language:** JavaScript / TypeScript
* **ORM:** Prisma
* **Database:** MySQL
* **API Testing:** Bruno (`.bru` files included)

## ✨ Features

### Currently Implemented
* [x] Basic server setup and database connection
* [x] Prisma schema initialization for core models

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [MySQL](https://www.mysql.com/) installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/lassesali/wohi2-course-project.git](https://github.com/lassesali/wohi2-course-project.git)
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

## 📡 API Endpoints (Draft)

GET /api/questions - List all questions
GET /api/questions/:qId - Show a specific question
POST /api/questions - Create a new question
PUT /api/questions/:qId - Edit a question
DELETE /api/questions/:qId - Delete a question
