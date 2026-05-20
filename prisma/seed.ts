import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js"; // Reuse our configured Prisma v7 client instance

interface SeedPost {
  question: string;
  answer: string;
  keywords: string[];
}

const seedPosts: SeedPost[] = [
  {
    question: "What is the capital city of Japan?",
    answer: "Tokyo",
    keywords: ["geography", "asia", "cities", "japan"]
  },
  {
    question: "What is the hardest naturally occurring substance on Earth?",
    answer: "Diamond",
    keywords: ["science", "geology", "minerals", "carbon"]
  },
  {
    question: "Who wrote the famous play Hamlet?",
    answer: "Shakespeare",
    keywords: ["literature", "theatre", "history", "classics"]
  },
  {
    question: "What is the fastest land animal in the world?",
    answer: "Cheetah",
    keywords: ["nature", "animals", "wildlife", "biology"]
  }
];

async function main(): Promise<void> {
  // Clear out old records safely
  await prisma.attempt.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();

  // Create a default user
  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "octavia.blake756@gmail.com",
      password: hashedPassword,
      name: "Octavia",
    },
  });

  console.log("Created user:", user.email);

  // Synchronously seed questions
  for (const item of seedPosts) {
    await prisma.question.create({
      data: {
        question: item.question,
        answer: item.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: item.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });