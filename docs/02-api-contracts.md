# API Contracts — LearnAI LMS

> **Version:** 9.0
> **Last Updated:** 2026-06-19
> **Base URL:** `/api`
> **Auth:** Custom JWT via HTTP-only cookie and/or `Authorization: Bearer <token>`

---

## Common Conventions

### Response Envelope

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

### Error Envelope

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "Email is required."
    }
  ]
}
```

### Common Status Codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created |
| `204` | No content |
| `400` | Validation or bad request |
| `401` | Missing/invalid auth |
| `403` | Authenticated but not allowed |
| `404` | Not found or intentionally hidden |
| `422` | Domain precondition not met |
| `500` | Unexpected server error |

### Pagination

List endpoints generally use:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | number | `1` | 1-based |
| `limit` | number | `20` | max usually `100` |
| `search` | string | optional | title/text search where supported |

---

## Auth

### `POST /api/auth/register`

Access: Public

```json
{
  "email": "student@example.com",
  "password": "securePassword123",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT"
}
```

### `POST /api/auth/login`

Access: Public

```json
{
  "email": "student@example.com",
  "password": "securePassword123"
}
```

Response includes user data and sets auth token delivery used by the app.

### `GET /api/auth/me`

Access: Authenticated

Returns the current authenticated user.

---

## Users & Profiles

### `GET /api/users`

Access: ADMIN

Lists users with pagination.

### `GET /api/users/search?q=query`

Access: TEACHER, ADMIN

Lightweight autocomplete search for active students by email or full name.

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "user-id",
      "fullName": "Nguyễn Văn A",
      "email": "student@example.com",
      "avatarUrl": null
    }
  ]
}
```

### `GET /api/users/[userId]`

Access: ADMIN or self

Returns private user detail.

### `PATCH /api/users/[userId]`

Access: ADMIN or self, with self-only password change behavior.

Profile update fields:

```json
{
  "fullName": "Nguyễn Văn A",
  "avatarUrl": "https://example.com/avatar.jpg",
  "phoneNumber": "0900000000",
  "gender": "Nam",
  "birthYear": 2000,
  "highestEducation": "Cử nhân",
  "bio": "Giới thiệu ngắn..."
}
```

Password change fields:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### `PATCH /api/users/[userId]/status`

Access: ADMIN

Toggles `isActive`.

### `DELETE /api/users/[userId]`

Access: ADMIN

Soft-disables user account.

### `GET /api/users/[userId]/public`

Access: Authenticated

Returns public-safe profile fields plus completed courses. Excludes sensitive fields such as password, email, and phone number.

---

## Courses

### `GET /api/courses`

Access:

- Public/Student: published courses.
- Teacher: own courses.
- Admin: all courses.

Query:

- `page`
- `limit`
- `search`

### `POST /api/courses`

Access: TEACHER, ADMIN

```json
{
  "title": "Tín hiệu và hệ thống",
  "description": "Mô tả khóa học",
  "thumbnailUrl": "https://example.com/cover.jpg",
  "isPublished": false
}
```

### `GET /api/courses/[courseId]`

Access:

- Public if published.
- Enrolled student.
- Owner teacher.
- Admin.

Returns course detail with teacher, ordered modules, ordered lessons, materials summary, and counts.

### `PATCH /api/courses/[courseId]`

Access: Owner teacher, ADMIN

```json
{
  "title": "Tên mới",
  "description": "Mô tả mới",
  "thumbnailUrl": "https://example.com/cover.jpg",
  "isPublished": true,
  "isPrivate": false,
  "aiEnabled": true
}
```

### `DELETE /api/courses/[courseId]`

Access: Owner teacher, ADMIN

Deletes the course and nested records through Prisma cascade.

### `GET /api/courses/[courseId]/learn`

Access: Enrolled student, owner teacher, ADMIN

Combined learning payload:

```json
{
  "success": true,
  "data": {
    "course": {},
    "completedLessonIds": ["lesson-id"]
  }
}
```

### `GET /api/courses/[courseId]/students`

Access: Owner teacher, ADMIN

Returns enrolled students with `progressPercentage`.

### `POST /api/courses/[courseId]/enroll`

Access: STUDENT

Enrolls the current student in a published, non-private course.

Private-course behavior:

- If `Course.isPrivate` is true, self-enrollment is rejected.

### `DELETE /api/courses/[courseId]/enroll`

Access: STUDENT

Drops the current student's enrollment unless the course is private.

Private-course behavior:

- If `Course.isPrivate` is true, self-unenrollment is rejected.

### `POST /api/courses/[courseId]/enroll-bulk`

Access: Owner teacher, ADMIN

Adds students by email. Accepts either a raw string or an array.

```json
{
  "emails": [
    "student1@example.com",
    "student2@example.com"
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "addedCount": 2,
    "matchedCount": 2,
    "skippedCount": 0
  }
}
```

### `DELETE /api/courses/[courseId]/enroll-bulk`

Access: Owner teacher, ADMIN

Removes selected students from a course.

```json
{
  "userIds": ["student-user-id-1", "student-user-id-2"]
}
```

### `POST /api/courses/[courseId]/setup-ai`

Access: Owner teacher, ADMIN

Uploads eligible course materials to Gemini File API, waits for ACTIVE state, stores `geminiFileUri` and `geminiFileName`, then sets `aiEnabled = true`.

Response:

```json
{
  "success": true,
  "data": {
    "uploadedCount": 3,
    "aiEnabled": true
  }
}
```

### `GET /api/courses/[courseId]/materials`

Access: Owner teacher, ADMIN

Returns all course materials with lesson and module location.

### `POST /api/courses/[courseId]/materials/[materialId]/resync`

Access: Owner teacher, ADMIN

Downloads the durable UploadThing file URL, re-uploads it to Gemini, and updates `geminiFileUri`/`geminiFileName`.

### `GET /api/courses/[courseId]/bookmarks`

Access: Authenticated student

Returns the current user's saved lessons in this course with lesson and module data.

---

## Modules

### `GET /api/courses/[courseId]/modules`

Access: Enrolled student, owner teacher, ADMIN

Lists ordered modules.

### `POST /api/courses/[courseId]/modules`

Access: Owner teacher, ADMIN

```json
{
  "title": "Chương 1",
  "description": "Tổng quan"
}
```

`orderIndex` is calculated server-side.

### `PUT /api/courses/[courseId]/modules`

Access: Owner teacher, ADMIN

Reorders modules.

```json
{
  "orderedIds": ["module-id-1", "module-id-2"]
}
```

### `PATCH /api/courses/[courseId]/modules/[moduleId]`

Access: Owner teacher, ADMIN

Updates module metadata.

### `DELETE /api/courses/[courseId]/modules/[moduleId]`

Access: Owner teacher, ADMIN

Deletes a module and nested lessons through cascade.

---

## Lessons

### `GET /api/modules/[moduleId]/lessons`

Access: Enrolled student, owner teacher, ADMIN

Lists lessons in a module.

### `POST /api/modules/[moduleId]/lessons`

Access: Owner teacher, ADMIN

```json
{
  "title": "Biến đổi Z",
  "content": "Markdown content",
  "lessonType": "LECTURE"
}
```

`lessonType` may be `LECTURE` or `QUIZ`.

### `GET /api/lessons/[lessonId]`

Access: Enrolled student, owner teacher, ADMIN

Returns lesson detail with materials and parent course/module context.

### `PATCH /api/lessons/[lessonId]`

Access: Owner teacher, ADMIN

Updates lesson title, content, type, publication-related fields, or order metadata supported by validation.

### `DELETE /api/lessons/[lessonId]`

Access: Owner teacher, ADMIN

Deletes lesson and nested materials/progress/bookmarks/quiz.

### `GET /api/lessons/[lessonId]/progress`

Access: STUDENT

Returns current student's progress for the lesson.

### `POST /api/lessons/[lessonId]/progress`

Access: STUDENT

Upserts lesson completion state.

```json
{
  "isCompleted": true
}
```

### `POST /api/lessons/[lessonId]/bookmark`

Access: Authenticated student

Toggles bookmark for the current user.

Response:

```json
{
  "success": true,
  "data": {
    "bookmarked": true
  }
}
```

---

## Materials

### `POST /api/lessons/[lessonId]/materials/upload`

Access: Owner teacher, ADMIN

Creates a material record from an UploadThing upload callback payload.

```json
{
  "name": "lecture.pdf",
  "url": "https://utfs.io/f/file-key.pdf",
  "size": 2048000,
  "type": "application/pdf"
}
```

### `GET /api/lessons/[lessonId]/materials`

Access: Enrolled student, owner teacher, ADMIN

Lists materials for a lesson.

### `GET /api/materials/[materialId]/download`

Access: Enrolled student, owner teacher, ADMIN

Redirects or streams the durable material URL.

### `DELETE /api/materials/[materialId]`

Access: Owner teacher, ADMIN

Deletes the material database row and deletes the UploadThing file by key.

---

## UploadThing

### `GET /api/uploadthing`

UploadThing App Router handler.

### `POST /api/uploadthing`

UploadThing App Router handler.

Current file router supports course material uploads for PDFs, videos, and images.

---

## AI Tutor Chat

### `GET /api/courses/[courseId]/chat/threads`

Access: Enrolled student

Lists the current student's AI Tutor threads for a course.

Returns `200` with readiness info when AI is disabled instead of surfacing noisy forbidden errors.

### `POST /api/courses/[courseId]/chat/threads`

Access: Enrolled student

Creates a local chat thread.

### `GET /api/chat/threads/[threadId]/messages`

Access: Thread owner

Returns ordered chat messages.

### `POST /api/chat/threads/[threadId]/ask`

Access: Thread owner, enrolled student

```json
{
  "message": "Giải thích nội dung bài học này giúp em."
}
```

Backend flow:

1. Save user message.
2. Load course Gemini file refs.
3. Load chat history.
4. Call `gemini-3.1-flash-lite`.
5. Save model response.
6. Return assistant message.

### `DELETE /api/chat/threads/[threadId]`

Access: Thread owner

Deletes thread and messages.

---

## Quiz

### `GET /api/lessons/[lessonId]/quiz`

Access: Enrolled student, owner teacher, ADMIN

Returns quiz data. For students, correct option flags are omitted.

If no quiz exists, returns:

```json
{
  "success": true,
  "data": null
}
```

### `POST /api/lessons/[lessonId]/quiz`

Access: Owner teacher, ADMIN

Creates a quiz.

```json
{
  "maxAttempts": 2,
  "passingScore": 0.6,
  "dueDate": "2026-06-30T23:59:00.000Z",
  "questions": [
    {
      "questionText": "Câu hỏi?",
      "points": 1,
      "explanation": "Giải thích",
      "options": [
        { "optionText": "A", "isCorrect": true },
        { "optionText": "B", "isCorrect": false }
      ]
    }
  ]
}
```

Validation requires:

- At least one question.
- At least two options per question.
- Exactly one correct option per question.

### `PATCH /api/lessons/[lessonId]/quiz`

Access: Owner teacher, ADMIN

Updates quiz settings/questions/options if no attempts exist. Existing attempts block destructive question/option edits.

### `DELETE /api/lessons/[lessonId]/quiz`

Access: Owner teacher, ADMIN

Deletes the quiz and nested records.

### `POST /api/lessons/[lessonId]/quiz/submit`

Access: Enrolled student

```json
{
  "answers": [
    {
      "questionId": "question-id",
      "optionId": "option-id"
    }
  ]
}
```

Calculates score and creates `QuizAttempt` plus `QuizAnswer` records.

### `GET /api/lessons/[lessonId]/quiz/attempts`

Access:

- STUDENT: own attempts only.
- TEACHER/ADMIN: all submissions with student data.

### `GET /api/lessons/[lessonId]/quiz/analytics`

Access: Owner teacher, ADMIN

Returns top difficult questions with error rate and answer options.

### `POST /api/lessons/[lessonId]/quiz/generate`

Access: Owner teacher, ADMIN

Uses Gemini to generate draft quiz questions from lesson markdown and/or attached Gemini-synced files.

```json
{
  "numberOfQuestions": 5
}
```

Returns generated question JSON only; it does not save the quiz.

### `POST /api/quiz/explain`

Access: Authenticated

Generates a short AI explanation for a quiz review question.

```json
{
  "questionText": "Question text",
  "options": ["A", "B"],
  "correctOption": "A",
  "studentOption": "B"
}
```

### `POST /api/lessons/[lessonId]/quiz/ai-advice`

Access: Owner teacher, ADMIN

Generates pedagogical advice from top difficult questions.

```json
{
  "topQuestions": [
    {
      "questionText": "Question text",
      "errorRatePercentage": 80
    }
  ]
}
```

---

## Course Analytics

### `GET /api/courses/[courseId]/analytics/quizzes`

Access: Owner teacher, ADMIN

Returns quiz-level statistics:

```json
[
  {
    "lessonId": "lesson-id",
    "quizId": "quiz-id",
    "quizTitle": "Lesson title",
    "totalSubmissions": 12,
    "averageScore": 75
  }
]
```

---

## Enrollments

### `GET /api/enrollments/my`

Access: STUDENT

Returns current student's enrollments with course summaries, progress, next lesson, teacher, and counts.

---

## Production Data Scripts

These are package/Prisma scripts, not HTTP APIs.

### `npm run db:extract`

Runs `client/prisma/extract.ts` and writes local data to:

```text
client/prisma/data.json
```

### `npx prisma db seed`

Runs `client/prisma/seed.ts` and upserts/restores users plus nested course data from `prisma/data.json`.

---

## Endpoint Inventory

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/me` | Auth | Current user |
| GET | `/api/users` | ADMIN | List users |
| GET | `/api/users/search` | TEACHER/ADMIN | Student autocomplete |
| GET | `/api/users/[userId]` | ADMIN/self | User detail |
| PATCH | `/api/users/[userId]` | ADMIN/self | Profile/password update |
| DELETE | `/api/users/[userId]` | ADMIN | Disable user |
| PATCH | `/api/users/[userId]/status` | ADMIN | Toggle active state |
| GET | `/api/users/[userId]/public` | Auth | Public profile |
| GET | `/api/courses` | Public/Auth | List courses |
| POST | `/api/courses` | TEACHER/ADMIN | Create course |
| GET | `/api/courses/[courseId]` | Public/Auth | Course detail |
| PATCH | `/api/courses/[courseId]` | Owner/ADMIN | Update course |
| DELETE | `/api/courses/[courseId]` | Owner/ADMIN | Delete course |
| GET | `/api/courses/[courseId]/learn` | Enrolled/Owner/ADMIN | Course learning payload |
| GET | `/api/courses/[courseId]/students` | Owner/ADMIN | Student roster |
| POST | `/api/courses/[courseId]/enroll` | STUDENT | Self-enroll |
| DELETE | `/api/courses/[courseId]/enroll` | STUDENT | Self-unenroll |
| POST | `/api/courses/[courseId]/enroll-bulk` | Owner/ADMIN | Add students |
| DELETE | `/api/courses/[courseId]/enroll-bulk` | Owner/ADMIN | Remove students |
| POST | `/api/courses/[courseId]/setup-ai` | Owner/ADMIN | Sync AI Tutor materials |
| GET | `/api/courses/[courseId]/materials` | Owner/ADMIN | Course materials dashboard |
| POST | `/api/courses/[courseId]/materials/[materialId]/resync` | Owner/ADMIN | Re-sync Gemini file |
| GET | `/api/courses/[courseId]/bookmarks` | STUDENT | Course bookmarks |
| GET | `/api/courses/[courseId]/modules` | Enrolled/Owner/ADMIN | List modules |
| POST | `/api/courses/[courseId]/modules` | Owner/ADMIN | Create module |
| PUT | `/api/courses/[courseId]/modules` | Owner/ADMIN | Reorder modules |
| PATCH | `/api/courses/[courseId]/modules/[moduleId]` | Owner/ADMIN | Update module |
| DELETE | `/api/courses/[courseId]/modules/[moduleId]` | Owner/ADMIN | Delete module |
| GET | `/api/modules/[moduleId]/lessons` | Enrolled/Owner/ADMIN | List lessons |
| POST | `/api/modules/[moduleId]/lessons` | Owner/ADMIN | Create lesson |
| GET | `/api/lessons/[lessonId]` | Enrolled/Owner/ADMIN | Lesson detail |
| PATCH | `/api/lessons/[lessonId]` | Owner/ADMIN | Update lesson |
| DELETE | `/api/lessons/[lessonId]` | Owner/ADMIN | Delete lesson |
| GET | `/api/lessons/[lessonId]/progress` | STUDENT | Lesson progress |
| POST | `/api/lessons/[lessonId]/progress` | STUDENT | Update progress |
| POST | `/api/lessons/[lessonId]/bookmark` | STUDENT | Toggle bookmark |
| POST | `/api/lessons/[lessonId]/materials/upload` | Owner/ADMIN | Save uploaded material |
| GET | `/api/lessons/[lessonId]/materials` | Enrolled/Owner/ADMIN | List lesson materials |
| GET | `/api/materials/[materialId]/download` | Enrolled/Owner/ADMIN | Download material |
| DELETE | `/api/materials/[materialId]` | Owner/ADMIN | Delete material |
| GET | `/api/courses/[courseId]/chat/threads` | STUDENT | List chat threads |
| POST | `/api/courses/[courseId]/chat/threads` | STUDENT | Create chat thread |
| GET | `/api/chat/threads/[threadId]/messages` | Owner | Chat messages |
| POST | `/api/chat/threads/[threadId]/ask` | Owner | Ask AI Tutor |
| DELETE | `/api/chat/threads/[threadId]` | Owner | Delete chat thread |
| GET | `/api/lessons/[lessonId]/quiz` | Enrolled/Owner/ADMIN | Quiz detail |
| POST | `/api/lessons/[lessonId]/quiz` | Owner/ADMIN | Create quiz |
| PATCH | `/api/lessons/[lessonId]/quiz` | Owner/ADMIN | Update quiz |
| DELETE | `/api/lessons/[lessonId]/quiz` | Owner/ADMIN | Delete quiz |
| POST | `/api/lessons/[lessonId]/quiz/submit` | STUDENT | Submit quiz |
| GET | `/api/lessons/[lessonId]/quiz/attempts` | STUDENT/Owner/ADMIN | Attempts/submissions |
| GET | `/api/lessons/[lessonId]/quiz/analytics` | Owner/ADMIN | Question analytics |
| POST | `/api/lessons/[lessonId]/quiz/generate` | Owner/ADMIN | AI quiz generation |
| POST | `/api/quiz/explain` | Auth | AI answer explanation |
| POST | `/api/lessons/[lessonId]/quiz/ai-advice` | Owner/ADMIN | AI teaching advice |
| GET | `/api/courses/[courseId]/analytics/quizzes` | Owner/ADMIN | Course quiz analytics |
| GET | `/api/enrollments/my` | STUDENT | My enrollments |
| GET | `/api/uploadthing` | UploadThing | UploadThing handler |
| POST | `/api/uploadthing` | UploadThing | UploadThing handler |
