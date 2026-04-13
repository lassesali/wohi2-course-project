const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedPosts = [
  {
    question: "What is the capital city of Japan?",
    answer: "Tokyo",  
  },
  {
    question: "What is the hardest naturally occurring substance on Earth?",
    answer: "Diamond",
  },
  {
    question: "Who wrote the famous play Hamlet?",
    answer: "Shakespeare",
  },
  {
    question: "What is the fastest land animal in the world?",
    answer: "Cheetah",
  },
];

async function main() {
  await prisma.question.deleteMany();

  for (const question of seedPosts) {
    await prisma.question.create({
      data: {
        question: question.question,
        answer: question.answer,
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
  .finally(() => prisma.$disconnect());