# Implementation Plan — E-Learning LMS

> **Version:** 2.0  
> **Last Updated:** 2026-05-18  
> **Strategy:** Core LMS first → AI integration later  
> **Stack:** FastAPI (backend) · Next.js 15 + App Router (frontend) · PostgreSQL · Google Gemini API (1.5 Pro / Flash)

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
> - `materials` table: Replace `openai_file_id` with `gemini_file_uri` (the URI returned by `genai.upload_file`).
> - `chat_threads` table: Remove `openai_thread_id` — conversation history is managed locally in `chat_messages` and rebuilt per request.
> - `chat_messages` table: Remove `openai_message_id` — no external message IDs needed.
> - Backend: Replace `openai` SDK with `google-generativeai` SDK.

---

## Phase 0: Project Foundation & DevOps

> Set up the development environment, tooling, and project configuration so all subsequent phases can proceed smoothly.

- [x] **[FastAPI]** Configure environment variables with `pydantic-settings` (`.env` file for `DATABASE_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `CORS_ORIGINS`)
- [x] **[FastAPI]** Set up SQLAlchemy async engine + session factory in `database.py` (using `asyncpg`)
- [x] **[FastAPI]** Create a `Base` declarative model and Alembic migration setup (`alembic init`, `alembic.ini`, `env.py`)
- [x] **[FastAPI]** Configure CORS middleware in `main.py` for Next.js frontend (`http://localhost:3000`)
- [x] **[FastAPI]** Set up structured logging (Python `logging` or `loguru`)
- [x] **[FastAPI]** Add global exception handlers (validation errors, 404, 500)
- [x] **[Next.js]** Install and configure HTTP client (`axios` or `fetch` wrapper) with base URL and auth interceptor
- [x] **[Next.js]** Set up environment variables (`.env.local` for `NEXT_PUBLIC_API_URL`)
- [x] **[Next.js]** Create shared layout structure (`/app/layout.tsx`, `/app/(auth)/layout.tsx`, `/app/(dashboard)/layout.tsx`)
- [x] **[Docker]** Create `docker-compose.yml` for PostgreSQL (+ optional pgAdmin)
- [x] **[Both]** Verify end-to-end connectivity: Next.js → FastAPI → PostgreSQL

---

## Phase 1: Database Models & Auth System

> Build the data layer and authentication so all subsequent CRUD operations have a foundation.

### 1A — SQLAlchemy Models

- [ ] **[FastAPI]** Create enum types: `UserRole`, `EnrollmentStatus`, `MaterialType` (Python enums mapped to PG enums)
- [ ] **[FastAPI]** Create `User` model (`models/user.py`) with all fields from schema
- [ ] **[FastAPI]** Create `Course` model (`models/course.py`) with FK to `users` — includes `ai_enabled` boolean flag (no external AI IDs needed)
- [ ] **[FastAPI]** Create `Module` model (`models/module.py`) with FK to `courses`
- [ ] **[FastAPI]** Create `Lesson` model (`models/lesson.py`) with FK to `modules`
- [ ] **[FastAPI]** Create `Material` model (`models/material.py`) with FK to `lessons`, includes `gemini_file_uri` (nullable, populated after Gemini File API upload)
- [ ] **[FastAPI]** Create `Enrollment` model (`models/enrollment.py`) with composite unique constraint
- [ ] **[FastAPI]** Create `ChatThread` model (`models/chat_thread.py`) — local-only thread tracking (no external thread ID)
- [ ] **[FastAPI]** Create `ChatMessage` model (`models/chat_message.py`) — stores `role` and `content` locally (no external message ID)
- [ ] **[FastAPI]** Define all relationships (`relationship()`, `back_populates`)
- [ ] **[FastAPI]** Generate and run initial Alembic migration (`alembic revision --autogenerate -m "initial"`)
- [ ] **[FastAPI]** Verify all tables are created correctly in PostgreSQL

### 1B — Authentication (JWT)

- [ ] **[FastAPI]** Install `python-jose[cryptography]` and `passlib[bcrypt]` dependencies
- [ ] **[FastAPI]** Create password hashing utilities (`services/auth.py` — `hash_password`, `verify_password`)
- [ ] **[FastAPI]** Create JWT utilities (`services/auth.py` — `create_access_token`, `decode_access_token`)
- [ ] **[FastAPI]** Create Pydantic schemas for auth (`schemas/auth.py` — `RegisterRequest`, `LoginRequest`, `TokenResponse`)
- [ ] **[FastAPI]** Create `get_current_user` dependency (parses JWT from `Authorization` header)
- [ ] **[FastAPI]** Create role-checker dependencies (`require_role(UserRole.ADMIN)`, `require_role(UserRole.TEACHER)`)
- [ ] **[FastAPI]** Implement `POST /api/v1/auth/register` endpoint
- [ ] **[FastAPI]** Implement `POST /api/v1/auth/login` endpoint
- [ ] **[FastAPI]** Implement `GET /api/v1/auth/me` endpoint
- [ ] **[FastAPI]** Write unit tests for auth (register, login, token validation, role guards)

### 1C — Auth UI

- [ ] **[Next.js]** Create auth context/provider (`AuthContext`) with JWT storage (`localStorage` or `httpOnly` cookie)
- [ ] **[Next.js]** Build Login page (`/app/(auth)/login/page.tsx`) with form validation
- [ ] **[Next.js]** Build Register page (`/app/(auth)/register/page.tsx`) with role selection
- [ ] **[Next.js]** Implement protected route middleware (redirect unauthenticated users)
- [ ] **[Next.js]** Create reusable `useAuth` hook
- [ ] **[Next.js]** Add user avatar/dropdown in navbar with logout

---

## Phase 2: Core LMS APIs (Backend)

> Build all CRUD endpoints for the learning management system.

### 2A — User Management

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/user.py` — `UserResponse`, `UserUpdate`, `UserListResponse`)
- [ ] **[FastAPI]** Create user repository (`repositories/user.py` — `get_by_id`, `get_all`, `update`, `deactivate`)
- [ ] **[FastAPI]** Create user service (`services/user.py`)
- [ ] **[FastAPI]** Implement `GET /api/v1/users` (ADMIN, paginated)
- [ ] **[FastAPI]** Implement `GET /api/v1/users/{user_id}` (ADMIN or self)
- [ ] **[FastAPI]** Implement `PATCH /api/v1/users/{user_id}` (ADMIN or self)
- [ ] **[FastAPI]** Implement `DELETE /api/v1/users/{user_id}` (ADMIN, soft-delete)

### 2B — Course CRUD

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/course.py` — `CourseCreate`, `CourseUpdate`, `CourseResponse`, `CourseDetailResponse`)
- [ ] **[FastAPI]** Create course repository (`repositories/course.py`)
- [ ] **[FastAPI]** Create course service (`services/course.py`)
- [ ] **[FastAPI]** Implement `POST /api/v1/courses` (TEACHER/ADMIN)
- [ ] **[FastAPI]** Implement `GET /api/v1/courses` (public/filtered, paginated, searchable)
- [ ] **[FastAPI]** Implement `GET /api/v1/courses/{course_id}` (with nested modules/lessons tree)
- [ ] **[FastAPI]** Implement `PATCH /api/v1/courses/{course_id}` (owner/ADMIN)
- [ ] **[FastAPI]** Implement `DELETE /api/v1/courses/{course_id}` (owner/ADMIN, cascade)
- [ ] **[FastAPI]** Add ownership validation middleware/dependency for course operations

### 2C — Module CRUD

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/module.py`)
- [ ] **[FastAPI]** Create module repository and service
- [ ] **[FastAPI]** Implement `POST /api/v1/courses/{course_id}/modules`
- [ ] **[FastAPI]** Implement `GET /api/v1/courses/{course_id}/modules`
- [ ] **[FastAPI]** Implement `PATCH /api/v1/courses/{course_id}/modules/{module_id}`
- [ ] **[FastAPI]** Implement `DELETE /api/v1/courses/{course_id}/modules/{module_id}`
- [ ] **[FastAPI]** Handle `order_index` reordering logic

### 2D — Lesson CRUD

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/lesson.py`)
- [ ] **[FastAPI]** Create lesson repository and service
- [ ] **[FastAPI]** Implement `POST /api/v1/modules/{module_id}/lessons`
- [ ] **[FastAPI]** Implement `GET /api/v1/modules/{module_id}/lessons`
- [ ] **[FastAPI]** Implement `GET /api/v1/lessons/{lesson_id}` (with materials)
- [ ] **[FastAPI]** Implement `PATCH /api/v1/lessons/{lesson_id}`
- [ ] **[FastAPI]** Implement `DELETE /api/v1/lessons/{lesson_id}`

### 2E — Material Upload & Management

- [ ] **[FastAPI]** Configure file storage (local `./uploads/` directory or S3-compatible)
- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/material.py`)
- [ ] **[FastAPI]** Create material repository and service
- [ ] **[FastAPI]** Implement `POST /api/v1/lessons/{lesson_id}/materials/upload` (multipart, file validation)
- [ ] **[FastAPI]** Implement `GET /api/v1/lessons/{lesson_id}/materials`
- [ ] **[FastAPI]** Implement `GET /api/v1/materials/{material_id}/download` (file streaming)
- [ ] **[FastAPI]** Implement `DELETE /api/v1/materials/{material_id}` (remove file + DB record)
- [ ] **[FastAPI]** Add file size and type validation (max 50MB, allowed extensions)

### 2F — Enrollment

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/enrollment.py`)
- [ ] **[FastAPI]** Create enrollment repository and service
- [ ] **[FastAPI]** Implement `POST /api/v1/courses/{course_id}/enroll` (STUDENT)
- [ ] **[FastAPI]** Implement `DELETE /api/v1/courses/{course_id}/enroll` (STUDENT, set DROPPED)
- [ ] **[FastAPI]** Implement `GET /api/v1/enrollments/my` (student's enrolled courses)
- [ ] **[FastAPI]** Implement `GET /api/v1/courses/{course_id}/students` (owner/ADMIN)
- [ ] **[FastAPI]** Add enrollment check dependency (for protecting lesson/material access)

---

## Phase 3: Frontend LMS UI

> Build the Next.js pages and components that consume the Phase 2 APIs.

### 3A — Shared Components & Layout

- [ ] **[Next.js]** Build responsive Sidebar navigation (role-aware: show different links for ADMIN/TEACHER/STUDENT)
- [ ] **[Next.js]** Build top Navbar with user profile dropdown
- [ ] **[Next.js]** Create reusable UI components: `Button`, `Card`, `Modal`, `Input`, `Badge`, `Spinner`, `EmptyState`
- [ ] **[Next.js]** Create data-fetching hooks with loading/error states (`useCourses`, `useModules`, etc.)
- [ ] **[Next.js]** Set up toast notification system for success/error feedback

### 3B — Course Pages

- [ ] **[Next.js]** Build Course Catalog page (`/app/(dashboard)/courses/page.tsx`) — grid of published courses with search
- [ ] **[Next.js]** Build Course Detail page (`/app/(dashboard)/courses/[courseId]/page.tsx`) — module/lesson sidebar + content area
- [ ] **[Next.js]** Build Create Course page (`/app/(dashboard)/courses/new/page.tsx`) — form for TEACHER/ADMIN
- [ ] **[Next.js]** Build Edit Course page (`/app/(dashboard)/courses/[courseId]/edit/page.tsx`)
- [ ] **[Next.js]** Add "Enroll" / "Unenroll" button on course detail (for STUDENT)
- [ ] **[Next.js]** Build My Courses page (`/app/(dashboard)/my-courses/page.tsx`) — enrolled courses for students, owned courses for teachers

### 3C — Module & Lesson Management (Teacher)

- [ ] **[Next.js]** Build Module management UI within Course Edit (add/edit/delete/reorder modules)
- [ ] **[Next.js]** Build Lesson editor within Module (add/edit/delete/reorder lessons)
- [ ] **[Next.js]** Integrate a Markdown editor for lesson content (e.g., `react-md-editor` or similar)
- [ ] **[Next.js]** Build drag-and-drop reordering for modules and lessons

### 3D — Material Management (Teacher)

- [ ] **[Next.js]** Build file upload component with drag-and-drop zone and progress bar
- [ ] **[Next.js]** Display material list per lesson with download links
- [ ] **[Next.js]** Add delete material functionality with confirmation modal

### 3E — Student Lesson View

- [ ] **[Next.js]** Build lesson content viewer (renders Markdown content)
- [ ] **[Next.js]** Display attached materials with download buttons
- [ ] **[Next.js]** Build lesson navigation (prev/next within module)
- [ ] **[Next.js]** Highlight current lesson in sidebar

### 3F — Admin Dashboard

- [ ] **[Next.js]** Build Admin user management page (`/app/(dashboard)/admin/users/page.tsx`)
- [ ] **[Next.js]** Display user table with role badges and status
- [ ] **[Next.js]** Add ability to deactivate/reactivate users
- [ ] **[Next.js]** Show platform statistics (total users, courses, enrollments)

---

## Phase 4: Gemini AI Integration (Backend)

> Wire up the Google Gemini API for the AI Tutor feature. Gemini's massive context window allows us to pass uploaded PDF documents directly as context — no vector stores or embeddings needed.

### 4A — Gemini Service Layer

- [ ] **[FastAPI]** Install `google-generativeai` SDK and add to `requirements.txt`
- [ ] **[FastAPI]** Add `GEMINI_API_KEY` to settings and validate on startup
- [ ] **[FastAPI]** Create `services/gemini_service.py` as a centralized wrapper for all Gemini API interactions
- [ ] **[FastAPI]** Configure the Gemini client: `genai.configure(api_key=settings.GEMINI_API_KEY)`
- [ ] **[FastAPI]** Select model: use `gemini-1.5-flash` for fast/free-tier responses, with `gemini-1.5-pro` as a configurable option

### 4B — Gemini File API Integration

- [ ] **[FastAPI]** Implement `upload_file_to_gemini(file_path, display_name)` using `genai.upload_file(path, display_name=...)` → returns `file.uri` and `file.name`
- [ ] **[FastAPI]** Implement `get_gemini_file(file_name)` using `genai.get_file(name)` → check file state (`ACTIVE` vs `PROCESSING`)
- [ ] **[FastAPI]** Implement `delete_gemini_file(file_name)` using `genai.delete_file(name)`
- [ ] **[FastAPI]** Implement `list_gemini_files()` for debugging/admin purposes
- [ ] **[FastAPI]** Handle file processing wait: poll `genai.get_file()` until `state == "ACTIVE"` before using in chat
- [ ] **[FastAPI]** Handle Gemini File API errors (file too large, unsupported format, quota exceeded)

### 4C — Course AI Setup Endpoint

- [ ] **[FastAPI]** Implement `POST /api/v1/courses/{course_id}/setup-ai`
  - Iterates through all course materials (PDFs)
  - Uploads each to Gemini via `genai.upload_file()` 
  - Stores returned `file.uri` in `materials.gemini_file_uri`
  - Sets `courses.ai_enabled = true`
  - Returns count of files uploaded and their status
- [ ] **[FastAPI]** Update material upload flow: auto-upload new PDFs to Gemini if `course.ai_enabled == true`, save `gemini_file_uri`
- [ ] **[FastAPI]** Update material delete flow: call `genai.delete_file()` if `gemini_file_uri` exists, then clear the field
- [ ] **[FastAPI]** Update course delete flow: delete all Gemini files associated with course materials before DB cascade
- [ ] **[FastAPI]** Add background task or async handling for file uploads (Gemini File API can be slow for large PDFs)

### 4D — Chat Session & Message Handling

- [ ] **[FastAPI]** Create system prompt template for the AI Tutor (e.g., _"You are a helpful tutor for the course '{course_title}'. Answer questions based on the provided course materials. If the answer is not in the materials, say so."_)
- [ ] **[FastAPI]** Implement chat logic in `services/gemini_service.py`:
  1. Load all `gemini_file_uri` references for the course's materials
  2. Build the `contents` list: system instruction + file references + conversation history from `chat_messages`
  3. Call `model.generate_content(contents)` (or use `model.start_chat(history=...)` + `chat.send_message(...)`)
  4. Return the assistant response text
- [ ] **[FastAPI]** Handle Gemini-specific response parsing: extract `response.text`, handle `finish_reason`, safety filters
- [ ] **[FastAPI]** Implement token counting awareness: log `response.usage_metadata` (prompt/candidate token counts)
- [ ] **[FastAPI]** Handle Gemini API errors gracefully (rate limits `429`, safety blocks, context length exceeded, network timeouts)
- [ ] **[FastAPI]** Add retry logic with exponential backoff for transient Gemini API failures

### 4E — Chat CRUD Endpoints

- [ ] **[FastAPI]** Create Pydantic schemas (`schemas/chat.py` — `ThreadCreate`, `ThreadResponse`, `MessageResponse`, `AskRequest`, `AskResponse`)
- [ ] **[FastAPI]** Create chat repository (`repositories/chat.py`)
- [ ] **[FastAPI]** Create chat service (`services/chat.py`) — orchestrates between chat repo and Gemini service
- [ ] **[FastAPI]** Implement `POST /api/v1/courses/{course_id}/chat/threads` (create a new local thread)
- [ ] **[FastAPI]** Implement `GET /api/v1/courses/{course_id}/chat/threads` (list student's threads for this course)
- [ ] **[FastAPI]** Implement `GET /api/v1/chat/threads/{thread_id}/messages` (get conversation history)
- [ ] **[FastAPI]** Implement `POST /api/v1/chat/threads/{thread_id}/ask`:
  1. Validate enrollment + `ai_enabled` on course
  2. Save user message to `chat_messages`
  3. Load full thread history from `chat_messages`
  4. Load course material file references (`gemini_file_uri` list)
  5. Call Gemini `generate_content` with system prompt + files + history
  6. Save assistant response to `chat_messages`
  7. Return both messages
- [ ] **[FastAPI]** Implement `DELETE /api/v1/chat/threads/{thread_id}` (delete thread + cascade messages)
- [ ] **[FastAPI]** Add enrollment validation: student must be enrolled in the course to chat
- [ ] **[FastAPI]** Add course AI readiness check: verify `ai_enabled == true` and at least one material has `gemini_file_uri` before allowing chat

---

## Phase 5: AI Tutor Chat UI (Frontend)

> Build the chat interface that students use to interact with the Gemini-powered AI Tutor.

### 5A — Chat Interface

- [ ] **[Next.js]** Build Chat panel/page (`/app/(dashboard)/courses/[courseId]/chat/page.tsx`)
- [ ] **[Next.js]** Build thread sidebar (list of previous conversations with create-new button)
- [ ] **[Next.js]** Build chat message list with role-based styling (user messages right-aligned, assistant left-aligned)
- [ ] **[Next.js]** Build message input with send button and Enter-to-submit
- [ ] **[Next.js]** Render Markdown in assistant responses (code blocks, lists, bold, LaTeX math, etc.)
- [ ] **[Next.js]** Show loading/typing indicator while waiting for Gemini response
- [ ] **[Next.js]** Auto-scroll to latest message
- [ ] **[Next.js]** Handle error states (AI unavailable, rate limits, safety filters, network errors)

### 5B — Chat UX Polish

- [ ] **[Next.js]** Add "AI Tutor not configured" empty state when course has `ai_enabled == false`
- [ ] **[Next.js]** Add thread delete with confirmation
- [ ] **[Next.js]** Add "Ask AI Tutor" button on lesson pages (opens chat with course context)
- [ ] **[Next.js]** Mobile-responsive chat layout (full-screen chat on mobile)
- [ ] **[Next.js]** Add keyboard shortcuts (Ctrl+Enter to send, Escape to close)
- [ ] **[Next.js]** Display Gemini safety filter warnings gracefully when a response is blocked

### 5C — Teacher AI Management

- [ ] **[Next.js]** Add "Setup AI Tutor" button on course edit page (calls `POST /setup-ai`)
- [ ] **[Next.js]** Show AI tutor status indicator (enabled / not enabled)
- [ ] **[Next.js]** Show which materials are synced to Gemini (`gemini_file_uri` badge — synced ✓ / not synced ✗)
- [ ] **[Next.js]** Add "Re-sync Materials" action to re-upload files after updates
- [ ] **[Next.js]** Show file processing status (PROCESSING → ACTIVE) with auto-refresh

---

## Phase 6: Testing, Polish & Deployment

> Harden the platform with testing, UX polish, and deployment readiness.

### 6A — Backend Testing

- [ ] **[FastAPI]** Write integration tests for all CRUD endpoints (using `httpx` + `pytest`)
- [ ] **[FastAPI]** Write unit tests for services (mock Gemini API calls with `unittest.mock`)
- [ ] **[FastAPI]** Test auth flow end-to-end (register → login → access protected routes)
- [ ] **[FastAPI]** Test role-based access control (ADMIN vs TEACHER vs STUDENT)
- [ ] **[FastAPI]** Test file upload/download flows
- [ ] **[FastAPI]** Test enrollment-gated access to lessons and chat
- [ ] **[FastAPI]** Test Gemini integration with a live API key (smoke test: upload a PDF, ask a question, verify response)

### 6B — Frontend Testing & UX

- [ ] **[Next.js]** Add form validation with user-friendly error messages on all forms
- [ ] **[Next.js]** Implement optimistic UI updates where appropriate
- [ ] **[Next.js]** Add loading skeletons for all data-fetching pages
- [ ] **[Next.js]** Ensure full keyboard navigation and accessibility (ARIA labels)
- [ ] **[Next.js]** Test responsive layouts on mobile, tablet, and desktop

### 6C — Deployment

- [ ] **[Docker]** Create `Dockerfile` for FastAPI backend
- [ ] **[Docker]** Create `Dockerfile` for Next.js frontend
- [ ] **[Docker]** Update `docker-compose.yml` to orchestrate all services (API, Client, DB)
- [ ] **[Both]** Configure production environment variables (including `GEMINI_API_KEY`)
- [ ] **[Both]** Set up CI/CD pipeline (GitHub Actions: lint, test, build)
- [ ] **[Both]** Create `README.md` with setup instructions, architecture diagram, and API docs link

---

## Dependency Graph

```
Phase 0 (Foundation)
   │
   ▼
Phase 1 (Models + Auth)
   │
   ├──────────────────────┐
   ▼                      ▼
Phase 2 (LMS APIs)    Phase 1C (Auth UI)
   │                      │
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

> **Note:** Phase 2 (Backend APIs) and Phase 3 (Frontend UI) can be developed **in parallel** by different developers. Phase 4 and 5 must wait for their respective backend/frontend foundations.

---

## Estimated Timeline

| Phase | Effort | Depends On |
|---|---|---|
| Phase 0 — Foundation | 1-2 days | — |
| Phase 1 — Models & Auth | 2-3 days | Phase 0 |
| Phase 2 — LMS APIs | 4-5 days | Phase 1 |
| Phase 3 — LMS UI | 5-6 days | Phase 1C + Phase 2 |
| Phase 4 — Gemini AI | 2-3 days | Phase 2 |
| Phase 5 — Chat UI | 3-4 days | Phase 3 + Phase 4 |
| Phase 6 — Testing & Deploy | 3-4 days | All |
| **Total** | **~20-27 days** | |

> **Note:** Phase 4 is estimated 1 day shorter than the original OpenAI plan because Gemini's architecture is simpler — no vector stores, no assistant management, no run polling.
