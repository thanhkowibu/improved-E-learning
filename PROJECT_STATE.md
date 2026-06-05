# PROJECT_STATE.md — LearnAI LMS

> **Last Updated:** 2026-06-04
> **Purpose:** Quick-reference snapshot of the project's current state for onboarding new AI assistants or resuming work after a break.

---

## Phase Progress

| Phase | Name | Status | Notes |
|---|---|---|---|
| **0** | Project Foundation & DevOps | ✅ Complete | Next.js 15, Prisma, Docker, layouts, API helpers |
| **1** | Database Schema & Auth | ✅ Complete | 10 Prisma models, JWT auth (dual-delivery), auth UI |
| **2** | Core LMS APIs | ✅ Complete | Full CRUD for Users, Courses, Modules, Lessons, Materials, Enrollments |
| **3** | Frontend LMS UI | ✅ Complete | All pages, dashboards, lesson views, material management, analytics |
| **4** | Gemini AI Integration | 🔲 Not Started | **← START HERE** |
| **5** | AI Tutor Chat UI | 🔲 Not Started | Depends on Phase 4 |
| **6** | Testing, Polish & Deployment | 🔲 Not Started | Depends on all phases |

---

## Database Models (10)

All models are defined in `client/prisma/schema.prisma` and documented in `docs/01-database-schema.md`.

| # | Model | Table | Key Fields |
|---|---|---|---|
| 1 | `User` | `users` | email, hashedPassword, fullName, role (ADMIN/TEACHER/STUDENT), isActive |
| 2 | `Course` | `courses` | title, description, teacherId (FK→User), aiEnabled, isPublished |
| 3 | `Module` | `modules` | courseId (FK→Course), title, orderIndex |
| 4 | `Lesson` | `lessons` | moduleId (FK→Module), title, content, orderIndex |
| 5 | `Material` | `materials` | lessonId (FK→Lesson), title, materialType, fileUrl, fileSizeBytes (BigInt), geminiFileUri |
| 6 | `Enrollment` | `enrollments` | studentId (FK→User), courseId (FK→Course), status, @@unique([studentId, courseId]) |
| 7 | `ChatThread` | `chat_threads` | studentId (FK→User), courseId (FK→Course), title |
| 8 | `ChatMessage` | `chat_messages` | threadId (FK→ChatThread), role ("user"/"model"), content |
| 9 | `LessonProgress` | `lesson_progress` | studentId (FK→User), lessonId (FK→Lesson), isCompleted, @@unique([studentId, lessonId]) |

> **Note:** `ChatThread` and `ChatMessage` models exist in the schema but their API routes and UI are not yet implemented (Phase 4E & 5).

---

## Implemented API Routes

### Auth (`/api/auth/`)
| Method | Route | Status |
|---|---|---|
| POST | `/api/auth/register` | ✅ |
| POST | `/api/auth/login` | ✅ |
| GET | `/api/auth/me` | ✅ |

### Users (`/api/users/`)
| Method | Route | Status |
|---|---|---|
| GET | `/api/users` | ✅ (ADMIN) |
| GET | `/api/users/[userId]` | ✅ (ADMIN/self) |
| PATCH | `/api/users/[userId]` | ✅ (ADMIN/self) |
| DELETE | `/api/users/[userId]` | ✅ (ADMIN, soft-delete) |

### Courses (`/api/courses/`)
| Method | Route | Status |
|---|---|---|
| POST | `/api/courses` | ✅ (TEACHER/ADMIN) |
| GET | `/api/courses` | ✅ (public: published, owner: own, admin: all) |
| GET | `/api/courses/[courseId]` | ✅ |
| PATCH | `/api/courses/[courseId]` | ✅ (owner/ADMIN) |
| DELETE | `/api/courses/[courseId]` | ✅ (owner/ADMIN) |
| POST | `/api/courses/[courseId]/enroll` | ✅ (STUDENT) |
| DELETE | `/api/courses/[courseId]/enroll` | ✅ (STUDENT) |
| GET | `/api/courses/[courseId]/students` | ✅ (owner/ADMIN) |
| GET | `/api/courses/[courseId]/progress` | ✅ (enrolled STUDENT) |

### Modules (`/api/courses/[courseId]/modules/`)
| Method | Route | Status |
|---|---|---|
| POST | `/api/courses/[courseId]/modules` | ✅ |
| GET | `/api/courses/[courseId]/modules` | ✅ |
| PATCH | `/api/courses/[courseId]/modules/[moduleId]` | ✅ |
| PUT | `/api/courses/[courseId]/modules` | ✅ (reorder) |
| DELETE | `/api/courses/[courseId]/modules/[moduleId]` | ✅ |

### Lessons (`/api/lessons/`)
| Method | Route | Status |
|---|---|---|
| POST | `/api/modules/[moduleId]/lessons` | ✅ |
| GET | `/api/modules/[moduleId]/lessons` | ✅ |
| GET | `/api/lessons/[lessonId]` | ✅ |
| PATCH | `/api/lessons/[lessonId]` | ✅ |
| DELETE | `/api/lessons/[lessonId]` | ✅ |
| GET | `/api/lessons/[lessonId]/progress` | ✅ (STUDENT) |
| POST | `/api/lessons/[lessonId]/progress` | ✅ (STUDENT, upsert) |

### Materials (`/api/materials/`)
| Method | Route | Status |
|---|---|---|
| POST | `/api/lessons/[lessonId]/materials/upload` | ✅ (multipart/form-data) |
| GET | `/api/lessons/[lessonId]/materials` | ✅ |
| GET | `/api/materials/[materialId]/download` | ✅ (file stream) |
| DELETE | `/api/materials/[materialId]` | ✅ |

### Enrollments
| Method | Route | Status |
|---|---|---|
| GET | `/api/enrollments/my` | ✅ (STUDENT) |

### AI Tutor Chat (Phase 4E — NOT YET IMPLEMENTED)
| Method | Route | Status |
|---|---|---|
| POST | `/api/courses/[courseId]/setup-ai` | 🔲 |
| POST | `/api/courses/[courseId]/chat/threads` | 🔲 |
| GET | `/api/courses/[courseId]/chat/threads` | 🔲 |
| GET | `/api/chat/threads/[threadId]/messages` | 🔲 |
| POST | `/api/chat/threads/[threadId]/ask` | 🔲 |
| DELETE | `/api/chat/threads/[threadId]` | 🔲 |

---

## Implemented Pages

| Route | Type | Description |
|---|---|---|
| `/login` | Auth | Login form (Zod + React Hook Form) |
| `/register` | Auth | Registration with role selection |
| `/dashboard` | Client | Role-based hub → `StudentDashboard` / `TeacherDashboard` / `AdminDashboard` |
| `/courses` | Dashboard | Course catalog (grid, search, pagination) |
| `/courses/new` | Dashboard | Create course form (TEACHER/ADMIN) |
| `/courses/[courseId]` | Dashboard | Course detail with module/lesson sidebar |
| `/courses/[courseId]/edit` | Dashboard | Edit course + CurriculumEditor (modules/lessons) |
| `/courses/[courseId]/learn` | Dashboard | Student learning view |
| `/courses/[courseId]/lessons/[lessonId]` | Dashboard | Lesson content viewer with materials & progress |
| `/my-courses` | Dashboard | Enrolled courses (STUDENT) / Owned courses (TEACHER) |
| `/admin/users` | Dashboard | User management table (ADMIN) |
| `/admin/analytics` | Server Component | Analytics charts (direct Prisma queries) |

---

## Key Dependencies

```json
{
  "next": "15.x",
  "react": "19.x",
  "prisma": "^6.x",
  "@prisma/client": "^6.x",
  "jose": "^5.x",
  "bcryptjs": "^3.x",
  "zod": "^4.x",
  "@uiw/react-md-editor": "^4.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^10.x",
  "recharts": "^2.x",
  "sonner": "^2.x",
  "lucide-react": "latest"
}
```

> **Not yet installed:** `@google/genai` (Phase 4A)

---

## Environment Variables

| Variable | Purpose | Required By |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Prisma |
| `JWT_SECRET` | HMAC key for JWT signing (jose HS256) | Auth system |
| `NEXT_PUBLIC_APP_URL` | App base URL for client-side | Frontend |
| `GEMINI_API_KEY` | Google Gemini API key | Phase 4 (not yet configured) |

---

## AI Model Configuration

| Setting | Value |
|---|---|
| **SDK** | `@google/genai` |
| **Model** | `gemini-3.1-flash-lite` |
| **Architecture** | Stateless per-request: system prompt + file URIs + full chat history → `generateContent` |
| **File Handling** | Upload PDFs via File API → store `geminiFileUri` in `Material` → pass as context |
| **Vector Store** | None needed — large context window handles full PDFs directly |

---

## Architecture Decisions Log

| ADR | Title | Phase |
|---|---|---|
| ADR-001 | Zero Trust / Defense in Depth | 2C |
| ADR-002 | JWT Dual-Delivery (localStorage + HTTP-only Cookie) | 1B |
| ADR-003 | Service Layer Pattern | 2A |
| ADR-004 | orderIndex Auto-Calculation | 2C/2D |
| ADR-005 | Zod v4 Migration | 1B |
| ADR-006 | Storage Adapter Pattern + Native Web API | 2E |
| ADR-007 | BigInt JSON Serialization | 2E |
| ADR-008 | CurriculumEditor SSR Safety & State Decoupling | 3C |
| ADR-009 | XMLHttpRequest for Upload Progress | 3D |
| ADR-010 | LessonProgress Model & Hybrid Dashboard Fetching | 3E/3F |

Full details in `docs/04-architecture-decisions.md`. Next entry should be **ADR-011**.

---

## What's Next: Phase 4 (Gemini AI Integration)

Start with `docs/03-implementation-plan.md` §4A–4E. In summary:

1. **4A** — Install `@google/genai`, create `lib/gemini/client.ts`, configure `gemini-3.1-flash-lite`
2. **4B** — Implement Gemini File API wrappers (upload/get/delete/list + polling for ACTIVE state)
3. **4C** — Build `POST /api/courses/[courseId]/setup-ai` (bulk-upload materials, set `aiEnabled`)
4. **4D** — Build chat logic: system prompt + file context + history → `generateContent`
5. **4E** — Build chat CRUD endpoints (threads, messages, `/ask`)
