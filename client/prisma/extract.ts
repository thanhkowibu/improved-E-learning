import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      enrollments: {
        orderBy: { enrolledAt: "asc" },
      },
      chatThreads: {
        orderBy: { createdAt: "asc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              materials: {
                orderBy: { createdAt: "asc" },
              },
              progress: {
                orderBy: { createdAt: "asc" },
              },
              bookmarks: {
                orderBy: { createdAt: "asc" },
              },
              quiz: {
                include: {
                  questions: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                      options: {
                        orderBy: { orderIndex: "asc" },
                      },
                    },
                  },
                  attempts: {
                    orderBy: { startedAt: "asc" },
                    include: {
                      answers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const outputPath = path.join(process.cwd(), "prisma", "data.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ users, courses }, jsonReplacer, 2),
    "utf8",
  );

  console.log(`Extracted ${users.length} users.`);
  console.log(`Extracted ${courses.length} courses.`);
  console.log(`Saved data to ${outputPath}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to extract database data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
