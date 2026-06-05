# AGENTS.md — LearnAI LMS (Codex System Prompt)

> **Last Updated:** 2026-06-04
> **Purpose:** Master context file for AI coding assistants working on this project.

---

## 1. Project Overview

**LearnAI** is a minimalist Learning Management System (LMS) web application similar to Coursera, with an integrated AI Tutor powered by Google Gemini. Students can browse courses, enroll, study lesson content, download materials, and ask an AI assistant questions grounded in the course's uploaded PDF documents.

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, TypeScript) — fullstack monolith |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma ORM (`prisma/schema.prisma`) |
| **Styling** | Tailwind CSS + Shadcn UI |
| **Authentication** | Custom JWT (`jose` + `bcryptjs`) — dual-delivery: HTTP-only cookie + `localStorage` |
| **AI Integration** | Google Gemini Node.js SDK (`@google/genai`) — **Phase 4, not yet started** |
| **Validation** | Zod v4 (shared between API routes and frontend forms) |
| **File Uploads** | Native `request.formData()` Web API + local filesystem storage adapter |

### Architecture

This is a **100% Next.js fullstack monolith**. There is no separate backend service. All API logic lives in Next.js Route Handlers (`app/api/`), and all database access goes through Prisma. The Gemini AI service will be integrated as a backend service module (`lib/gemini/`) within this same Next.js application.

---

## 2. Current State

### Completed Phases (100%)

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Project Foundation & DevOps (Next.js init, Prisma init, Docker, layouts) | ✅ Complete |
| **Phase 1** | Database Schema & Auth System (Prisma models, JWT auth, auth UI) | ✅ Complete |
| **Phase 2** | Core LMS APIs (User, Course, Module, Lesson, Material, Enrollment CRUD) | ✅ Complete |
| **Phase 3** | Frontend LMS UI (all pages, dashboards, lesson views, material management) | ✅ Complete |

### Current Phase

**Phase 4: Gemini AI Integration** — We are starting this phase now. The detailed task breakdown is in `docs/03-implementation-plan.md` (sections 4A through 4E).

### Upcoming Phases

| Phase | Description |
|---|---|
| **Phase 5** | AI Tutor Chat UI (Frontend chat interface for students) |
| **Phase 6** | Testing, Polish & Deployment |

---

## 3. Database Schema

The full schema is defined in `prisma/schema.prisma` and documented in `docs/01-database-schema.md`.

### Models (10 total)

| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | All platform users (ADMIN, TEACHER, STUDENT) |
| `Course` | `courses` | Courses owned by teachers; `aiEnabled` flag for Gemini integration |
| `Module` | `modules` | Logical groupings within a course (ordered by `orderIndex`) |
| `Lesson` | `lessons` | Individual learning units within a module (ordered by `orderIndex`) |
| `Material` | `materials` | Uploaded files (PDFs); `geminiFileUri` stores the Gemini File API URI |
| `Enrollment` | `enrollments` | Student ↔ Course join table (ACTIVE / COMPLETED / DROPPED) |
| `ChatThread` | `chat_threads` | Per student×course chat thread for AI Tutor |
| `ChatMessage` | `chat_messages` | Individual messages in a thread (`role`: "user" or "model") |
| `LessonProgress` | `lesson_progress` | Tracks lesson completion per student (`isCompleted` boolean) |

### Key Relations

- `User` 1:N → `Course` (teacher owns courses)
- `Course` 1:N → `Module` 1:N → `Lesson` 1:N → `Material`
- `User` N:M ↔ `Course` (via `Enrollment`)
- `User` N:M ↔ `Lesson` (via `LessonProgress`)
- `User` + `Course` → `ChatThread` 1:N → `ChatMessage`

---

## 4. Coding Rules (STRICT)

### 4.1 — Next.js App Router Conventions

- **ALWAYS** use Next.js App Router conventions. All pages live in `app/`, all API routes in `app/api/`.
- Route Handlers use `export async function GET/POST/PATCH/PUT/DELETE(request)` pattern.
- All interactive/stateful components must be explicitly marked with `"use client"` at the top of the file.
- Use `next/dynamic` with `{ ssr: false }` for any library that accesses `window` at import time (e.g., markdown editors, PDF viewers).

### 4.2 — Data Fetching Strategy

- **Prefer Server Components and direct Prisma queries** for fetching data on initial page loads (read-only rendering). This avoids unnecessary API round-trips.
- **Use API Routes (`app/api/`) only for:**
  - Mutations (POST / PUT / PATCH / DELETE)
  - Client-side fetching needs (e.g., interactive dashboards with `useApi` hooks)
  - Endpoints that external clients or the Gemini service may call
- **Never** import `PrismaClient` in a `"use client"` component. Prisma is server-only.

### 4.3 — Service Layer Pattern

- All database operations are encapsulated in `lib/services/*.service.ts` files.
- Route handlers call service functions — they never import `prisma` directly (exception: lightweight `fetchCourseGate` inline checks for auditability).
- The Gemini integration should follow the same pattern: `lib/gemini/gemini.service.ts` wraps all Gemini SDK calls.

### 4.4 — Validation & Type Safety

- All input validation uses **Zod v4** schemas in `lib/validations/*.ts`.
- Zod v4 API: use `{ error: "..." }` (not `required_error`), and `ZodError.issues` (not `.errors`).
- Zero `any` types. All types must flow from Prisma's generated types or Zod's inferred types.
- Share types between API routes and frontend components using `z.input<>` and `z.output<>`.

### 4.5 — API Response Format

All API responses must use the standardized helpers from `lib/api-response.ts`:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "message": "Detailed error description",
  "errors": [{ "field": "email", "message": "..." }]
}
```

### 4.6 — Security: Zero Trust at Every Endpoint

- Every route handler **independently enforces** its own access policy (auth + role + ownership checks).
- No endpoint assumes a prior request validated authorization.
- Return `404 Not Found` (not `403 Forbidden`) for unpublished resources accessed by non-owners to prevent enumeration attacks.
- Use `fetchCourseGate` (minimal 2-column `SELECT`) for publication/ownership checks.

### 4.7 — UI & Theme

- **Color Palette:** Sky Blue primary, White/Light Gray backgrounds. Professional, academic aesthetic.
- **Component Library:** Maximize reuse of Shadcn UI components.
- **Never hardcode text** from reference screenshots. All content must be dynamic from the database.
- All Shadcn interactive components must be `"use client"`.

### 4.8 — Error Handling

- All Route Handlers use the `lib/api-handler.ts` try-catch wrapper.
- All client-side API calls handle loading and error states gracefully.
- Handle Gemini-specific errors: rate limits (429), safety blocks, context length exceeded, file processing states.

---

## 5. Architecture Rule (CRITICAL)

> **Whenever a significant architectural decision, database schema change, or library addition is made, you MUST document it by writing a brief summary into `docs/04-architecture-decisions.md`.**

Follow the existing ADR format:

```markdown
## ADR-NNN · [Title]

**Date:** YYYY-MM-DD
**Phase:** [Phase reference]
**Status:** Adopted

### Context
[Why was this decision needed?]

### Decision
[What was decided and how is it implemented?]

### Rationale
[Why this approach over alternatives?]
```

The file currently contains ADR-001 through ADR-010. The next entry should be **ADR-011**.

---

## 6. Project Structure (Key Directories)

```
client/
├── app/
│   ├── (auth)/              # Login, Register pages
│   ├── (dashboard)/         # All authenticated pages
│   │   ├── dashboard/       # Role-based dashboard hub
│   │   ├── courses/         # Catalog, detail, edit, lesson views
│   │   ├── my-courses/      # Student's enrolled / Teacher's owned courses
│   │   └── admin/           # User management, analytics
│   └── api/                 # All Route Handlers (REST API)
├── components/
│   ├── ui/                  # Shadcn UI primitives
│   ├── dashboard/           # Role-specific dashboard components
│   ├── curriculum/          # Module/Lesson editor components
│   ├── analytics/           # Chart components
│   └── ...
├── contexts/
│   └── AuthContext.tsx       # JWT auth state provider
├── hooks/
│   ├── useAuth.ts           # Auth hook
│   └── useApi.ts            # Authenticated fetch wrapper
├── lib/
│   ├── prisma.ts            # PrismaClient singleton + BigInt.toJSON patch
│   ├── api-response.ts      # Standardized response helpers
│   ├── api-handler.ts       # Route Handler error wrapper
│   ├── auth/                # JWT, password, role guards, ownership checks
│   ├── validations/         # Zod schemas (auth, user, course, module, lesson, material, enrollment)
│   ├── services/            # Database service layer (one per model)
│   └── gemini/              # [PHASE 4] Gemini SDK wrapper, prompts, file management
├── prisma/
│   └── schema.prisma        # Database schema (source of truth)
├── public/uploads/          # Local file storage (dev)
├── middleware.ts             # Route protection (JWT from cookie)
└── docs/                    # Project documentation (../docs/ from client root)
    ├── 00-instructions.md   # Project persona & scope
    ├── 01-database-schema.md # Full schema documentation
    ├── 02-api-contracts.md   # REST API contracts
    ├── 03-implementation-plan.md # Phased implementation plan
    └── 04-architecture-decisions.md # ADR log
```

---

## 7. Phase 4 Quick Reference

Phase 4 introduces the Google Gemini AI backend integration. The full task breakdown is in `docs/03-implementation-plan.md` (sections 4A–4E).

### Summary of Sub-Phases

| Sub-Phase | Focus |
|---|---|
| **4A** | Gemini Service Layer — install `@google/genai`, create client, configure model selection |
| **4B** | Gemini File API — upload/get/delete/list files, handle processing states |
| **4C** | Course AI Setup — `POST /api/courses/[courseId]/setup-ai`, auto-sync materials |
| **4D** | Chat Session — system prompt, content assembly (files + history), `generateContent` call |
| **4E** | Chat CRUD Endpoints — thread/message CRUD, enrollment validation, AI readiness checks |

### Key Technical Notes for Gemini Integration

1. **SDK:** Use `@google/genai` (not the deprecated `@google/generative-ai`).
2. **Model:** Use `gemini-3.1-flash-lite` — fast, cost-effective, and optimized for grounded Q&A tasks.
3. **Context Window:** Gemini models support large context windows — large enough to pass full PDFs directly. No vector stores or embeddings needed.
4. **File API:** Upload PDFs via `ai.files.upload()`, get the `file.uri`, store in `Material.geminiFileUri`. Poll `ai.files.get()` until `state === "ACTIVE"` before using in chat.
5. **Chat Architecture:** Conversation history is stored locally in `ChatMessage`. On each `/ask` request, rebuild the full context: system prompt + file URIs + message history, then call `generateContent`.
6. **Service Module:** All Gemini logic goes in `lib/gemini/gemini.service.ts`. Route handlers call service functions.

---

## 8. Reference Documents

| Document | Path | Description |
|---|---|---|
| Project Instructions | `docs/00-instructions.md` | Persona, objective, scope, tech stack, design principles |
| Database Schema | `docs/01-database-schema.md` | All 9 tables with columns, types, constraints, SQL DDL |
| API Contracts | `docs/02-api-contracts.md` | REST API endpoints with request/response examples |
| Implementation Plan | `docs/03-implementation-plan.md` | Full phased task breakdown with completion status |
| Architecture Decisions | `docs/04-architecture-decisions.md` | ADR log (ADR-001 through ADR-010) |
| Prisma Schema | `prisma/schema.prisma` | Source of truth for database models |

---

## 9. Common Gotchas

1. **BigInt serialization:** `Material.fileSizeBytes` is `BigInt`. A global `BigInt.prototype.toJSON` patch in `lib/prisma.ts` handles serialization. Do not add per-route casting.
2. **Zod v4:** Use `{ error: "..." }` not `{ required_error: "..." }`. Use `.issues` not `.errors`.
3. **SSR + browser-only libraries:** Use `next/dynamic({ ssr: false })` for any library that reads `window` at import time.
4. **File upload:** Use native `request.formData()` — no multer/formidable. Storage adapter is in `lib/services/storage.service.ts`.
5. **Upload progress:** The upload UI uses `XMLHttpRequest` (not `fetch`) for `xhr.upload.onprogress`.
6. **Auth token:** Dual delivery — HTTP-only cookie (`auth_token`) for middleware/SSR, `localStorage` (`lms_auth_token`) for client-side `fetch` via `useApi` hook.
7. **Module/Lesson ordering:** `orderIndex` is auto-calculated server-side (`max + 1`). Client never sets it during creation. Reorder via `PUT` with ordered IDs array.
