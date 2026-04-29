const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const seedPosts = [
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

async function main() {
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

  // reset the AUTO_INCREMENT counter to 1
  //await prisma.$executeRaw`ALTER TABLE Question AUTO_INCREMENT = 1;` 

  for (const question of seedPosts) {
    await prisma.question.create({
      data: {
        question: question.question,
        answer: question.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
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
  .finally(() => prisma.$disconnect());