import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

interface UserData {
  id: string;
  email: string;
  hashedPassword: string;
  fullName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  avatarUrl: string | null;
  phoneNumber: string | null;
  gender: string | null;
  birthYear: number | null;
  highestEducation: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnrollmentData {
  id: string;
  studentId: string;
  courseId: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  enrolledAt: string;
}

interface ChatMessageData {
  id: string;
  threadId: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatThreadData {
  id: string;
  studentId: string;
  courseId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageData[];
}

interface MaterialData {
  id: string;
  lessonId: string;
  title: string;
  materialType: "PDF" | "VIDEO" | "LINK" | "OTHER";
  fileUrl: string;
  fileSizeBytes: string | null;
  geminiFileUri: string | null;
  geminiFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LessonProgressData {
  id: string;
  studentId: string;
  lessonId: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BookmarkData {
  id: string;
  userId: string;
  lessonId: string;
  createdAt: string;
}

interface QuizOptionData {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface QuizAnswerData {
  id: string;
  attemptId: string;
  questionId: string;
  optionId: string;
}

interface QuizAttemptData {
  id: string;
  quizId: string;
  studentId: string;
  score: number | null;
  totalPoints: number | null;
  startedAt: string;
  submittedAt: string | null;
  answers: QuizAnswerData[];
}

interface QuizQuestionData {
  id: string;
  quizId: string;
  questionText: string;
  explanation: string | null;
  orderIndex: number;
  points: number;
  createdAt: string;
  updatedAt: string;
  options: QuizOptionData[];
}

interface QuizData {
  id: string;
  lessonId: string;
  dueDate: string | null;
  maxAttempts: number;
  passingScore: number;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestionData[];
  attempts: QuizAttemptData[];
}

interface LessonData {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  lessonType: "LECTURE" | "QUIZ";
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  materials: MaterialData[];
  progress: LessonProgressData[];
  bookmarks: BookmarkData[];
  quiz: QuizData | null;
}

interface ModuleData {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  lessons: LessonData[];
}

interface CourseData {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  teacherId: string;
  aiEnabled: boolean;
  isPublished: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  enrollments: EnrollmentData[];
  chatThreads: ChatThreadData[];
  modules: ModuleData[];
}

interface SeedData {
  users: UserData[];
  courses: CourseData[];
}

function toDate(value: string) {
  return new Date(value);
}

function toNullableDate(value: string | null) {
  return value ? new Date(value) : null;
}

function toNullableBigInt(value: string | null) {
  return value ? BigInt(value) : null;
}

function userScalarData(user: UserData) {
  return {
    id: user.id,
    email: user.email,
    hashedPassword: user.hashedPassword,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    birthYear: user.birthYear,
    highestEducation: user.highestEducation,
    bio: user.bio,
    isActive: user.isActive,
    createdAt: toDate(user.createdAt),
    updatedAt: toDate(user.updatedAt),
  };
}

function buildQuizCreateData(quiz: QuizData): Prisma.QuizCreateWithoutLessonInput {
  return {
    id: quiz.id,
    dueDate: toNullableDate(quiz.dueDate),
    maxAttempts: quiz.maxAttempts,
    passingScore: quiz.passingScore,
    createdAt: toDate(quiz.createdAt),
    updatedAt: toDate(quiz.updatedAt),
    questions: {
      create: quiz.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        explanation: question.explanation,
        orderIndex: question.orderIndex,
        points: question.points,
        createdAt: toDate(question.createdAt),
        updatedAt: toDate(question.updatedAt),
        options: {
          create: question.options.map((option) => ({
            id: option.id,
            optionText: option.optionText,
            isCorrect: option.isCorrect,
            orderIndex: option.orderIndex,
          })),
        },
      })),
    },
  };
}

function buildCourseCreateData(course: CourseData): Prisma.CourseCreateInput {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    aiEnabled: course.aiEnabled,
    isPublished: course.isPublished,
    isPrivate: course.isPrivate,
    createdAt: toDate(course.createdAt),
    updatedAt: toDate(course.updatedAt),
    teacher: {
      connect: { id: course.teacherId },
    },
    enrollments: {
      create: course.enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        enrolledAt: toDate(enrollment.enrolledAt),
        student: {
          connect: { id: enrollment.studentId },
        },
      })),
    },
    chatThreads: {
      create: course.chatThreads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        createdAt: toDate(thread.createdAt),
        updatedAt: toDate(thread.updatedAt),
        student: {
          connect: { id: thread.studentId },
        },
        messages: {
          create: thread.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: toDate(message.createdAt),
          })),
        },
      })),
    },
    modules: {
      create: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        orderIndex: module.orderIndex,
        createdAt: toDate(module.createdAt),
        updatedAt: toDate(module.updatedAt),
        lessons: {
          create: module.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            content: lesson.content,
            lessonType: lesson.lessonType,
            orderIndex: lesson.orderIndex,
            createdAt: toDate(lesson.createdAt),
            updatedAt: toDate(lesson.updatedAt),
            materials: {
              create: lesson.materials.map((material) => ({
                id: material.id,
                title: material.title,
                materialType: material.materialType,
                fileUrl: material.fileUrl,
                fileSizeBytes: toNullableBigInt(material.fileSizeBytes),
                geminiFileUri: material.geminiFileUri,
                geminiFileName: material.geminiFileName,
                createdAt: toDate(material.createdAt),
                updatedAt: toDate(material.updatedAt),
              })),
            },
            progress: {
              create: lesson.progress.map((progress) => ({
                id: progress.id,
                isCompleted: progress.isCompleted,
                createdAt: toDate(progress.createdAt),
                updatedAt: toDate(progress.updatedAt),
                student: {
                  connect: { id: progress.studentId },
                },
              })),
            },
            bookmarks: {
              create: lesson.bookmarks.map((bookmark) => ({
                id: bookmark.id,
                createdAt: toDate(bookmark.createdAt),
                user: {
                  connect: { id: bookmark.userId },
                },
              })),
            },
            quiz: lesson.quiz
              ? {
                  create: buildQuizCreateData(lesson.quiz),
                }
              : undefined,
          })),
        },
      })),
    },
  };
}

async function seedUsers(users: UserData[]) {
  console.log(`Seeding ${users.length} users...`);

  for (const user of users) {
    const data = userScalarData(user);

    await prisma.user.upsert({
      where: { email: user.email },
      create: data,
      update: data,
    });
  }
}

async function seedCourses(courses: CourseData[]) {
  console.log(`Replacing ${courses.length} courses with nested content...`);

  const courseIds = courses.map((course) => course.id);
  if (courseIds.length > 0) {
    await prisma.course.deleteMany({
      where: { id: { in: courseIds } },
    });
  }

  for (const course of courses) {
    await prisma.course.create({
      data: buildCourseCreateData(course),
    });
  }
}

async function seedQuizAttempts(courses: CourseData[]) {
  const attempts = courses.flatMap((course) =>
    course.modules.flatMap((module) =>
      module.lessons.flatMap((lesson) => lesson.quiz?.attempts ?? []),
    ),
  );

  console.log(`Seeding ${attempts.length} quiz attempts...`);

  for (const attempt of attempts) {
    await prisma.quizAttempt.create({
      data: {
        id: attempt.id,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        startedAt: toDate(attempt.startedAt),
        submittedAt: toNullableDate(attempt.submittedAt),
        quiz: {
          connect: { id: attempt.quizId },
        },
        student: {
          connect: { id: attempt.studentId },
        },
        answers: {
          create: attempt.answers.map((answer) => ({
            id: answer.id,
            question: {
              connect: { id: answer.questionId },
            },
            option: {
              connect: { id: answer.optionId },
            },
          })),
        },
      },
    });
  }
}

async function main() {
  const dataPath = path.join(process.cwd(), "prisma", "data.json");
  const rawData = fs.readFileSync(dataPath, "utf8");
  const data = JSON.parse(rawData) as SeedData;

  console.log(`Loaded ${data.users.length} users from prisma/data.json.`);
  console.log(`Loaded ${data.courses.length} courses from prisma/data.json.`);

  await seedUsers(data.users);
  await seedCourses(data.courses);
  await seedQuizAttempts(data.courses);

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
