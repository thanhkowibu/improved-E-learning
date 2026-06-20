# PROJECT_STATE.md — LearnAI LMS

> **Last Updated:** 2026-06-19
> **Status:** Production-ready / deployment-ready
> **Purpose:** Current project snapshot for onboarding, handoff, or resuming work after a break.

---

## Current Summary

LearnAI is now a full-featured Next.js 15 App Router LMS with:

- Custom JWT authentication and role-based dashboards.
- Course catalog, course management, curriculum builder, lesson viewer, materials dashboard, and progress tracking.
- UploadThing cloud file storage with inline PDF/video preview.
- Google Gemini AI Tutor grounded in uploaded course materials.
- AI-powered quiz generation, quiz taking, quiz review, AI explanations, and teacher analytics.
- Vietnamese-first UI across new production-facing features.
- Production data export/seed scripts for migrating local mock data to Vercel/Postgres.

The app is ready for production deployment once environment variables, database migration, UploadThing, and Gemini credentials are configured.

---

## What Changed Since 2026-06-04

The previous snapshot stopped at “Phase 4 not started.” Since then, the app gained:

1. **Gemini AI backend**
   - `@google/genai` service layer.
   - Gemini File API upload/get/delete/list/polling.
   - Course AI setup route.
   - Grounded AI Tutor chat with course file context and chat history.

2. **AI Tutor frontend**
   - Chat widget, full-page chat, lesson sheet integration.
   - Thread sidebar, delete threads, responsive mobile dropdown history.
   - Markdown/math rendering, skeleton loading states, safety/error alerts.

3. **Cloud storage**
   - UploadThing backend and frontend upload flow.
   - Material delete from cloud.
   - Centralized materials dashboard.
   - Gemini re-sync flow for expired File API references.

4. **Quiz engine**
   - Prisma quiz schema and CRUD APIs.
   - Teacher quiz builder with DnD questions and option reordering.
   - Student quiz taking UI.
   - Quiz results and AI explanations.
   - AI quiz generation from lesson content and Gemini files.

5. **Analytics**
   - Teacher quiz analytics tab.
   - Quiz detail scoreboard.
   - Difficult-question analysis.
   - Gemini-powered pedagogical advice.
   - Sortable analytics tables.

6. **User/profile system**
   - Settings page with profile and password management.
   - Public profile pages.
   - Completed-course certificate cards.
   - Profile links from course cards and student tables.

7. **Course learning polish**
   - Shared progress service.
   - Consolidated learn API to avoid network waterfall.
   - Lesson bookmarks and saved-lessons dialog.
   - Shared course search bar.
   - Responsive pass for mobile layouts.

8. **Private course / closed enrollment**
   - `Course.isPrivate`.
   - Student self-enroll/self-unenroll lock.
   - Teacher bulk-add students by email.
   - Async student email autocomplete.
   - Bulk remove students with checkbox selection.

9. **Production migration tooling**
   - `prisma/extract.ts` exports local data to `prisma/data.json`.
   - `prisma/seed.ts` restores users and nested course hierarchy.
   - `npm run db:extract` and Prisma seed config are available.

---

## Phase Progress

| Phase | Name | Status | Notes |
| --- | --- | --- | --- |
| 0 | Project Foundation & DevOps | Complete | Next.js 15, Prisma, Docker, layouts, API helpers |
| 1 | Database Schema & Auth | Complete | JWT auth, role guards, user/profile extensions |
| 2 | Core LMS APIs | Complete | Courses, modules, lessons, materials, enrollments, users |
| 3 | Frontend LMS UI | Complete | Dashboards, catalog, editor, learner views |
| 4 | Gemini AI Integration | Complete | Gemini service, File API, setup AI, chat logic/endpoints |
| 5 | AI Tutor Chat UI | Complete | Chat widget, full-page chat, lesson sheet, responsive history |
| 6 | UploadThing + Inline Viewers | Complete | Cloud upload, material previews, cloud delete |
| 7 | Quiz Engine + AI Quiz | Complete | CRUD, builder, student taking, review, AI generation/explanations |
| 8 | Polish, Analytics, Production UX | Complete | Responsive pass, profiles, bookmarks, private courses |
| 9 | Production Migration | Complete | JSON export and Prisma seed scripts |

---

## Database Models (15)

All models are defined in `client/prisma/schema.prisma`.

| # | Model | Table | Purpose |
| --- | --- | --- | --- |
| 1 | `User` | `users` | Platform accounts, roles, profile fields, auth state |
| 2 | `Course` | `courses` | Teacher-owned courses, AI/private/published flags |
| 3 | `Module` | `modules` | Ordered course sections |
| 4 | `Lesson` | `lessons` | Ordered learning units, lecture/quiz type |
| 5 | `Material` | `materials` | UploadThing file URL, type, size, Gemini file references |
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

## Implemented API Areas

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Users & Profiles

- `GET /api/users`
- `GET /api/users/search`
- `GET /api/users/[userId]`
- `PATCH /api/users/[userId]`
- `DELETE /api/users/[userId]`
- `PATCH /api/users/[userId]/status`
- `GET /api/users/[userId]/public`

### Courses

- `GET /api/courses`
- `POST /api/courses`
- `GET /api/courses/[courseId]`
- `PATCH /api/courses/[courseId]`
- `DELETE /api/courses/[courseId]`
- `GET /api/courses/[courseId]/learn`
- `GET /api/courses/[courseId]/students`
- `POST /api/courses/[courseId]/enroll`
- `DELETE /api/courses/[courseId]/enroll`
- `POST /api/courses/[courseId]/enroll-bulk`
- `DELETE /api/courses/[courseId]/enroll-bulk`
- `POST /api/courses/[courseId]/setup-ai`
- `GET /api/courses/[courseId]/materials`
- `POST /api/courses/[courseId]/materials/[materialId]/resync`
- `GET /api/courses/[courseId]/bookmarks`

### Modules & Lessons

- Course module CRUD and reorder APIs.
- Module lesson CRUD APIs.
- Lesson detail/update/delete APIs.
- Lesson progress APIs.
- Lesson bookmark toggle API.

### Materials

- `POST /api/lessons/[lessonId]/materials/upload`
- `GET /api/lessons/[lessonId]/materials`
- `GET /api/materials/[materialId]/download`
- `DELETE /api/materials/[materialId]`

### AI Tutor Chat

- Thread create/list/delete.
- Message history.
- Ask endpoint with Gemini grounded response generation.
- AI readiness handling.

### Quiz

- Lesson quiz GET/POST/PATCH/DELETE.
- Quiz submit.
- Quiz attempts.
- Quiz question analytics.
- AI quiz generation.
- AI quiz answer explanation.
- AI pedagogical advice.

### UploadThing

- App Router UploadThing route handler.
- Course material uploader endpoint.

---

## Implemented Pages

| Route | Description |
| --- | --- |
| `/login` | Login page |
| `/register` | Registration page |
| `/dashboard` | Role-based dashboard |
| `/courses` | Course catalog with shared search |
| `/courses/new` | Teacher/admin course creation |
| `/courses/[courseId]` | Course detail, teacher analytics/students tabs, enroll CTA |
| `/courses/[courseId]/edit` | Course settings, curriculum, materials dashboard, AI settings |
| `/courses/[courseId]/learn` | Student learning hub with progress, bookmarks, AI Tutor |
| `/courses/[courseId]/lessons/[lessonId]` | Lesson viewer, materials, AI Tutor, quiz UI |
| `/courses/[courseId]/chat` | Standalone AI Tutor chat |
| `/courses/[courseId]/analytics/quizzes/[lessonId]` | Quiz analytics detail and AI teaching advice |
| `/my-courses` | Student enrolled courses / teacher owned courses |
| `/settings` | Profile and password settings |
| `/profile/[userId]` | Public user profile and completed courses |
| `/admin/users` | Admin user management |
| `/admin/analytics` | Admin analytics |

---

## Key Dependencies

```json
{
  "next": "15.5.18",
  "react": "19.1.0",
  "prisma": "^6.19.3",
  "@prisma/client": "^6.19.3",
  "@google/genai": "^2.8.0",
  "uploadthing": "^7.7.4",
  "@uploadthing/react": "^7.3.3",
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "remark-math": "^6.0.0",
  "rehype-katex": "^7.0.1",
  "react-hook-form": "^7.76.1",
  "zod": "^4.4.3",
  "sonner": "^2.0.7",
  "lucide-react": "^1.17.0",
  "ts-node": "^10.9.2"
}
```

---

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `NEXT_PUBLIC_APP_URL` | Public app URL |
| `GEMINI_API_KEY` | Google Gemini API key |
| `UPLOADTHING_TOKEN` / UploadThing envs | UploadThing cloud storage |

Deployment targets should configure these in Vercel project settings.

---

## AI Configuration

| Setting | Value |
| --- | --- |
| SDK | `@google/genai` |
| Default model | `gemini-3.1-flash-lite` |
| Service layer | `client/lib/gemini/` |
| File grounding | Gemini File API refs stored on `Material.geminiFileUri` and `geminiFileName` |
| Chat strategy | Stateless per ask: system prompt + file refs + full thread history |
| Quiz generation | Structured JSON response schema + Zod validation before UI review |

---

## Production Migration Workflow

Local mock data can be exported and seeded into production:

```bash
cd client
npm run db:extract
npx prisma db seed
```

Files:

- `client/prisma/extract.ts`
- `client/prisma/seed.ts`
- `client/prisma/data.json`

The seed script upserts users, recreates nested course hierarchies, and then restores quiz attempts/answers.

---

## Deployment Readiness Checklist

- Prisma schema is current.
- Run `npx prisma db push` or production migration flow against the production database.
- Run `npx prisma generate` after schema changes.
- Configure Vercel environment variables.
- Configure UploadThing token/environment.
- Configure Gemini API key.
- Seed production data if needed.
- Run `npm run build` before final release validation.

---

## Architecture Decisions Log

The ADR log is in `docs/04-architecture-decisions.md`.

Current ADR range: **ADR-001 through ADR-018**.

Recent decisions include:

- Gemini AI service and File API integration.
- UploadThing cloud storage migration.
- Centralized materials dashboard and Gemini re-sync.
- User settings and public profile.
- Lesson bookmarks.
- Private course enrollment control.

---

## Recommended Next Steps

1. Run a final production build.
2. Verify Vercel environment variables.
3. Run database push/migration on production.
4. Seed production data from `prisma/data.json` if desired.
5. Smoke test: register/login, course browsing, private enrollment, material upload, AI setup, AI chat, quiz generation, quiz taking, analytics.
