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
  },
  {
    question: "What is the largest ocean on Earth?",
    answer: "Pacific",
    keywords: ["geography", "nature", "ocean", "earth"]
  },
  {
    question: "Which chemical element has the symbol 'Au'?",
    answer: "Gold",
    keywords: ["science", "chemistry", "elements", "minerals"]
  },
  {
    question: "Who painted the famous artwork 'The Starry Night'?",
    answer: "Van Gogh",
    keywords: ["art", "history", "culture", "paintings"]
  },
  {
    question: "What is the smallest planet in our solar system?",
    answer: "Mercury",
    keywords: ["science", "space", "astronomy", "planets"]
  },
  {
    question: "Which country is the origin of the musical instrument the bagpipes?",
    answer: "Scotland",
    keywords: ["history", "music", "culture", "europe"]
  },
  {
    question: "What is the primary currency used in the United Kingdom?",
    answer: "Pound",
    keywords: ["finance", "economics", "europe", "money"]
  },
  {
    question: "How many bones are there in an adult human body?",
    answer: "206",
    keywords: ["science", "biology", "anatomy", "human"]
  },
  {
    question: "Which country is home to the Kangaroo?",
    answer: "Australia",
    keywords: ["nature", "animals", "wildlife", "geography"]
  },
  {
    question: "Who was the first person to step onto the Moon?",
    answer: "Neil Armstrong",
    keywords: ["history", "space", "astronomy", "exploration"]
  },
  {
    question: "What fast food chain features a red-headed clown mascot named Ronald?",
    answer: "McDonald's",
    keywords: ["culture", "food", "brands", "business"]
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