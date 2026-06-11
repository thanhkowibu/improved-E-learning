# Implementation Plan — E-Learning LMS

> **Version:** 3.1  
> **Last Updated:** 2026-06-04  
> **Strategy:** Core LMS first → AI integration later  
> **Stack:** Next.js 15 App Router (fullstack) · Prisma ORM · PostgreSQL · Google Gemini API (`@google/genai`) · TypeScript · Tailwind CSS & Shadcn UI

---

## Architecture Decision Record: Fullstack Pivot — FastAPI → Next.js

> **Decision:** Drop the separate Python/FastAPI backend entirely. The application is now a **100% Next.js fullstack monolith** using App Router Route Handlers (and Server Actions where appropriate) for the API layer, with **Prisma ORM** as the data access layer.
>
> **Rationale:**
>
> - **Single language & runtime:** TypeScript end-to-end eliminates context-switching between Python and TypeScript, and allows sharing types, validation schemas (Zod), and utilities across frontend and backend.
> - **Simplified deployment:** One deployable unit (Next.js) instead of orchestrating two separate services. Ideal for Vercel deployment or a single Docker container.
> - **Prisma advantages:** Type-safe database client auto-generated from the schema, built-in migrations (`prisma migrate`), and excellent DX with auto-completion.
> - **Next.js App Router capabilities:** Route Handlers (`app/api/.../route.ts`) provide a robust API layer. Server Components and Server Actions enable direct server-side data fetching and mutations without an API round-trip where appropriate.
>
> **Key Architectural Changes (vs. v2.0 plan):**
>
> - ~~`api-service/` directory (FastAPI)~~ → All backend logic lives inside `app/api/` route handlers and `lib/` service modules.
> - ~~SQLAlchemy models + Alembic migrations~~ → `prisma/schema.prisma` + `npx prisma migrate dev`.
> - ~~Pydantic schemas~~ → **Zod** validation schemas (shared between API routes and frontend forms).
> - ~~`python-jose` + `passlib`~~ → **`jose`** (JWT) + **`bcryptjs`** (password hashing) in TypeScript.
> - ~~`google-generativeai` Python SDK~~ → **`@google/genai`** Node.js SDK.
> - ~~Separate CORS configuration~~ → Not needed; frontend and API share the same origin.

---

## Architecture Decision Record: OpenAI → Gemini Migration

> **Decision:** Replace the OpenAI Assistants API with Google Gemini API.  
> **Rationale:**
>
> - Gemini models offer **large context windows** — large enough to pass full course PDFs directly as context without vector stores or embeddings.
> - Gemini provides a **generous free tier** (15 RPM / 1M TPM on Flash) — ideal for an educational project.
> - **Simpler architecture:** No vector stores, no assistants, no polling for run completion. Just upload files via the File API and pass them into a chat session.
>
> **Key Architectural Changes:**
>
> - `courses` table: Remove `assistant_id` and `vector_store_id`.
> - `materials` table: Replace `openai_file_id` with `gemini_file_uri` (the URI returned by `genai.uploadFile`).
> - `chat_threads` table: Remove `openai_thread_id` — conversation history is managed locally in `chat_messages` and rebuilt per request.
> - `chat_messages` table: Remove `openai_message_id` — no external message IDs needed.
> - Backend: Use `@google/genai` Node.js SDK exclusively.

---

## Phase 0: Project Foundation & DevOps

> Set up the development environment, tooling, and project configuration so all subsequent phases can proceed smoothly.

- [x] **[Next.js]** Initialize Next.js 15 project with App Router, TypeScript, Tailwind CSS, and ESLint (`npx create-next-app@latest`)
- [x] **[Next.js]** Install and configure **Shadcn UI** (`npx shadcn@latest init`) — set up `components.json`, base theme, and CSS variables
- [x] **[Next.js]** Configure environment variables (`.env.local` for `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`)
- [x] **[Prisma]** Initialize Prisma (`npx prisma init`) — creates `prisma/schema.prisma` and `.env` with `DATABASE_URL`
- [x] **[Prisma]** Configure `schema.prisma` datasource for PostgreSQL and generator for Prisma Client
- [x] **[Next.js]** Create shared layout structure (`app/layout.tsx`, `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`)
- [x] **[Next.js]** Create a global API response helper (`lib/api-response.ts`) that returns consistent JSON: `{ success, data, message, errors? }`
- [x] **[Next.js]** Create a global error handler wrapper for Route Handlers (`lib/api-handler.ts` — try-catch wrapper with standardized error responses)
- [x] **[Next.js]** Set up a singleton `PrismaClient` instance (`lib/prisma.ts`) with best practices for Next.js dev hot-reload (global singleton pattern)
- [x] **[Docker]** Create `docker-compose.yml` for PostgreSQL (+ optional pgAdmin)
- [x] **[Next.js]** Verify end-to-end connectivity: create a test Route Handler (`app/api/health/route.ts`) that queries PostgreSQL via Prisma and returns status

---

## Phase 1: Database Schema & Auth System

> Build the data layer and authentication so all subsequent CRUD operations have a foundation.

### 1A — Prisma Schema & Migrations

- [x] **[Prisma]** Define enum types in `schema.prisma`: `UserRole` (`ADMIN`, `TEACHER`, `STUDENT`), `EnrollmentStatus` (`ACTIVE`, `COMPLETED`, `DROPPED`), `MaterialType` (`PDF`, `VIDEO`, `LINK`, `OTHER`)
- [x] **[Prisma]** Create `User` model with all fields from database schema doc (id UUID `@default(uuid())`, email, hashedPassword, fullName, role, avatarUrl, isActive, createdAt, updatedAt)
- [x] **[Prisma]** Create `Course` model with FK to `User` (teacher relation) — includes `aiEnabled` boolean flag (no external AI IDs needed)
- [x] **[Prisma]** Create `Module` model with FK to `Course`, includes `orderIndex`
- [x] **[Prisma]** Create `Lesson` model with FK to `Module`, includes `orderIndex`
- [x] **[Prisma]** Create `Material` model with FK to `Lesson`, includes `geminiFileUri` (nullable `String?`, populated after Gemini File API upload)
- [x] **[Prisma]** Create `Enrollment` model with FKs to `User` and `Course`, with `@@unique([studentId, courseId])` composite constraint
- [x] **[Prisma]** Create `ChatThread` model with FKs to `User` and `Course` — local-only thread tracking (no external thread ID)
- [x] **[Prisma]** Create `ChatMessage` model with FK to `ChatThread` — stores `role` and `content` locally (no external message ID)
- [x] **[Prisma]** Define all relations (`@relation`, `fields`, `references`) with `onDelete: Cascade` where appropriate
- [x] **[Prisma]** Add indexes (`@@index`) matching the database schema doc (email, role, teacher_id, course_id, etc.)
- [x] **[Prisma]** Run initial migration (`npx prisma migrate dev --name init`) and verify all tables are created correctly in PostgreSQL
- [x] **[Prisma]** Generate Prisma Client (`npx prisma generate`) and verify type-safe imports

### 1B — Authentication (JWT)

- [x] **[Next.js API]** Install `bcryptjs` and `jose` dependencies, plus their TypeScript type definitions (`@types/bcryptjs`)
- [x] **[Next.js API]** Create password hashing utilities (`lib/auth/password.ts` — `hashPassword`, `verifyPassword` using `bcryptjs`)
- [x] **[Next.js API]** Create JWT utilities (`lib/auth/jwt.ts` — `signToken`, `verifyToken` using `jose` with HS256 and `JWT_SECRET` from env)
- [x] **[Next.js API]** Create Zod validation schemas for auth (`lib/validations/auth.ts` — `registerSchema`, `loginSchema`)
- [x] **[Next.js API]** Create `getAuthUser` helper (`lib/auth/get-auth-user.ts`) — extracts JWT from `Authorization` header or HTTP-only cookie, verifies, and returns the user from Prisma
- [x] **[Next.js API]** Create role-checking utility (`lib/auth/require-role.ts` — `requireRole(user, [UserRole.ADMIN])` throws 403 if not authorized)
- [x] **[Next.js API]** Implement `POST /api/auth/register` route handler (`app/api/auth/register/route.ts`) — validates with Zod, hashes password with bcryptjs, creates user in Prisma, returns user data (excludes password)
- [x] **[Next.js API]** Implement `POST /api/auth/login` route handler (`app/api/auth/login/route.ts`) — validates credentials, generates JWT with `jose`, returns token + user data
- [x] **[Next.js API]** Implement `GET /api/auth/me` route handler (`app/api/auth/me/route.ts`) — uses `getAuthUser`, returns current user profile
- [x] **[Next.js API]** Write tests for auth (register, login, token validation, role guards) using Vitest or Jest

### 1C — Auth UI

- [x] **[Next.js]** Create auth context/provider (`contexts/AuthContext.tsx`) with JWT storage (HTTP-only cookie preferred, `localStorage` fallback)
- [x] **[Next.js]** Build Login page (`app/(auth)/login/page.tsx`) with form validation using Zod + React Hook Form
- [x] **[Next.js]** Build Register page (`app/(auth)/register/page.tsx`) with role selection (STUDENT/TEACHER)
- [x] **[Next.js]** Implement Next.js middleware (`middleware.ts`) for route protection — redirects unauthenticated users to `/login`
- [x] **[Next.js]** Create reusable `useAuth` hook (`hooks/useAuth.ts`)
- [x] **[Next.js]** Add user avatar/dropdown in navbar with logout functionality

---

## Phase 2: Core LMS APIs (Next.js Route Handlers)

> Build all CRUD API endpoints as Next.js Route Handlers that interact with PrismaClient.

### 2A — User Management

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/user.ts` — `userUpdateSchema`, etc.)
- [x] **[Next.js API]** Create user service module (`lib/services/user.service.ts` — `getUserById`, `getAllUsers`, `updateUser`, `deactivateUser` using PrismaClient)
- [x] **[Next.js API]** Implement `GET /api/users` route handler (`app/api/users/route.ts`) — ADMIN only, paginated
- [x] **[Next.js API]** Implement `GET /api/users/[userId]` route handler (`app/api/users/[userId]/route.ts`) — ADMIN or self
- [x] **[Next.js API]** Implement `PATCH /api/users/[userId]` route handler — ADMIN or self, Zod validated
- [x] **[Next.js API]** Implement `DELETE /api/users/[userId]` route handler — ADMIN only, soft-delete (`isActive = false`)

### 2B — Course CRUD

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/course.ts` — `courseCreateSchema`, `courseUpdateSchema`)
- [x] **[Next.js API]** Create course service module (`lib/services/course.service.ts` — CRUD operations with Prisma `include` for nested relations)
- [x] **[Next.js API]** Implement `POST /api/courses` route handler (`app/api/courses/route.ts`) — TEACHER/ADMIN, creates course with `teacherId` from auth
- [x] **[Next.js API]** Implement `GET /api/courses` route handler — public (published only) / TEACHER (own) / ADMIN (all), paginated, searchable
- [x] **[Next.js API]** Implement `GET /api/courses/[courseId]` route handler (`app/api/courses/[courseId]/route.ts`) — with nested modules/lessons tree using Prisma `include`
- [x] **[Next.js API]** Implement `PATCH /api/courses/[courseId]` route handler — owner/ADMIN, Zod validated
- [x] **[Next.js API]** Implement `DELETE /api/courses/[courseId]` route handler — owner/ADMIN, Prisma cascade delete
- [x] **[Next.js API]** Create ownership validation helper (`lib/auth/check-ownership.ts`) for course operations

### 2C — Module CRUD

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/module.ts`)
- [x] **[Next.js API]** Create module service module (`lib/services/module.service.ts`)
- [x] **[Next.js API]** Implement `POST /api/courses/[courseId]/modules` route handler (`app/api/courses/[courseId]/modules/route.ts`)
- [x] **[Next.js API]** Implement `GET /api/courses/[courseId]/modules` route handler
- [x] **[Next.js API]** Implement `PATCH /api/courses/[courseId]/modules/[moduleId]` route handler (`app/api/courses/[courseId]/modules/[moduleId]/route.ts`)
- [x] **[Next.js API]** Implement `DELETE /api/courses/[courseId]/modules/[moduleId]` route handler
- [x] **[Next.js API]** Handle `orderIndex` reordering logic in module service

### 2D — Lesson CRUD

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/lesson.ts`)
- [x] **[Next.js API]** Create lesson service module (`lib/services/lesson.service.ts`)
- [x] **[Next.js API]** Implement `POST /api/modules/[moduleId]/lessons` route handler (`app/api/modules/[moduleId]/lessons/route.ts`)
- [x] **[Next.js API]** Implement `GET /api/modules/[moduleId]/lessons` route handler
- [x] **[Next.js API]** Implement `GET /api/lessons/[lessonId]` route handler (`app/api/lessons/[lessonId]/route.ts`) — with materials via Prisma `include`
- [x] **[Next.js API]** Implement `PATCH /api/lessons/[lessonId]` route handler
- [x] **[Next.js API]** Implement `DELETE /api/lessons/[lessonId]` route handler

### 2E — Material Upload & Management

- [x] **[Next.js API]** Configure file storage (local `./public/uploads/` directory for dev, S3-compatible for production)
- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/material.ts`)
- [x] **[Next.js API]** Create material service module (`lib/services/material.service.ts`)
- [x] **[Next.js API]** Implement `POST /api/lessons/[lessonId]/materials/upload` route handler (`app/api/lessons/[lessonId]/materials/upload/route.ts`) — parse `FormData` with `request.formData()`, validate file type & size, write to disk with `fs.writeFile`, create Prisma record
- [x] **[Next.js API]** Implement `GET /api/lessons/[lessonId]/materials` route handler
- [x] **[Next.js API]** Implement `GET /api/materials/[materialId]/download` route handler (`app/api/materials/[materialId]/download/route.ts`) — stream file with `ReadableStream` or `NextResponse` with appropriate content headers
- [x] **[Next.js API]** Implement `DELETE /api/materials/[materialId]` route handler — remove file from disk (`fs.unlink`) + delete Prisma record
- [x] **[Next.js API]** Add file size and type validation middleware (max 50MB, allowed extensions: `.pdf`, `.mp4`, `.docx`, etc.)

### 2F — Enrollment

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/enrollment.ts`)
- [x] **[Next.js API]** Create enrollment service module (`lib/services/enrollment.service.ts`)
- [x] **[Next.js API]** Implement `POST /api/courses/[courseId]/enroll` route handler (`app/api/courses/[courseId]/enroll/route.ts`) — STUDENT, creates enrollment with Prisma, handles unique constraint error for duplicate enrollment
- [x] **[Next.js API]** Implement `DELETE /api/courses/[courseId]/enroll` route handler — STUDENT, sets status to `DROPPED`
- [x] **[Next.js API]** Implement `GET /api/enrollments/my` route handler (`app/api/enrollments/my/route.ts`) — student's enrolled courses with Prisma `include` for course + teacher summary
- [x] **[Next.js API]** Implement `GET /api/courses/[courseId]/students` route handler (`app/api/courses/[courseId]/students/route.ts`) — owner/ADMIN
- [x] **[Next.js API]** Create enrollment check helper (`lib/auth/check-enrollment.ts`) for protecting lesson/material/chat access

---

## Phase 3: Frontend LMS UI

> Build the Next.js pages and components that consume the Phase 2 internal API routes (`/api/...`).

### 3A — Shared Components & Layout

- [x] **[Next.js]** Build top Navbar with user profile dropdown
- [x] **[Next.js]** Create reusable UI components using Shadcn UI: `Button`, `Card`, `Dialog` (Modal), `Input`, `Badge`, `Skeleton` (Spinner), `EmptyState`
- [x] **[Next.js]** Create data-fetching hooks with loading/error states (`useCourses`, `useModules`, etc.) using `fetch('/api/...')` to internal API routes
- [x] **[Next.js]** Set up toast notification system using Shadcn UI `Toaster` + `sonner` for success/error feedback

### 3B — Course Pages

- [x] **[Next.js]** Build Course Catalog page (`app/(dashboard)/courses/page.tsx`) — grid of published courses with search, fetches from `GET /api/courses`
- [x] **[Next.js]** Build Course Detail page (`app/(dashboard)/courses/[courseId]/page.tsx`) — module/lesson sidebar + content area, fetches from `GET /api/courses/[courseId]`
- [x] **[Next.js]** Build Create Course page (`app/(dashboard)/courses/new/page.tsx`) — form for TEACHER/ADMIN, submits to `POST /api/courses`
- [x] **[Next.js]** Build Edit Course page (`app/(dashboard)/courses/[courseId]/edit/page.tsx`) — submits to `PATCH /api/courses/[courseId]`
- [x] **[Next.js]** Add "Enroll" / "Unenroll" button on course detail (for STUDENT) — calls `POST/DELETE /api/courses/[courseId]/enroll`
- [x] **[Next.js]** Build My Courses page (`app/(dashboard)/my-courses/page.tsx`) — enrolled courses for students (from `GET /api/enrollments/my`), owned courses for teachers (from `GET /api/courses` filtered)

### 3C — Module & Lesson Management (Teacher)

- [x] **[Next.js]** Build Module management UI within Course Edit (add/edit/delete/reorder modules) — calls `/api/courses/[courseId]/modules` endpoints
- [x] **[Next.js]** Build Lesson editor within Module (add/edit/delete/reorder lessons) — calls `/api/modules/[moduleId]/lessons` endpoints
- [x] **[Next.js]** Integrate a Markdown editor for lesson content (e.g., `@uiw/react-md-editor` or similar)
- [x] **[Next.js]** Build drag-and-drop reordering for modules and lessons (e.g., `@dnd-kit/core`)

### 3D — Material Management (Teacher)

- [x] **[Next.js]** Build file upload component with drag-and-drop zone and progress bar — submits `FormData` to `POST /api/lessons/[lessonId]/materials/upload`
- [x] **[Next.js]** Display material list per lesson with download links (to `GET /api/materials/[materialId]/download`)
- [x] **[Next.js]** Add delete material functionality with confirmation modal — calls `DELETE /api/materials/[materialId]`

### 3E — Student Lesson View ✅

- [x] **[Next.js]** Build lesson content viewer (renders Markdown content) — fetches from `GET /api/lessons/[lessonId]`
- [x] **[Next.js]** Display attached materials with download buttons
- [x] **[Next.js]** Build lesson navigation (prev/next within module)
- [x] **[Next.js]** Implement `LessonProgress` model (`studentId`, `lessonId`, `isCompleted`) for tracking completion — added to Prisma schema with `@@unique([studentId, lessonId])`
- [x] **[Next.js]** Build `POST /api/lessons/[lessonId]/progress` and `GET /api/lessons/[lessonId]/progress` route handlers for toggling and reading lesson completion status
- [x] **[Next.js]** Integrate progress tracking into the lesson view and student dashboard

> **Implementation Note:** The `LessonProgress` model was an ad-hoc addition during Phase 3E to support progress tracking on the student dashboard. See `prisma/schema.prisma` for the full model definition and `docs/01-database-schema.md` for the schema documentation.

### 3F — Dashboards ✅

- [x] **[Next.js]** Build role-based dashboard hub (`app/(dashboard)/dashboard/page.tsx`) — client component with `useAuth` that conditionally renders `<StudentDashboard>`, `<TeacherDashboard>`, or `<AdminDashboard>` based on `user.role`
- [x] **[Next.js]** Build Admin user management page (`app/(dashboard)/admin/users/page.tsx`) — fetches from `GET /api/users`
- [x] **[Next.js]** Display user table with role badges and status
- [x] **[Next.js]** Add ability to deactivate/reactivate users — calls `DELETE /api/users/[userId]` or `PATCH /api/users/[userId]`
- [x] **[Next.js]** Show platform statistics (total users, courses, enrollments) — **decided against** a dedicated `GET /api/admin/stats` endpoint; admin dashboard fetches data via existing `GET /api/users` and `GET /api/courses` endpoints with `useApi` hooks
- [x] **[Next.js]** Build Admin Analytics Dashboard (`app/(dashboard)/admin/analytics/page.tsx`) — **Server Component with direct Prisma queries** for enrollment counts per course (admin/teacher) and lesson progress percentages (student); visualised with Recharts via a client `<AnalyticsChart>` wrapper

> **Architecture Note (Dashboard Data Fetching):** The dashboard page (`dashboard/page.tsx`) is a `"use client"` component that uses `useAuth` for role detection and `useApi` hooks for client-side data fetching. The analytics page (`admin/analytics/page.tsx`) is a **Server Component** that uses `getAuthUser()` + direct Prisma queries — no dedicated stats API route was created. This hybrid approach avoids an unnecessary API layer for read-only analytics while keeping the interactive dashboards client-rendered.

---

## Phase 4: Gemini AI Integration (Next.js Backend)

> Wire up the Google Gemini API for the AI Tutor feature using the **`@google/genai` Node.js SDK** within Next.js Route Handlers. Gemini's massive context window allows us to pass uploaded PDF documents directly as context — no vector stores or embeddings needed.

### 4A — Gemini Service Layer

- [x] **[Next.js API]** Install `@google/genai` SDK (`npm install @google/genai`)
- [x] **[Next.js API]** Add `GEMINI_API_KEY` to `.env.local` and validate at startup in `lib/gemini/client.ts`
- [x] **[Next.js API]** Create `lib/gemini/gemini.service.ts` as a centralized wrapper for all Gemini API interactions
- [x] **[Next.js API]** Configure the Gemini client: instantiate `GoogleGenAI` with `apiKey` from environment variable
- [x] **[Next.js API]** Select model: use `gemini-3.1-flash-lite` — fast, cost-effective, and optimized for grounded Q&A tasks

### 4B — Gemini File API Integration

- [x] **[Next.js API]** Implement `uploadFileToGemini(filePath: string, displayName: string)` using `ai.files.upload({ file: filePath, config: { displayName } })` → returns `file.uri` and `file.name`
- [x] **[Next.js API]** Implement `getGeminiFile(fileName: string)` using `ai.files.get({ name })` → check file state (`ACTIVE` vs `PROCESSING`)
- [x] **[Next.js API]** Implement `deleteGeminiFile(fileName: string)` using `ai.files.delete({ name })`
- [x] **[Next.js API]** Implement `listGeminiFiles()` for debugging/admin purposes
- [x] **[Next.js API]** Handle file processing wait: poll `ai.files.get()` until `state === "ACTIVE"` before using in chat (with `setTimeout`-based polling and a max timeout)
- [x] **[Next.js API]** Handle Gemini File API errors (file too large, unsupported format, quota exceeded) with graceful error responses

### 4C — Course AI Setup Endpoint

- [x] **[Next.js API]** Implement `POST /api/courses/[courseId]/setup-ai` route handler (`app/api/courses/[courseId]/setup-ai/route.ts`):
  - Iterates through all course materials (PDFs) via Prisma query
  - Uploads each to Gemini via `ai.files.upload()`
  - Stores returned `file.uri` in `materials.geminiFileUri` via Prisma update
  - Sets `courses.aiEnabled = true` via Prisma update
  - Returns count of files uploaded and their status
- [x] **[Next.js API]** Update material upload flow: auto-upload new PDFs to Gemini if `course.aiEnabled === true`, save `geminiFileUri`
- [x] **[Next.js API]** Update material delete flow: call `ai.files.delete()` if `geminiFileUri` exists, then clear the field in Prisma
- [x] **[Next.js API]** Update course delete flow: delete all Gemini files associated with course materials before Prisma cascade delete
- [x] **[Next.js API]** Add async handling for file uploads (Gemini File API can be slow for large PDFs) — consider using a background job pattern or streaming progress

### 4D — Chat Session & Message Handling

- [x] **[Next.js API]** Create system prompt template for the AI Tutor (`lib/gemini/prompts.ts`): _"You are a helpful tutor for the course '{courseTitle}'. Answer questions based ONLY on the provided course materials. If the answer is not in the materials, say so clearly. Cite specific sections where possible."_
- [x] **[Next.js API]** Implement chat logic in `lib/gemini/gemini.service.ts`:
  1. Load all `geminiFileUri` references for the course's materials via Prisma
  2. Build the `contents` array: system instruction + file references (as `Part` objects with `fileData: { fileUri }`) + conversation history from `chat_messages`
  3. Call `ai.models.generateContent({ model, contents, config: { systemInstruction } })` (or use chat sessions with `ai.chats.create()`)
  4. Return the assistant response text
- [x] **[Next.js API]** Handle Gemini-specific response parsing: extract `response.text`, handle `finishReason`, safety ratings
- [x] **[Next.js API]** Implement token counting awareness: log `response.usageMetadata` (promptTokenCount, candidatesTokenCount)
- [x] **[Next.js API]** Handle Gemini API errors gracefully (rate limits `429`, safety blocks, context length exceeded, network timeouts)
- [x] **[Next.js API]** Add retry logic with exponential backoff for transient Gemini API failures

### 4E — Chat CRUD Endpoints

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/chat.ts` — `threadCreateSchema`, `askMessageSchema`)
- [x] **[Next.js API]** Create chat service module (`lib/services/chat.service.ts`) — orchestrates between Prisma queries and Gemini service
- [x] **[Next.js API]** Implement `POST /api/courses/[courseId]/chat/threads` route handler (`app/api/courses/[courseId]/chat/threads/route.ts`) — create a new local thread via Prisma
- [x] **[Next.js API]** Implement `GET /api/courses/[courseId]/chat/threads` route handler — list student's threads for this course via Prisma
- [x] **[Next.js API]** Implement `GET /api/chat/threads/[threadId]/messages` route handler (`app/api/chat/threads/[threadId]/messages/route.ts`) — get conversation history via Prisma
- [x] **[Next.js API]** Implement `POST /api/chat/threads/[threadId]/ask` route handler (`app/api/chat/threads/[threadId]/ask/route.ts`):
  1. Validate enrollment + `aiEnabled` on course via Prisma
  2. Save user message to `ChatMessage` via Prisma
  3. Load full thread history from `ChatMessage` via Prisma
  4. Load course material file references (`geminiFileUri` list) via Prisma
  5. Call Gemini `generateContent` with system prompt + files + history using `@google/genai`
  6. Save assistant response to `ChatMessage` via Prisma
  7. Return both messages
- [x] **[Next.js API]** Implement `DELETE /api/chat/threads/[threadId]` route handler — delete thread via Prisma cascade (deletes messages)
- [x] **[Next.js API]** Add enrollment validation: student must be enrolled in the course to chat (reuse `checkEnrollment` helper)
- [x] **[Next.js API]** Add course AI readiness check: verify `aiEnabled === true` and at least one material has `geminiFileUri` before allowing chat

---

## Phase 5: AI Tutor Chat UI (Frontend)

> Build the chat interface that students use to interact with the Gemini-powered AI Tutor. The UI follows a **dual-layout strategy**: a standalone Chat Page for focused conversations, and a slide-out Sheet panel on the Lesson View for in-context Q&A. Both layouts compose the same reusable component library. All API calls go to internal Next.js API routes (`/api/...`).

### 5A — Component-Driven Chat Core

> Build a reusable component library in `components/chat/` first, then assemble them into the standalone chat page. This ensures the same components can be embedded in the Lesson View Sheet (Phase 5B) without duplication.

- [x] **[Next.js]** Install markdown rendering dependencies: `npm install react-markdown remark-gfm remark-math rehype-katex`
- [x] **[Next.js]** Build `<MessageList>` component (`components/chat/MessageList.tsx`) — renders chat messages with role-based styling (user messages right-aligned, assistant left-aligned), Markdown rendering in assistant responses (code blocks, lists, bold, LaTeX math via `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`), auto-scroll to latest message
- [x] **[Next.js]** Build `<ChatInput>` component (`components/chat/ChatInput.tsx`) — message input with send button, Enter-to-submit, Ctrl+Enter for newline, disabled state while awaiting response
- [x] **[Next.js]** Build `<ThreadSidebar>` component (`components/chat/ThreadSidebar.tsx`) — list of previous conversations with create-new button, fetches from `GET /api/courses/[courseId]/chat/threads`, thread selection callback
- [x] **[Next.js]** Build `<ChatWidget>` component (`components/chat/ChatWidget.tsx`) — composes `<ThreadSidebar>`, `<MessageList>`, and `<ChatInput>` into a complete chat experience; accepts `courseId` prop; manages thread selection, message fetching (`GET /api/chat/threads/[threadId]/messages`), and message sending (`POST /api/chat/threads/[threadId]/ask`) as internal state
- [x] **[Next.js]** Show loading/typing indicator in `<MessageList>` while waiting for Gemini response
- [x] **[Next.js]** Handle error states (AI unavailable, rate limits, safety filters, network errors) with user-friendly inline messages
- [x] **[Next.js]** Build standalone Chat page (`app/(dashboard)/courses/[courseId]/chat/page.tsx`) — a `"use client"` page that renders `<ChatWidget courseId={courseId} />` in a full-page layout with course title header

### 5B — UX Polish & Lesson View Integration

> Integrate the chat into the lesson study flow using a Shadcn `<Sheet>` slide-out panel, allowing students to read lesson content and chat with the AI Tutor simultaneously (NotebookLM-style).

- [x] **[Next.js]** Integrate `<ChatWidget>` into the Lesson View page (`app/(dashboard)/courses/[courseId]/lessons/[lessonId]/page.tsx`) using a Shadcn `<Sheet side="right">`. When the user clicks "Ask AI Tutor", a slide-out panel opens on the right side allowing them to read the lesson and chat simultaneously — the Sheet receives the `courseId` and renders `<ChatWidget>` inside it
- [x] **[Next.js]** Add "AI Tutor not configured" empty state inside `<ChatWidget>` when course has `aiEnabled === false` or no materials have `geminiFileUri`
- [x] **[Next.js]** Add thread delete with confirmation in `<ThreadSidebar>` — calls `DELETE /api/chat/threads/[threadId]`
- [x] **[Next.js]** Mobile-responsive chat layout: standalone page uses full-screen layout; Sheet panel uses `side="bottom"` or full-screen on mobile breakpoints
- [x] **[Next.js]** Add keyboard shortcuts (Ctrl+Enter to send, Escape to close Sheet)
- [x] **[Next.js]** Display Gemini safety filter warnings gracefully when a response is blocked (inline alert in `<MessageList>`)

### 5C — Teacher AI Management

- [x] **[Next.js]** Add "Setup AI Tutor" button on course edit page — calls `POST /api/courses/[courseId]/setup-ai`
- [x] **[Next.js]** Show AI tutor status indicator (enabled / not enabled)
- [x] **[Next.js]** Show which materials are synced to Gemini (`geminiFileUri` badge — synced ✓ / not synced ✗)
- [x] **[Next.js]** Add "Re-sync Materials" action to re-upload files after updates
- [x] **[Next.js]** Show file processing status (PROCESSING → ACTIVE) with auto-refresh polling

---

## Phase 6: Core Media & Cloud Storage

> Migrate from local `public/uploads/` file storage to a cloud storage provider and add inline media viewers so students can consume PDFs and videos directly inside the app. End this phase with a smoke-test deployment to verify cloud integrations work in production.

### 6A — Cloud Storage Migration

- [x] **[Next.js]** Install UploadThing packages (`npm install uploadthing @uploadthing/react`).
- [x] **[Next.js API]** Setup UploadThing backend: Create file router at `app/api/uploadthing/core.ts` and the main route handler at `app/api/uploadthing/route.ts` to allow direct-to-cloud uploads.
- [x] **[Next.js]** Update Teacher UI: Replace the custom file upload form with UploadThing's `<UploadDropzone>` component in the material management page.
- [x] **[Next.js]** Update DB state: Inside the `<UploadDropzone>`'s `onClientUploadComplete` callback, take the returned cloud URL (`res[0].url`) and trigger your API to save it to `Material.fileUrl` in the database.
- [x] **[Next.js API]** Update the `DELETE /api/materials/[materialId]` route to call `utapi.deleteFiles(fileKey)` to remove the file from the cloud instead of `fs.unlink`.
- [x] **[Prisma]** Update `Material.fileUrl` semantics — this field now stores the UploadThing URL instead of a local `/uploads/...` path. Update any frontend components that reference local paths.
- [x] **[Next.js]** Add UploadThing environment variables to `.env`

### 6B — Inline PDF & Video Viewers

- [x] **[Next.js]** Build `<PdfViewer>` component (`components/viewers/PdfViewer.tsx`) — Use the browser-native `<iframe src={url} className="w-full h-200 rounded-xl border border-slate-200" />`. **Strictly avoid `react-pdf`** to prevent SSR/Webpack worker configuration hell.
- [x] **[Next.js]** Build `<VideoPlayer>` component (`components/viewers/VideoPlayer.tsx`) — `"use client"` component using HTML5 `<video>` element with controls, playback speed selector, and fullscreen support; accepts cloud-hosted video URL as `src` prop
- [x] **[Next.js]** Integrate viewers into the Lesson View page (`app/(dashboard)/courses/[courseId]/lessons/[lessonId]/page.tsx`) — render `<PdfViewer>` for `MaterialType.PDF` and `<VideoPlayer>` for `MaterialType.VIDEO` inline, alongside the existing download button
- [x] **[Next.js]** Add a "Preview" action button on material list items that opens the viewer in a Shadcn `<Dialog>` modal for quick viewing without navigating away
- [x] **[Next.js]** Handle unsupported file types gracefully — for `MaterialType.OTHER` / `MaterialType.LINK`, show only the download button with a file-type icon

### 6C — Smoke Test Deployment (Vercel + Managed Postgres)

- [x] **[Vercel]** Create a Vercel project and link to the Git repository
- [x] **[Database]** Provision a managed PostgreSQL instance — **Neon** (recommended: generous free tier, serverless Postgres) or **Supabase**
- [x] **[Prisma]** Update `DATABASE_URL` for the managed Postgres connection string (with `?sslmode=require` and connection pooler URL if using Neon)
- [x] **[Prisma]** Run `npx prisma migrate deploy` against the managed database to apply all existing migrations
- [x] **[Prisma]** Add `prisma generate` to the Vercel build command: set Build Command to `npx prisma generate && next build`
- [x] **[Vercel]** Configure all production environment variables in Vercel dashboard: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, and cloud storage credentials
- [x] **[Next.js]** Verify `next.config.ts` has any necessary `serverExternalPackages` config for Prisma (e.g., `serverExternalPackages: ["@prisma/client"]` if needed)
- [x] **[Smoke Test]** Deploy to Vercel and manually verify the full happy path: register → login → create course → add module/lesson → upload a PDF (cloud) → view PDF inline → enable AI → chat with AI tutor → enroll as student → study lesson → download material
- [x] **[Smoke Test]** Verify Gemini API connectivity from the Vercel serverless environment (file upload + chat response)
- [x] **[Smoke Test]** Document any issues found and fix critical blockers before proceeding to Phase 7

---

## Phase 7: The Quiz Engine & AI Generation

> Add an assessment system to the LMS. Lessons can now be either `LECTURE` (existing behavior) or `QUIZ` type. Teachers build quizzes with a dynamic form, and students take quizzes with auto-grading and answer review. A "Magic AI" button lets teachers auto-generate quiz questions from lesson content using Gemini.

### 7A — Prisma Schema Updates for Quizzes

- [x] **[Prisma]** Add `LessonType` enum: `LECTURE`, `QUIZ`
- [x] **[Prisma]** Add `lessonType` field to `Lesson` model: `lessonType LessonType @default(LECTURE)` — backward-compatible, all existing lessons default to `LECTURE`
- [x] **[Prisma]** Create `Quiz` model:

  ```prisma
  model Quiz {
    id           String    @id @default(uuid())
    lessonId     String    @unique    // 1:1 with Lesson
    dueDate      DateTime?
    maxAttempts  Int       @default(1)
    passingScore Float     @default(0.5)  // e.g., 0.5 = 50%
    createdAt    DateTime  @default(now())
    updatedAt    DateTime  @updatedAt

    lesson    Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)
    questions QuizQuestion[]
    attempts  QuizAttempt[]

    @@map("quizzes")
  }
  ```

- [x] **[Prisma]** Create `QuizQuestion` model:

  ```prisma
  model QuizQuestion {
    id           String   @id @default(uuid())
    quizId       String
    questionText String
    explanation  String?              // shown after quiz review
    orderIndex   Int      @default(0)
    points       Int      @default(1)
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt

    quiz    Quiz             @relation(fields: [quizId], references: [id], onDelete: Cascade)
    options QuizOption[]
    answers QuizAnswer[]

    @@index([quizId])
    @@map("quiz_questions")
  }
  ```

- [x] **[Prisma]** Create `QuizOption` model:

  ```prisma
  model QuizOption {
    id         String  @id @default(uuid())
    questionId String
    optionText String
    isCorrect  Boolean @default(false)
    orderIndex Int     @default(0)

    question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
    answers  QuizAnswer[]

    @@index([questionId])
    @@map("quiz_options")
  }
  ```

- [x] **[Prisma]** Create `QuizAttempt` model:

  ```prisma
  model QuizAttempt {
    id          String    @id @default(uuid())
    quizId      String
    studentId   String
    score       Float?               // calculated after submission
    totalPoints Int?
    startedAt   DateTime  @default(now())
    submittedAt DateTime?

    quiz    Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
    student User         @relation(fields: [studentId], references: [id], onDelete: Cascade)
    answers QuizAnswer[]

    @@index([quizId])
    @@index([studentId])
    @@map("quiz_attempts")
  }
  ```

- [x] **[Prisma]** Create `QuizAnswer` model:

  ```prisma
  model QuizAnswer {
    id         String @id @default(uuid())
    attemptId  String
    questionId String
    optionId   String

    attempt  QuizAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
    question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
    option   QuizOption   @relation(fields: [optionId], references: [id], onDelete: Cascade)

    @@index([attemptId])
    @@map("quiz_answers")
  }
  ```

- [x] **[Prisma]** Add `quizAttempts QuizAttempt[]` relation to the `User` model
- [x] **[Prisma]** Add `quiz Quiz?` relation to the `Lesson` model (1:1 optional)

### 7B — Quiz CRUD API

- [x] **[Next.js API]** Create Zod validation schemas (`lib/validations/quiz.ts`):
  - `quizCreateSchema` — validates `dueDate?`, `maxAttempts`, `timeLimitMin?`, `passingScore`, and nested `questions[]` array with `questionText`, `explanation?`, `points`, and `options[]` with `optionText` and `isCorrect`
  - `quizUpdateSchema` — partial version for updates
  - `quizSubmitSchema` — validates `answers[]` array with `{ questionId, optionId }`
- [x] **[Next.js API]** Create quiz service module (`lib/services/quiz.service.ts`):
  - `createQuiz(lessonId, data)` — creates quiz with nested questions and options using Prisma nested `create`
  - `getQuizByLessonId(lessonId)` — fetches quiz with questions and options via Prisma `include`. **CRITICAL: If request is from a STUDENT, map over the options and remove the `isCorrect` field before returning JSON.**
  - `updateQuiz(quizId, data)` — upserts questions/options (delete-and-recreate strategy for simplicity). **MVP Rule: If `attempts > 0`, block updating questions/options to prevent orphaned records.**
  - `deleteQuiz(quizId)` — cascade deletes via Prisma
  - `submitAttempt(quizId, studentId, answers)` — creates `QuizAttempt` + `QuizAnswer` records, calculates score
  - `getAttempts(quizId, studentId)` — fetches student's past attempts with answers
- [x] **[Next.js API]** Implement `POST /api/lessons/[lessonId]/quiz` route handler — TEACHER/ADMIN, creates quiz with questions + options; validates lesson is `QUIZ` type
- [x] **[Next.js API]** Implement `GET /api/lessons/[lessonId]/quiz` route handler — owner/enrolled students; returns quiz structure (for students: excludes `isCorrect` until after submission)
- [x] **[Next.js API]** Implement `PATCH /api/lessons/[lessonId]/quiz` route handler — TEACHER/ADMIN, updates quiz settings and questions
- [x] **[Next.js API]** Implement `DELETE /api/lessons/[lessonId]/quiz` route handler — TEACHER/ADMIN, deletes quiz
- [x] **[Next.js API]** Implement `POST /api/lessons/[lessonId]/quiz/submit` route handler — STUDENT, submits answers; validates: enrollment, max attempts not exceeded, due date not passed; calculates and stores score
- [x] **[Next.js API]** Implement `GET /api/lessons/[lessonId]/quiz/attempts` route handler — STUDENT (own attempts) or TEACHER (all attempts for grading overview); returns attempts with scores

### 7C — Teacher Quiz Builder UI

- [x] **[Next.js]** Update lesson creation/edit form to include `lessonType` selector (`LECTURE` / `QUIZ` radio group or `<Select>`)
- [x] **[Next.js]** Build `<QuizBuilder>` component (`components/quiz/QuizBuilder.tsx`) — `"use client"` dynamic form with:
  - Quiz settings section: due date picker (Shadcn `<DatePicker>`), max attempts input, optional time limit, passing score percentage (Skip time limit for MVP).
  - Dynamic question list: add/remove/reorder questions with drag-and-drop (reuse `@dnd-kit/core`)
  - Per-question: text input for question, optional explanation textarea, points input
  - Per-question option list: add/remove options (min 2, max 6), text input for each option, radio/checkbox to mark correct answer(s)
  - Form validation with Zod before submission
- [x] **[Next.js]** Integrate `<QuizBuilder>` as a sheet opened by an icon shown beside edit icon in lesson item when `lessonType === "QUIZ"`
- [x] **[Next.js]** Build quiz preview mode — teacher can preview the quiz as a student would see it before publishing
- [x] **[Next.js]** Handle edit mode: pre-populate `<QuizBuilder>` with existing quiz data when editing a `QUIZ` lesson

### 7D — Student Quiz Taking UI

- [x] **[Next.js]** Build `<QuizTaker>` component (`components/quiz/QuizTaker.tsx`) — `"use client"` component that renders the quiz-taking interface:
  - Displays quiz title, number of questions, and remaining attempts
  - Renders each question with its options as radio buttons (single-select)
  - Shows progress indicator (e.g., "Question 3 of 10")
  - Submit button with confirmation dialog ("Are you sure? You cannot change your answers after submission.")
- [x] **[Next.js]** Build `<QuizResult>` component (`components/quiz/QuizResult.tsx`) — renders after submission or when reviewing a past attempt:
  - Shows score (e.g., "8/10 — 80%") with pass/fail indicator based on `passingScore`
  - Per-question breakdown: student's selected answer, correct answer highlighted, explanation text displayed
  - Color-coded: green for correct, red for incorrect
- [x] **[Next.js]** Integrate quiz UI into the Lesson View page — when a lesson is `QUIZ` type, render `<QuizTaker>` below the markdown content viewer; after submission, render `<QuizResult>`
- [x] **[Next.js]** Show attempt history — list of past attempts with scores and "Review" button to view `<QuizResult>` for each attempt
- [x] **[Next.js]** Handle edge cases: due date passed (show "Quiz closed" message), max attempts reached (show "No attempts remaining"), quiz not yet created by teacher (show "Quiz coming soon")

### 7E — AI-Powered Quiz Generation (Magic AI Button)

- [x] **[Next.js API]** Create a Gemini prompt template (`lib/gemini/prompts.ts`) for quiz generation — instruct Gemini to read the lesson content (text + attached PDFs) and output a JSON array of questions with options, correct answers, and explanations; specify the exact JSON schema in the prompt for reliable structured output
- [x] **[Next.js API]** Implement `POST /api/lessons/[lessonId]/quiz/generate` route handler:
  1. Verify TEACHER/ADMIN ownership of the lesson's course
  2. Load the lesson's `content` (markdown text) and associated material `geminiFileUri` references via Prisma
  3. Call Gemini `generateContent` with the quiz-generation system prompt + lesson content + file references. **CRITICAL: Use `responseMimeType: "application/json"` and provide a strict `responseSchema` (Array of questions with options) to guarantee valid JSON output.**
  4. Parse the JSON response, validate structure with Zod
  5. Return the generated questions as a structured JSON response (does NOT auto-save — the teacher reviews first)
- [x] **[Next.js API]** Add optional parameters: `numberOfQuestions` (default 5)
- [x] **[Next.js]** Add "✨ Generate with AI" button in the `<QuizBuilder>` component — calls the generate endpoint, then populates the quiz form fields with the AI-generated questions; teacher can review, edit, add/remove questions before saving
- [x] **[Next.js]** Show loading state with a shimmer animation while Gemini generates questions
- [x] **[Next.js]** Handle errors: course AI not enabled, no materials uploaded, Gemini rate limit, malformed response (fallback: show error toast and let teacher create manually)

---

## Phase 8: UX Polish & Production Deployment

> Final presentation prep: centralized material management, theming, internationalization, responsive polish, and production deployment.

### 8A — Centralized & Unified Material Dashboard (Teacher)

- [x] **[Next.js API]** Implement `GET /api/courses/[courseId]/materials` route handler — TEACHER/ADMIN, returns all materials across all lessons in the course, including fields for filename, size, type, upload date, and **Gemini Sync State (`geminiFileName`, `geminiFileUri`)** via Prisma `include` (join through `Material → Lesson → Module`).
- [x] **[Next.js API]** Implement `POST /api/courses/[courseId]/materials/[materialId]/resync` route handler — TEACHER/ADMIN. **CRITICAL 48H EXPIRATION FIX:** This endpoint re-downloads the original file stream (from UploadThing), uploads it to the Google Gemini File API to get a brand new File ID/URI, and **STRICTLY updates the `Material` record in Prisma with the new `geminiFileName` and `geminiFileUri`** to completely prevent the 403 Permission Denied error.
- [x] **[Next.js]** Build `<MaterialsTable>` component (`components/materials/MaterialsTable.tsx`) — `"use client"` unified data table using Shadcn `<Table>` displaying:
  - File name, Type badge (`PDF`/`VIDEO`/`OTHER`), and File size (formatted in MB/KB)
  - Location hierarchy (e.g., "Module 1 > Lesson 3")
  - **Gemini Sync Status Indicator** (Visual badge: "Synced" with green dot if valid, "Expired / Not Synced" with gray/amber dot if `updatedAt` is older than 48 hours)
  - **Action Column:** Buttons to Download, Delete, and **"✨ Re-Sync to AI"** (calls the new re-sync endpoint and refreshes the table state).
- [x] **[Next.js]** Integrate `<MaterialsTable>` as a new dedicated tab called **"Materials"** in the Course Edit page (`app/(dashboard)/courses/[courseId]/edit/page.tsx`) to replace the old `<AITutorSettings>` component.
- [x] **[Next.js]** Clean up legacy UI: Remove the old, basic sync list `<AITutorSettings>` from the "AI Tutor Configuration" section to avoid duplication, and direct teachers to use this new centralized dashboard instead.
- [x] **[Next.js]** Show storage summary metrics at the top of the Materials tab (Total files count, and sum of `fileSizeBytes` converted to a clean MB layout).
- [x] **[Next.js]** Add a "✨ Upload Material" button at the top of `<MaterialsTable>`:
  - Clicking it opens a Shadcn `<Dialog>` containing `<UploadDropzone>` like in `<LessonMaterials>` component and a Shadcn `<Select>` dropdown to choose the target Lesson (fetched from the course layout context).
  - On submission, reuse the existing `POST /api/lessons/[lessonId]/materials` endpoint to attach the file, then automatically refresh the dashboard table state.

### 8B — Theme System (Light/Dark Mode) - Optional MVP Bonus

- [ ] **[Next.js]** Install `next-themes` and wrap the app with `<ThemeProvider>` in `app/layout.tsx`.
- [ ] **[Next.js]** Build a simple `<ThemeToggle>` component (Sun/Moon icon) and place it in the top Navbar.
- [ ] **[Testing]** Do a quick manual test. If some hardcoded colors break in Dark Mode, leave them as-is or fix only the most critical layout issues.

### 8C — Vietnamese Localization (Hardcoded)

> The project is for HUST students, so the default UI must be 100% in Vietnamese. To save time, bypass complex i18n libraries and hardcode translations directly into the UI components.

- [ ] **[Next.js]** Audit shared layout components (Navbar, Sidebar, Footer) and translate UI strings to natural Vietnamese for a LMS app (e.g., "Dashboard" -> "Bảng điều khiển", "Courses" -> "Khóa học").
- [ ] **[Next.js]** Audit Student UI flows: Translate action buttons and states (e.g., "Enroll" -> "Đăng ký học", "Submit" -> "Nộp bài", "Review" -> "Xem lại").
- [ ] **[Next.js]** Audit Teacher UI flows (Dashboard): Translate table headers, form labels, and toast notifications (e.g., "Success!" -> "Thành công!").
- [ ] **[Next.js]** Update the localization settings for any third-party UI components (e.g., Shadcn `<DatePicker>`, Calendar, or Data Table pagination) to use the Vietnamese locale (`vi`).

### 8D — Responsive Design Pass

- [ ] **[Next.js]** Audit and fix the dashboard sidebar — collapse to a hamburger menu or bottom nav on mobile breakpoints (`md:` and below)
- [ ] **[Next.js]** Fix course catalog grid — ensure cards stack to single-column on mobile, 2 columns on tablet, 3–4 on desktop
- [ ] **[Next.js]** Fix Course Learning page — ensure no x-overflow in each lesson item on mobile
- [ ] **[Next.js]** Fix standalone AI Tutor chat page — ensure the chat history sidebar not taking up the screen and hide the chat content on mobile
- [ ] **[Next.js]** Fix the quiz builder — ensure the dynamic form is usable on tablet-width screens (stack question options vertically)
- [ ] **[Next.js]** Fix the admin tables (users, analytics) — add horizontal scroll wrapper (`overflow-x-auto`) for data tables on mobile
- [ ] **[Next.js]** Test all critical flows on Chrome DevTools mobile emulator (iPhone SE, iPad, and standard desktop)

### 8E — Final Production Deployment

- [ ] **[Vercel]** Review and update all production environment variables (ensure `DATABASE_URL` uses the production managed Postgres connection string with SSL, `JWT_SECRET` is a strong random string, `GEMINI_API_KEY` is the production key, cloud storage credentials are set)
- [ ] **[Prisma]** Run `npx prisma migrate deploy` against the production database to apply any new migrations from Phase 7 (quiz tables)
- [ ] **[Next.js]** Run `next build` locally to verify zero build errors before deploying
- [ ] **[Next.js]** Review `next.config.ts` for production optimizations: ensure `images.remotePatterns` includes the cloud storage domain, set `output` if needed
- [ ] **[Vercel]** Deploy to Vercel production
- [ ] **[Final Verification]** Run a full end-to-end walkthrough on production: register → login → browse courses → enroll → study lecture lesson → view PDF inline → watch video → take quiz → review answers → chat with AI tutor → switch to dark mode → switch to Vietnamese → test on mobile viewport
- [ ] **[Docs]** Update `README.md` with: project overview, screenshots, tech stack, environment variable reference, deployment instructions (Vercel + Neon/Supabase), and demo credentials

---

## Project Structure

```
improved-E-learning/
├── app/
│   ├── layout.tsx                           # Root layout (ThemeProvider + IntlProvider)
│   ├── (auth)/
│   │   ├── layout.tsx                       # Auth layout (no sidebar)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                       # Dashboard layout (sidebar + navbar)
│   │   ├── courses/
│   │   │   ├── page.tsx                     # Course catalog
│   │   │   ├── new/page.tsx                 # Create course
│   │   │   └── [courseId]/
│   │   │       ├── page.tsx                 # Course detail
│   │   │       ├── edit/page.tsx            # Edit course (curriculum + materials tabs)
│   │   │       ├── chat/page.tsx            # AI Tutor chat
│   │   │       └── lessons/
│   │   │           └── [lessonId]/
│   │   │               └── page.tsx         # Lesson view (lecture or quiz)
│   │   ├── my-courses/page.tsx
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       └── analytics/page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── auth/
│       │   ├── register/route.ts
│       │   ├── login/route.ts
│       │   └── me/route.ts
│       ├── users/
│       │   ├── route.ts                     # GET (list)
│       │   └── [userId]/route.ts            # GET, PATCH, DELETE
│       ├── courses/
│       │   ├── route.ts                     # GET (list), POST (create)
│       │   └── [courseId]/
│       │       ├── route.ts                 # GET, PATCH, DELETE
│       │       ├── setup-ai/route.ts        # POST
│       │       ├── enroll/route.ts          # POST, DELETE
│       │       ├── students/route.ts        # GET
│       │       ├── materials/route.ts       # GET (all course materials)
│       │       ├── modules/
│       │       │   ├── route.ts             # GET, POST
│       │       │   └── [moduleId]/route.ts  # PATCH, DELETE
│       │       └── chat/
│       │           └── threads/route.ts     # GET, POST
│       ├── modules/
│       │   └── [moduleId]/
│       │       └── lessons/route.ts         # GET, POST
│       ├── lessons/
│       │   └── [lessonId]/
│       │       ├── route.ts                 # GET, PATCH, DELETE
│       │       ├── materials/
│       │       │   ├── route.ts             # GET
│       │       │   └── upload/route.ts      # POST (cloud upload)
│       │       ├── progress/route.ts        # GET, POST
│       │       └── quiz/
│       │           ├── route.ts             # GET, POST, PATCH, DELETE
│       │           ├── submit/route.ts      # POST (student submission)
│       │           ├── attempts/route.ts    # GET (attempt history)
│       │           └── generate/route.ts    # POST (AI generation)
│       ├── materials/
│       │   └── [materialId]/
│       │       ├── route.ts                 # DELETE
│       │       └── download/route.ts        # GET (signed URL)
│       ├── enrollments/
│       │   └── my/route.ts                  # GET
│       └── chat/
│           └── threads/
│               └── [threadId]/
│                   ├── route.ts             # DELETE
│                   ├── messages/route.ts     # GET
│                   └── ask/route.ts          # POST
├── components/
│   ├── ui/                                  # Shadcn UI primitives
│   ├── layout/                              # Sidebar, Navbar, ThemeToggle, LanguageToggle
│   ├── courses/                             # Course-specific components
│   ├── chat/                                # Chat-specific components
│   ├── quiz/                                # QuizBuilder, QuizTaker, QuizResult
│   ├── viewers/                             # PdfViewer, VideoPlayer
│   ├── materials/                           # MaterialsTable
│   └── shared/                              # Reusable components
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useApi.ts
│   └── ...
├── lib/
│   ├── prisma.ts                            # PrismaClient singleton
│   ├── api-response.ts                      # Standardized API responses
│   ├── api-handler.ts                       # Route Handler error wrapper
│   ├── auth/
│   │   ├── password.ts                      # bcryptjs hash/verify
│   │   ├── jwt.ts                           # jose sign/verify
│   │   ├── get-auth-user.ts                 # Extract user from JWT
│   │   ├── require-role.ts                  # Role guard
│   │   ├── check-ownership.ts               # Course ownership check
│   │   └── check-enrollment.ts              # Enrollment check
│   ├── validations/
│   │   ├── auth.ts                          # Zod schemas
│   │   ├── user.ts
│   │   ├── course.ts
│   │   ├── module.ts
│   │   ├── lesson.ts
│   │   ├── material.ts
│   │   ├── enrollment.ts
│   │   ├── chat.ts
│   │   └── quiz.ts                          # Quiz Zod schemas
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── course.service.ts
│   │   ├── module.service.ts
│   │   ├── lesson.service.ts
│   │   ├── material.service.ts
│   │   ├── cloud-storage.service.ts         # Cloud storage adapter (UploadThing / S3)
│   │   ├── enrollment.service.ts
│   │   ├── chat.service.ts
│   │   └── quiz.service.ts                  # Quiz CRUD + scoring
│   └── gemini/
│       ├── client.ts                        # GoogleGenAI instance
│       ├── gemini.service.ts                # File upload, chat, quiz generation
│       └── prompts.ts                       # System prompt templates (tutor + quiz gen)
├── messages/
│   ├── en.json                              # English translations
│   └── vi.json                              # Vietnamese translations
├── prisma/
│   ├── schema.prisma                        # Database schema (source of truth)
│   └── migrations/                          # Auto-generated migrations
├── middleware.ts                             # Next.js route protection
├── .env.local                               # Environment variables
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## Dependency Graph

```
Phase 0 (Foundation)
   │
   ▼
Phase 1A (Prisma Schema)
   │
   ├──────────────────────┐
   ▼                      ▼
Phase 1B (Auth API)    Phase 1C (Auth UI)
   │                      │
   ▼                      │
Phase 2 (LMS APIs)        │
   │                      │
   ├──────────────────────┤
   ▼                      ▼
Phase 4 (Gemini AI)   Phase 3 (LMS UI)
   │                      │
   ▼                      ▼
   └─────────┬────────────┘
             ▼
      Phase 5 (Chat UI)
             │
             ▼
      Phase 6 (Cloud Storage + Viewers + Smoke Deploy)
             │
             ▼
      Phase 7 (Quiz Engine + AI Gen)
             │
             ▼
      Phase 8 (UX Polish + Production Deploy)
```

> **Note:** Phases 6 → 7 → 8 are strictly sequential. Phase 6 establishes the cloud infrastructure that Phase 7's file-based AI quiz generation depends on. Phase 8 polishes everything and deploys the final product.

---

## Estimated Timeline

| Phase                             | Effort          | Depends On         |
| --------------------------------- | --------------- | ------------------ |
| Phase 0 — Foundation              | 1 day           | —                  |
| Phase 1 — Schema & Auth           | 2–3 days        | Phase 0            |
| Phase 2 — LMS APIs                | 3–4 days        | Phase 1            |
| Phase 3 — LMS UI                  | 4–5 days        | Phase 1C + Phase 2 |
| Phase 4 — Gemini AI               | 2–3 days        | Phase 2            |
| Phase 5 — Chat UI                 | 3–4 days        | Phase 3 + Phase 4  |
| Phase 6 — Cloud Storage & Media   | 2–3 days        | Phase 5            |
| Phase 7 — Quiz Engine & AI Gen    | 3–4 days        | Phase 6            |
| Phase 8 — UX Polish & Prod Deploy | 2–3 days        | Phase 7            |
| **Total**                         | **~22–30 days** |                    |

> **Remaining from current state (Phase 5 ✅):** Phases 6 + 7 + 8 = **~7–10 days**, which fits the 7–12 day deadline.
>
> **Deployment strategy:** No Docker, no CI/CD. Standard Vercel serverless deployment with Neon/Supabase managed Postgres. Smoke test deployment happens early in Phase 6 to surface cloud integration issues before building more features on top.
