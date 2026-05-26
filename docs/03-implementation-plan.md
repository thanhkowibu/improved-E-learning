# Implementation Plan — E-Learning LMS

> **Version:** 3.0  
> **Last Updated:** 2026-05-20  
> **Strategy:** Core LMS first → AI integration later  
> **Stack:** Next.js 15 App Router (fullstack) · Prisma ORM · PostgreSQL · Google Gemini API (`@google/genai`) · TypeScript · Tailwind CSS & Shadcn UI

---

## Architecture Decision Record: Fullstack Pivot — FastAPI → Next.js

> **Decision:** Drop the separate Python/FastAPI backend entirely. The application is now a **100% Next.js fullstack monolith** using App Router Route Handlers (and Server Actions where appropriate) for the API layer, with **Prisma ORM** as the data access layer.
>
> **Rationale:**
> - **Single language & runtime:** TypeScript end-to-end eliminates context-switching between Python and TypeScript, and allows sharing types, validation schemas (Zod), and utilities across frontend and backend.
> - **Simplified deployment:** One deployable unit (Next.js) instead of orchestrating two separate services. Ideal for Vercel deployment or a single Docker container.
> - **Prisma advantages:** Type-safe database client auto-generated from the schema, built-in migrations (`prisma migrate`), and excellent DX with auto-completion.
> - **Next.js App Router capabilities:** Route Handlers (`app/api/.../route.ts`) provide a robust API layer. Server Components and Server Actions enable direct server-side data fetching and mutations without an API round-trip where appropriate.
>
> **Key Architectural Changes (vs. v2.0 plan):**
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
> - Gemini 1.5 Pro offers a **2M token context window** — large enough to pass full course PDFs directly as context without vector stores or embeddings.
> - Gemini provides a **generous free tier** (15 RPM / 1M TPM on Flash) — ideal for an educational project.
> - **Simpler architecture:** No vector stores, no assistants, no polling for run completion. Just upload files via the File API and pass them into a chat session.
>
> **Key Architectural Changes:**
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

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/user.ts` — `userUpdateSchema`, etc.)
- [ ] **[Next.js API]** Create user service module (`lib/services/user.service.ts` — `getUserById`, `getAllUsers`, `updateUser`, `deactivateUser` using PrismaClient)
- [ ] **[Next.js API]** Implement `GET /api/users` route handler (`app/api/users/route.ts`) — ADMIN only, paginated
- [ ] **[Next.js API]** Implement `GET /api/users/[userId]` route handler (`app/api/users/[userId]/route.ts`) — ADMIN or self
- [ ] **[Next.js API]** Implement `PATCH /api/users/[userId]` route handler — ADMIN or self, Zod validated
- [ ] **[Next.js API]** Implement `DELETE /api/users/[userId]` route handler — ADMIN only, soft-delete (`isActive = false`)

### 2B — Course CRUD

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/course.ts` — `courseCreateSchema`, `courseUpdateSchema`)
- [ ] **[Next.js API]** Create course service module (`lib/services/course.service.ts` — CRUD operations with Prisma `include` for nested relations)
- [ ] **[Next.js API]** Implement `POST /api/courses` route handler (`app/api/courses/route.ts`) — TEACHER/ADMIN, creates course with `teacherId` from auth
- [ ] **[Next.js API]** Implement `GET /api/courses` route handler — public (published only) / TEACHER (own) / ADMIN (all), paginated, searchable
- [ ] **[Next.js API]** Implement `GET /api/courses/[courseId]` route handler (`app/api/courses/[courseId]/route.ts`) — with nested modules/lessons tree using Prisma `include`
- [ ] **[Next.js API]** Implement `PATCH /api/courses/[courseId]` route handler — owner/ADMIN, Zod validated
- [ ] **[Next.js API]** Implement `DELETE /api/courses/[courseId]` route handler — owner/ADMIN, Prisma cascade delete
- [ ] **[Next.js API]** Create ownership validation helper (`lib/auth/check-ownership.ts`) for course operations

### 2C — Module CRUD

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/module.ts`)
- [ ] **[Next.js API]** Create module service module (`lib/services/module.service.ts`)
- [ ] **[Next.js API]** Implement `POST /api/courses/[courseId]/modules` route handler (`app/api/courses/[courseId]/modules/route.ts`)
- [ ] **[Next.js API]** Implement `GET /api/courses/[courseId]/modules` route handler
- [ ] **[Next.js API]** Implement `PATCH /api/courses/[courseId]/modules/[moduleId]` route handler (`app/api/courses/[courseId]/modules/[moduleId]/route.ts`)
- [ ] **[Next.js API]** Implement `DELETE /api/courses/[courseId]/modules/[moduleId]` route handler
- [ ] **[Next.js API]** Handle `orderIndex` reordering logic in module service

### 2D — Lesson CRUD

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/lesson.ts`)
- [ ] **[Next.js API]** Create lesson service module (`lib/services/lesson.service.ts`)
- [ ] **[Next.js API]** Implement `POST /api/modules/[moduleId]/lessons` route handler (`app/api/modules/[moduleId]/lessons/route.ts`)
- [ ] **[Next.js API]** Implement `GET /api/modules/[moduleId]/lessons` route handler
- [ ] **[Next.js API]** Implement `GET /api/lessons/[lessonId]` route handler (`app/api/lessons/[lessonId]/route.ts`) — with materials via Prisma `include`
- [ ] **[Next.js API]** Implement `PATCH /api/lessons/[lessonId]` route handler
- [ ] **[Next.js API]** Implement `DELETE /api/lessons/[lessonId]` route handler

### 2E — Material Upload & Management

- [ ] **[Next.js API]** Configure file storage (local `./public/uploads/` directory for dev, S3-compatible for production)
- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/material.ts`)
- [ ] **[Next.js API]** Create material service module (`lib/services/material.service.ts`)
- [ ] **[Next.js API]** Implement `POST /api/lessons/[lessonId]/materials/upload` route handler (`app/api/lessons/[lessonId]/materials/upload/route.ts`) — parse `FormData` with `request.formData()`, validate file type & size, write to disk with `fs.writeFile`, create Prisma record
- [ ] **[Next.js API]** Implement `GET /api/lessons/[lessonId]/materials` route handler
- [ ] **[Next.js API]** Implement `GET /api/materials/[materialId]/download` route handler (`app/api/materials/[materialId]/download/route.ts`) — stream file with `ReadableStream` or `NextResponse` with appropriate content headers
- [ ] **[Next.js API]** Implement `DELETE /api/materials/[materialId]` route handler — remove file from disk (`fs.unlink`) + delete Prisma record
- [ ] **[Next.js API]** Add file size and type validation middleware (max 50MB, allowed extensions: `.pdf`, `.mp4`, `.docx`, etc.)

### 2F — Enrollment

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/enrollment.ts`)
- [ ] **[Next.js API]** Create enrollment service module (`lib/services/enrollment.service.ts`)
- [ ] **[Next.js API]** Implement `POST /api/courses/[courseId]/enroll` route handler (`app/api/courses/[courseId]/enroll/route.ts`) — STUDENT, creates enrollment with Prisma, handles unique constraint error for duplicate enrollment
- [ ] **[Next.js API]** Implement `DELETE /api/courses/[courseId]/enroll` route handler — STUDENT, sets status to `DROPPED`
- [ ] **[Next.js API]** Implement `GET /api/enrollments/my` route handler (`app/api/enrollments/my/route.ts`) — student's enrolled courses with Prisma `include` for course + teacher summary
- [ ] **[Next.js API]** Implement `GET /api/courses/[courseId]/students` route handler (`app/api/courses/[courseId]/students/route.ts`) — owner/ADMIN
- [ ] **[Next.js API]** Create enrollment check helper (`lib/auth/check-enrollment.ts`) for protecting lesson/material/chat access

---

## Phase 3: Frontend LMS UI

> Build the Next.js pages and components that consume the Phase 2 internal API routes (`/api/...`).

### 3A — Shared Components & Layout

- [ ] **[Next.js]** Build responsive Sidebar navigation (role-aware: show different links for ADMIN/TEACHER/STUDENT)
- [ ] **[Next.js]** Build top Navbar with user profile dropdown
- [ ] **[Next.js]** Create reusable UI components using Shadcn UI: `Button`, `Card`, `Dialog` (Modal), `Input`, `Badge`, `Skeleton` (Spinner), `EmptyState`
- [ ] **[Next.js]** Create data-fetching hooks with loading/error states (`useCourses`, `useModules`, etc.) using `fetch('/api/...')` to internal API routes
- [ ] **[Next.js]** Set up toast notification system using Shadcn UI `Toaster` + `sonner` for success/error feedback

### 3B — Course Pages

- [ ] **[Next.js]** Build Course Catalog page (`app/(dashboard)/courses/page.tsx`) — grid of published courses with search, fetches from `GET /api/courses`
- [ ] **[Next.js]** Build Course Detail page (`app/(dashboard)/courses/[courseId]/page.tsx`) — module/lesson sidebar + content area, fetches from `GET /api/courses/[courseId]`
- [ ] **[Next.js]** Build Create Course page (`app/(dashboard)/courses/new/page.tsx`) — form for TEACHER/ADMIN, submits to `POST /api/courses`
- [ ] **[Next.js]** Build Edit Course page (`app/(dashboard)/courses/[courseId]/edit/page.tsx`) — submits to `PATCH /api/courses/[courseId]`
- [ ] **[Next.js]** Add "Enroll" / "Unenroll" button on course detail (for STUDENT) — calls `POST/DELETE /api/courses/[courseId]/enroll`
- [ ] **[Next.js]** Build My Courses page (`app/(dashboard)/my-courses/page.tsx`) — enrolled courses for students (from `GET /api/enrollments/my`), owned courses for teachers (from `GET /api/courses` filtered)

### 3C — Module & Lesson Management (Teacher)

- [ ] **[Next.js]** Build Module management UI within Course Edit (add/edit/delete/reorder modules) — calls `/api/courses/[courseId]/modules` endpoints
- [ ] **[Next.js]** Build Lesson editor within Module (add/edit/delete/reorder lessons) — calls `/api/modules/[moduleId]/lessons` endpoints
- [ ] **[Next.js]** Integrate a Markdown editor for lesson content (e.g., `@uiw/react-md-editor` or similar)
- [ ] **[Next.js]** Build drag-and-drop reordering for modules and lessons (e.g., `@dnd-kit/core`)

### 3D — Material Management (Teacher)

- [ ] **[Next.js]** Build file upload component with drag-and-drop zone and progress bar — submits `FormData` to `POST /api/lessons/[lessonId]/materials/upload`
- [ ] **[Next.js]** Display material list per lesson with download links (to `GET /api/materials/[materialId]/download`)
- [ ] **[Next.js]** Add delete material functionality with confirmation modal — calls `DELETE /api/materials/[materialId]`

### 3E — Student Lesson View

- [ ] **[Next.js]** Build lesson content viewer (renders Markdown content) — fetches from `GET /api/lessons/[lessonId]`
- [ ] **[Next.js]** Display attached materials with download buttons
- [ ] **[Next.js]** Build lesson navigation (prev/next within module)
- [ ] **[Next.js]** Highlight current lesson in sidebar

### 3F — Admin Dashboard

- [ ] **[Next.js]** Build Admin user management page (`app/(dashboard)/admin/users/page.tsx`) — fetches from `GET /api/users`
- [ ] **[Next.js]** Display user table with role badges and status
- [ ] **[Next.js]** Add ability to deactivate/reactivate users — calls `DELETE /api/users/[userId]` or `PATCH /api/users/[userId]`
- [ ] **[Next.js]** Show platform statistics (total users, courses, enrollments) — fetch counts via a dedicated `GET /api/admin/stats` route handler or Server Component with direct Prisma queries

---

## Phase 4: Gemini AI Integration (Next.js Backend)

> Wire up the Google Gemini API for the AI Tutor feature using the **`@google/genai` Node.js SDK** within Next.js Route Handlers. Gemini's massive context window allows us to pass uploaded PDF documents directly as context — no vector stores or embeddings needed.

### 4A — Gemini Service Layer

- [ ] **[Next.js API]** Install `@google/genai` SDK (`npm install @google/genai`)
- [ ] **[Next.js API]** Add `GEMINI_API_KEY` to `.env.local` and validate at startup in `lib/gemini/client.ts`
- [ ] **[Next.js API]** Create `lib/gemini/gemini.service.ts` as a centralized wrapper for all Gemini API interactions
- [ ] **[Next.js API]** Configure the Gemini client: instantiate `GoogleGenAI` with `apiKey` from environment variable
- [ ] **[Next.js API]** Select model: use `gemini-2.0-flash` for fast/free-tier responses, with `gemini-1.5-pro` as a configurable option

### 4B — Gemini File API Integration

- [ ] **[Next.js API]** Implement `uploadFileToGemini(filePath: string, displayName: string)` using `ai.files.upload({ file: filePath, config: { displayName } })` → returns `file.uri` and `file.name`
- [ ] **[Next.js API]** Implement `getGeminiFile(fileName: string)` using `ai.files.get({ name })` → check file state (`ACTIVE` vs `PROCESSING`)
- [ ] **[Next.js API]** Implement `deleteGeminiFile(fileName: string)` using `ai.files.delete({ name })`
- [ ] **[Next.js API]** Implement `listGeminiFiles()` for debugging/admin purposes
- [ ] **[Next.js API]** Handle file processing wait: poll `ai.files.get()` until `state === "ACTIVE"` before using in chat (with `setTimeout`-based polling and a max timeout)
- [ ] **[Next.js API]** Handle Gemini File API errors (file too large, unsupported format, quota exceeded) with graceful error responses

### 4C — Course AI Setup Endpoint

- [ ] **[Next.js API]** Implement `POST /api/courses/[courseId]/setup-ai` route handler (`app/api/courses/[courseId]/setup-ai/route.ts`):
  - Iterates through all course materials (PDFs) via Prisma query
  - Uploads each to Gemini via `ai.files.upload()`
  - Stores returned `file.uri` in `materials.geminiFileUri` via Prisma update
  - Sets `courses.aiEnabled = true` via Prisma update
  - Returns count of files uploaded and their status
- [ ] **[Next.js API]** Update material upload flow: auto-upload new PDFs to Gemini if `course.aiEnabled === true`, save `geminiFileUri`
- [ ] **[Next.js API]** Update material delete flow: call `ai.files.delete()` if `geminiFileUri` exists, then clear the field in Prisma
- [ ] **[Next.js API]** Update course delete flow: delete all Gemini files associated with course materials before Prisma cascade delete
- [ ] **[Next.js API]** Add async handling for file uploads (Gemini File API can be slow for large PDFs) — consider using a background job pattern or streaming progress

### 4D — Chat Session & Message Handling

- [ ] **[Next.js API]** Create system prompt template for the AI Tutor (`lib/gemini/prompts.ts`): _"You are a helpful tutor for the course '{courseTitle}'. Answer questions based ONLY on the provided course materials. If the answer is not in the materials, say so clearly. Cite specific sections where possible."_
- [ ] **[Next.js API]** Implement chat logic in `lib/gemini/gemini.service.ts`:
  1. Load all `geminiFileUri` references for the course's materials via Prisma
  2. Build the `contents` array: system instruction + file references (as `Part` objects with `fileData: { fileUri }`) + conversation history from `chat_messages`
  3. Call `ai.models.generateContent({ model, contents, config: { systemInstruction } })` (or use chat sessions with `ai.chats.create()`)
  4. Return the assistant response text
- [ ] **[Next.js API]** Handle Gemini-specific response parsing: extract `response.text`, handle `finishReason`, safety ratings
- [ ] **[Next.js API]** Implement token counting awareness: log `response.usageMetadata` (promptTokenCount, candidatesTokenCount)
- [ ] **[Next.js API]** Handle Gemini API errors gracefully (rate limits `429`, safety blocks, context length exceeded, network timeouts)
- [ ] **[Next.js API]** Add retry logic with exponential backoff for transient Gemini API failures

### 4E — Chat CRUD Endpoints

- [ ] **[Next.js API]** Create Zod validation schemas (`lib/validations/chat.ts` — `threadCreateSchema`, `askMessageSchema`)
- [ ] **[Next.js API]** Create chat service module (`lib/services/chat.service.ts`) — orchestrates between Prisma queries and Gemini service
- [ ] **[Next.js API]** Implement `POST /api/courses/[courseId]/chat/threads` route handler (`app/api/courses/[courseId]/chat/threads/route.ts`) — create a new local thread via Prisma
- [ ] **[Next.js API]** Implement `GET /api/courses/[courseId]/chat/threads` route handler — list student's threads for this course via Prisma
- [ ] **[Next.js API]** Implement `GET /api/chat/threads/[threadId]/messages` route handler (`app/api/chat/threads/[threadId]/messages/route.ts`) — get conversation history via Prisma
- [ ] **[Next.js API]** Implement `POST /api/chat/threads/[threadId]/ask` route handler (`app/api/chat/threads/[threadId]/ask/route.ts`):
  1. Validate enrollment + `aiEnabled` on course via Prisma
  2. Save user message to `ChatMessage` via Prisma
  3. Load full thread history from `ChatMessage` via Prisma
  4. Load course material file references (`geminiFileUri` list) via Prisma
  5. Call Gemini `generateContent` with system prompt + files + history using `@google/genai`
  6. Save assistant response to `ChatMessage` via Prisma
  7. Return both messages
- [ ] **[Next.js API]** Implement `DELETE /api/chat/threads/[threadId]` route handler — delete thread via Prisma cascade (deletes messages)
- [ ] **[Next.js API]** Add enrollment validation: student must be enrolled in the course to chat (reuse `checkEnrollment` helper)
- [ ] **[Next.js API]** Add course AI readiness check: verify `aiEnabled === true` and at least one material has `geminiFileUri` before allowing chat

---

## Phase 5: AI Tutor Chat UI (Frontend)

> Build the chat interface that students use to interact with the Gemini-powered AI Tutor. All API calls go to internal Next.js API routes (`/api/...`).

### 5A — Chat Interface

- [ ] **[Next.js]** Build Chat panel/page (`app/(dashboard)/courses/[courseId]/chat/page.tsx`)
- [ ] **[Next.js]** Build thread sidebar (list of previous conversations with create-new button) — fetches from `GET /api/courses/[courseId]/chat/threads`
- [ ] **[Next.js]** Build chat message list with role-based styling (user messages right-aligned, assistant left-aligned)
- [ ] **[Next.js]** Build message input with send button and Enter-to-submit — posts to `POST /api/chat/threads/[threadId]/ask`
- [ ] **[Next.js]** Render Markdown in assistant responses (code blocks, lists, bold, LaTeX math via `react-markdown` + `remark-math` + `rehype-katex`)
- [ ] **[Next.js]** Show loading/typing indicator while waiting for Gemini response
- [ ] **[Next.js]** Auto-scroll to latest message
- [ ] **[Next.js]** Handle error states (AI unavailable, rate limits, safety filters, network errors) with user-friendly messages

### 5B — Chat UX Polish

- [ ] **[Next.js]** Add "AI Tutor not configured" empty state when course has `aiEnabled === false`
- [ ] **[Next.js]** Add thread delete with confirmation — calls `DELETE /api/chat/threads/[threadId]`
- [ ] **[Next.js]** Add "Ask AI Tutor" button on lesson pages (opens chat with course context)
- [ ] **[Next.js]** Mobile-responsive chat layout (full-screen chat on mobile)
- [ ] **[Next.js]** Add keyboard shortcuts (Ctrl+Enter to send, Escape to close)
- [ ] **[Next.js]** Display Gemini safety filter warnings gracefully when a response is blocked

### 5C — Teacher AI Management

- [ ] **[Next.js]** Add "Setup AI Tutor" button on course edit page — calls `POST /api/courses/[courseId]/setup-ai`
- [ ] **[Next.js]** Show AI tutor status indicator (enabled / not enabled)
- [ ] **[Next.js]** Show which materials are synced to Gemini (`geminiFileUri` badge — synced ✓ / not synced ✗)
- [ ] **[Next.js]** Add "Re-sync Materials" action to re-upload files after updates
- [ ] **[Next.js]** Show file processing status (PROCESSING → ACTIVE) with auto-refresh polling

---

## Phase 6: Testing, Polish & Deployment

> Harden the platform with testing, UX polish, and deployment readiness.

### 6A — Backend Testing

- [ ] **[Next.js API]** Write integration tests for all CRUD Route Handlers (using Vitest + `next/test-utils` or direct `fetch` calls against test server)
- [ ] **[Next.js API]** Write unit tests for service modules (mock PrismaClient and Gemini SDK with `vi.mock`)
- [ ] **[Next.js API]** Test auth flow end-to-end (register → login → access protected routes)
- [ ] **[Next.js API]** Test role-based access control (ADMIN vs TEACHER vs STUDENT)
- [ ] **[Next.js API]** Test file upload/download flows
- [ ] **[Next.js API]** Test enrollment-gated access to lessons and chat
- [ ] **[Next.js API]** Test Gemini integration with a live API key (smoke test: upload a PDF, ask a question, verify response)

### 6B — Frontend Testing & UX

- [ ] **[Next.js]** Add form validation with user-friendly error messages on all forms (Zod + React Hook Form)
- [ ] **[Next.js]** Implement optimistic UI updates where appropriate (e.g., enrollment toggle)
- [ ] **[Next.js]** Add loading skeletons (Shadcn `Skeleton`) for all data-fetching pages
- [ ] **[Next.js]** Ensure full keyboard navigation and accessibility (ARIA labels, focus management)
- [ ] **[Next.js]** Test responsive layouts on mobile, tablet, and desktop

### 6C — Deployment

- [ ] **[Docker]** Create `Dockerfile` for the Next.js fullstack application (multi-stage build: install → build → production)
- [ ] **[Docker]** Update `docker-compose.yml` to orchestrate all services (Next.js App + PostgreSQL + optional pgAdmin)
- [ ] **[Prisma]** Add `prisma migrate deploy` to the Docker entrypoint/startup script for production migrations
- [ ] **[Next.js]** Configure production environment variables (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`)
- [ ] **[CI/CD]** Set up GitHub Actions pipeline: lint (`next lint`) → test (`vitest run`) → build (`next build`) → deploy
- [ ] **[Docs]** Create `README.md` with setup instructions, architecture diagram, environment variable reference, and API docs link

---

## Project Structure

```
improved-E-learning/
├── app/
│   ├── layout.tsx                           # Root layout
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
│   │   │       ├── edit/page.tsx            # Edit course
│   │   │       └── chat/page.tsx            # AI Tutor chat
│   │   ├── my-courses/page.tsx
│   │   └── admin/
│   │       └── users/page.tsx
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
│       │       ├── enroll/route.ts           # POST, DELETE
│       │       ├── students/route.ts        # GET
│       │       ├── modules/
│       │       │   ├── route.ts             # GET, POST
│       │       │   └── [moduleId]/route.ts  # PATCH, DELETE
│       │       └── chat/
│       │           └── threads/route.ts     # GET, POST
│       ├── modules/
│       │   └── [moduleId]/
│       │       └── lessons/route.ts         # GET, POST
│       ├── lessons/
│       │   ├── [lessonId]/
│       │   │   ├── route.ts                 # GET, PATCH, DELETE
│       │   │   └── materials/
│       │   │       ├── route.ts             # GET
│       │   │       └── upload/route.ts      # POST
│       ├── materials/
│       │   └── [materialId]/
│       │       ├── route.ts                 # DELETE
│       │       └── download/route.ts        # GET
│       ├── enrollments/
│       │   └── my/route.ts                  # GET
│       └── chat/
│           └── threads/
│               └── [threadId]/
│                   ├── route.ts             # DELETE
│                   ├── messages/route.ts     # GET
│                   └── ask/route.ts          # POST
├── components/
│   ├── ui/                                  # Shadcn UI components
│   ├── layout/                              # Sidebar, Navbar
│   ├── courses/                             # Course-specific components
│   ├── chat/                                # Chat-specific components
│   └── shared/                              # Reusable components
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useCourses.ts
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
│   │   ├── check-ownership.ts              # Course ownership check
│   │   └── check-enrollment.ts             # Enrollment check
│   ├── validations/
│   │   ├── auth.ts                          # Zod schemas
│   │   ├── user.ts
│   │   ├── course.ts
│   │   ├── module.ts
│   │   ├── lesson.ts
│   │   ├── material.ts
│   │   ├── enrollment.ts
│   │   └── chat.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── course.service.ts
│   │   ├── module.service.ts
│   │   ├── lesson.service.ts
│   │   ├── material.service.ts
│   │   ├── enrollment.service.ts
│   │   └── chat.service.ts
│   └── gemini/
│       ├── client.ts                        # GoogleGenAI instance
│       ├── gemini.service.ts                # File upload, chat, etc.
│       └── prompts.ts                       # System prompt templates
├── prisma/
│   ├── schema.prisma                        # Database schema
│   └── migrations/                          # Auto-generated migrations
├── public/
│   └── uploads/                             # Local file storage (dev)
├── middleware.ts                             # Next.js route protection
├── .env.local                               # Environment variables
├── docker-compose.yml                       # PostgreSQL + pgAdmin
├── Dockerfile                               # Next.js production build
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
      Phase 6 (Testing & Deploy)
```

> **Note:** Since this is a fullstack monolith, Phase 2 (API Routes) and Phase 3 (Frontend UI) can be developed **in parallel** by the same developer or split across team members. Phase 4 (Gemini backend) and Phase 5 (Chat UI) must wait for their respective foundations.

---

## Estimated Timeline

| Phase | Effort | Depends On |
|---|---|---|
| Phase 0 — Foundation | 1 day | — |
| Phase 1 — Schema & Auth | 2-3 days | Phase 0 |
| Phase 2 — LMS APIs | 3-4 days | Phase 1 |
| Phase 3 — LMS UI | 4-5 days | Phase 1C + Phase 2 |
| Phase 4 — Gemini AI | 2-3 days | Phase 2 |
| Phase 5 — Chat UI | 3-4 days | Phase 3 + Phase 4 |
| Phase 6 — Testing & Deploy | 2-3 days | All |
| **Total** | **~17-23 days** | |

> **Note:** The fullstack monolith architecture saves ~3-4 days compared to the v2.0 plan because: (1) no separate FastAPI service to build, configure, and deploy; (2) no CORS or inter-service communication setup; (3) shared TypeScript types eliminate schema duplication; (4) Prisma migrations are faster to iterate on than SQLAlchemy/Alembic.
