# Database Schema — LearnAI LMS

> **Version:** 9.0
> **Last Updated:** 2026-06-19
> **Source of Truth:** `client/prisma/schema.prisma`
> **Database:** PostgreSQL 16 via Prisma ORM

---

## Overview

LearnAI currently uses 15 Prisma models:

| # | Model | Table | Purpose |
| --- | --- | --- | --- |
| 1 | `User` | `users` | Platform accounts, roles, profile fields, auth state |
| 2 | `Course` | `courses` | Teacher-owned courses, AI/private/published flags |
| 3 | `Module` | `modules` | Ordered course sections |
| 4 | `Lesson` | `lessons` | Ordered learning units, lecture/quiz type |
| 5 | `Material` | `materials` | UploadThing file URL, file metadata, Gemini file refs |
| 6 | `Enrollment` | `enrollments` | Student-course membership and status |
| 7 | `ChatThread` | `chat_threads` | AI Tutor thread per student/course |
| 8 | `ChatMessage` | `chat_messages` | Stored chat history for Gemini context |
| 9 | `LessonProgress` | `lesson_progress` | Lesson completion tracking |
| 10 | `Bookmark` | `bookmarks` | Saved lessons per user |
| 11 | `Quiz` | `quizzes` | Lesson quiz settings |
| 12 | `QuizQuestion` | `quiz_questions` | Quiz questions |
| 13 | `QuizOption` | `quiz_options` | Multiple-choice options and correctness |
| 14 | `QuizAttempt` | `quiz_attempts` | Student quiz submissions |
| 15 | `QuizAnswer` | `quiz_answers` | Submitted answer records |

---

## Enums

```prisma
enum UserRole {
  ADMIN
  TEACHER
  STUDENT
}

enum EnrollmentStatus {
  ACTIVE
  COMPLETED
  DROPPED
}

enum MaterialType {
  PDF
  VIDEO
  LINK
  OTHER
}

enum LessonType {
  LECTURE
  QUIZ
}
```

---

## Relationship Map

```text
User (TEACHER) 1 ─── N Course
Course 1 ─── N Module
Module 1 ─── N Lesson
Lesson 1 ─── N Material
Lesson 1 ─── 0..1 Quiz
Quiz 1 ─── N QuizQuestion
QuizQuestion 1 ─── N QuizOption
Quiz 1 ─── N QuizAttempt
QuizAttempt 1 ─── N QuizAnswer

User (STUDENT) N ─── N Course via Enrollment
User (STUDENT) N ─── N Lesson via LessonProgress
User N ─── N Lesson via Bookmark
User (STUDENT) + Course 1 ─── N ChatThread
ChatThread 1 ─── N ChatMessage
```

Cascade deletes are used heavily:

- Deleting a course removes modules, lessons, materials, enrollments, chat threads, quizzes, attempts, and dependent records through relation chains.
- Deleting a user removes owned courses or student-owned records depending on relation direction.

---

## Models

### `User`

Stores all platform users.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Public-safe UUID |
| `email` | `String @unique` | Login identifier |
| `hashedPassword` | `String` | bcrypt hash |
| `fullName` | `String` | Display name |
| `role` | `UserRole @default(STUDENT)` | ADMIN, TEACHER, STUDENT |
| `avatarUrl` | `String?` | Public profile/avatar image |
| `phoneNumber` | `String?` | Private profile field |
| `gender` | `String?` | Optional profile field |
| `birthYear` | `Int?` | Optional profile field |
| `highestEducation` | `String?` | Public profile field |
| `bio` | `String? @db.Text` | Public profile biography |
| `isActive` | `Boolean @default(true)` | Soft-disable flag |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `courses` as teacher-owned courses.
- `enrollments` as student enrollments.
- `chatThreads`, `lessonProgress`, `quizAttempts`, `bookmarks`.

Indexes:

- `@@index([email])`
- `@@index([role])`

---

### `Course`

Teacher-owned course container.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Course UUID |
| `title` | `String` | Course title |
| `description` | `String?` | Course description |
| `thumbnailUrl` | `String?` | Course cover image |
| `teacherId` | `String` | FK to `User` |
| `aiEnabled` | `Boolean @default(false)` | AI Tutor enabled flag |
| `isPublished` | `Boolean @default(false)` | Catalog visibility |
| `isPrivate` | `Boolean @default(false)` | Closed enrollment flag |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `teacher` via `TeacherCourses`.
- `modules`, `enrollments`, `chatThreads`.

Important behavior:

- `isPrivate = true` disables student self-enrollment and self-unenrollment.
- Teachers/admins can bulk-add or bulk-remove students.
- `aiEnabled = true` means Gemini material setup has completed.

Indexes:

- `@@index([teacherId])`
- `@@index([isPublished])`

---

### `Module`

Ordered course section.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Module UUID |
| `courseId` | `String` | FK to `Course` |
| `title` | `String` | Module title |
| `description` | `String?` | Optional description |
| `orderIndex` | `Int @default(0)` | Sort order |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `course`
- `lessons`

Index:

- `@@index([courseId])`

---

### `Lesson`

Ordered learning unit.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Lesson UUID |
| `moduleId` | `String` | FK to `Module` |
| `title` | `String` | Lesson title |
| `content` | `String?` | Markdown body |
| `lessonType` | `LessonType @default(LECTURE)` | LECTURE or QUIZ |
| `orderIndex` | `Int @default(0)` | Sort order |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `materials`
- `progress`
- `bookmarks`
- `quiz`

Index:

- `@@index([moduleId])`

---

### `Material`

Lesson file or external material.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Material UUID |
| `lessonId` | `String` | FK to `Lesson` |
| `title` | `String` | Display filename/title |
| `materialType` | `MaterialType @default(PDF)` | PDF, VIDEO, LINK, OTHER |
| `fileUrl` | `String` | UploadThing URL or external URL |
| `fileSizeBytes` | `BigInt?` | File size for UI |
| `geminiFileUri` | `String?` | Gemini File API URI |
| `geminiFileName` | `String?` | Gemini File API file name/id |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Used for Gemini freshness checks |

Important behavior:

- `fileUrl` is the durable source of truth.
- Gemini file refs may expire and can be re-synced from `fileUrl`.

Index:

- `@@index([lessonId])`

---

### `Enrollment`

Student-course join table.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Enrollment UUID |
| `studentId` | `String` | FK to `User` |
| `courseId` | `String` | FK to `Course` |
| `status` | `EnrollmentStatus @default(ACTIVE)` | ACTIVE, COMPLETED, DROPPED |
| `enrolledAt` | `DateTime @default(now())` | Enrollment date |

Constraints:

- `@@unique([studentId, courseId])`

Indexes:

- `@@index([studentId])`
- `@@index([courseId])`

---

### `ChatThread`

AI Tutor conversation thread.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Thread UUID |
| `studentId` | `String` | FK to `User` |
| `courseId` | `String` | FK to `Course` |
| `title` | `String?` | Optional thread label |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `messages`

Index:

- `@@index([studentId, courseId])`

---

### `ChatMessage`

Stored chat message.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Message UUID |
| `threadId` | `String` | FK to `ChatThread` |
| `role` | `String` | `user` or `model` |
| `content` | `String` | Message text |
| `createdAt` | `DateTime @default(now())` | Created timestamp |

Index:

- `@@index([threadId])`

---

### `LessonProgress`

Tracks per-student lesson completion.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Progress UUID |
| `studentId` | `String` | FK to `User` |
| `lessonId` | `String` | FK to `Lesson` |
| `isCompleted` | `Boolean @default(false)` | Completion flag |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Constraints:

- `@@unique([studentId, lessonId])`

Indexes:

- `@@index([studentId])`
- `@@index([lessonId])`

---

### `Bookmark`

Saved lesson record.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Bookmark UUID |
| `userId` | `String` | FK to `User` |
| `lessonId` | `String` | FK to `Lesson` |
| `createdAt` | `DateTime @default(now())` | Save timestamp |

Constraints:

- `@@unique([userId, lessonId])`

Indexes:

- `@@index([userId])`
- `@@index([lessonId])`

---

### `Quiz`

Quiz attached one-to-one to a lesson.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Quiz UUID |
| `lessonId` | `String @unique` | FK to `Lesson` |
| `dueDate` | `DateTime?` | Optional deadline |
| `maxAttempts` | `Int @default(1)` | Attempt limit |
| `passingScore` | `Float @default(0.5)` | Ratio threshold |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `questions`
- `attempts`

---

### `QuizQuestion`

Quiz question.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Question UUID |
| `quizId` | `String` | FK to `Quiz` |
| `questionText` | `String` | Prompt |
| `explanation` | `String?` | Teacher/AI explanation |
| `orderIndex` | `Int @default(0)` | Sort order |
| `points` | `Int @default(1)` | Question points |
| `createdAt` | `DateTime @default(now())` | Created timestamp |
| `updatedAt` | `DateTime @updatedAt` | Updated timestamp |

Relations:

- `options`
- `answers`

Index:

- `@@index([quizId])`

---

### `QuizOption`

Multiple-choice option.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Option UUID |
| `questionId` | `String` | FK to `QuizQuestion` |
| `optionText` | `String` | Option label |
| `isCorrect` | `Boolean @default(false)` | Correct answer flag |
| `orderIndex` | `Int @default(0)` | Sort order |

Relations:

- `answers`

Index:

- `@@index([questionId])`

---

### `QuizAttempt`

Student quiz submission.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Attempt UUID |
| `quizId` | `String` | FK to `Quiz` |
| `studentId` | `String` | FK to `User` |
| `score` | `Float?` | Earned points |
| `totalPoints` | `Int?` | Total quiz points |
| `startedAt` | `DateTime @default(now())` | Started timestamp |
| `submittedAt` | `DateTime?` | Submitted timestamp |

Relations:

- `answers`

Indexes:

- `@@index([quizId])`
- `@@index([studentId])`

---

### `QuizAnswer`

Selected answer for a question in an attempt.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(uuid())` | Answer UUID |
| `attemptId` | `String` | FK to `QuizAttempt` |
| `questionId` | `String` | FK to `QuizQuestion` |
| `optionId` | `String` | FK to `QuizOption` |

Index:

- `@@index([attemptId])`

---

## Production Notes

1. **UUIDs are used for public-facing records.**
2. **UploadThing is the durable material store.** `Material.fileUrl` stores cloud URLs.
3. **Gemini File API references are cache-like.** `geminiFileUri` and `geminiFileName` can be regenerated from `fileUrl`.
4. **Course progress is derived.** `LessonProgress` is the source of truth; percentages are calculated in `lib/services/progress.service.ts`.
5. **Private courses are closed enrollment.** Students cannot self-enroll or self-unenroll when `Course.isPrivate` is true.
6. **Quiz update safety.** Existing attempts should block destructive question/option edits in service logic.
7. **Production data migration.** `client/prisma/extract.ts` exports `{ users, courses }`; `client/prisma/seed.ts` restores nested data.
