# Architecture Decisions — LearnAI LMS

> This document records significant architectural and security decisions made
> during development. Each entry captures the **context**, the **decision**, and
> the **rationale** — intended to support academic analysis of the system design.

---

## ADR-001 · Shift from Frontend-Driven Security to Zero Trust / Defense in Depth

**Date:** 2026-05-27  
**Phase:** 2C (Module CRUD) → Security Patch  
**Status:** Adopted

### Context

During Phase 2C, the initial implementation of `GET /api/courses/:courseId/modules`
contained the following comment — and the corresponding logic:

```ts
// Auth is optional for GET — let the course-level visibility rules
// in getCourseById govern access.
```

This delegated the access decision for the **module** endpoint to the
**course** endpoint. The assumption was: *"If a user can reach the module
list, they must have already passed the course visibility check."*

This is a **Frontend-Driven Security** pattern — it assumes the client
(browser or app) will always call the course endpoint before calling the
module endpoint, and that the course endpoint's 404/403 response will
prevent the user from ever having a module URL to call.

### The Vulnerability

A direct API call bypasses the assumed call order entirely:

```
GET /api/courses/unpublished-course-id/modules
→ HTTP 200 OK  ← full module tree exposed to unauthenticated callers
```

Any person with a valid `courseId` (obtained from a database leak, a URL
share, or enumeration) could extract the full module/lesson structure of
a draft course without authentication.

### Decision: Zero Trust Architecture at Every Endpoint

Every route handler **independently enforces** its own access policy.
No endpoint assumes that a prior request validated authorization.

The fix adds a **publication gate** directly to every module GET handler:

```ts
const course = await fetchCourseGate(courseId);   // minimal 2-column SELECT
if (!course.isPublished) {
  const caller = await getAuthUser(request);       // may throw AuthError
  if (!isOwner && !isAdmin) {
    return notFound("Course not found or not yet published.");
  }
}
```

The same pattern is applied consistently across the entire API surface:

| Endpoint | Publication Gate | Auth Gate |
|---|---|---|
| `GET /api/courses/:id` | ✅ Independent | ✅ Independent |
| `GET /api/courses/:id/modules` | ✅ Independent | ✅ Independent |
| `GET /api/courses/:id/modules/:id` | ✅ Independent | ✅ Independent |
| `GET /api/lessons/:id` | ✅ Independent | ✅ Independent |

### Prisma Query Optimisation

The naïve implementation would re-fetch the full course object (all columns)
for every request. Instead, we use a **minimal projection** — a helper called
`fetchCourseGate` that selects exactly two columns:

```ts
// Before (hypothetical naïve version): all columns transferred per row
const course = await prisma.course.findUnique({ where: { id: courseId } });

// After: 2 columns only — isPublished and teacherId
async function fetchCourseGate(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: { isPublished: true, teacherId: true },
  });
}
```

**Why this matters:**
- The `description` and potential future `content` fields on a course can
  be large. Selecting only the gate fields keeps the check lightweight.
- The Prisma `select` clause translates directly to a SQL column projection:
  `SELECT is_published, teacher_id FROM courses WHERE id = $1`
- This check runs on **every GET request** to a module endpoint, so
  minimising its cost is important for throughput.
- The `fetchCourseGate` function is intentionally **not shared** across
  route files — each file is self-contained and independently auditable,
  which is itself a Zero Trust principle (no implicit trust in shared state).

### 404 instead of 403 for Unpublished Resources

Returning `403 Forbidden` when an unauthenticated caller hits an unpublished
course would **confirm the course exists**. This enables enumeration attacks:
a bot could systematically probe UUIDs and use the 403/404 distinction to
map out the database.

The decision is to **always return 404** for unpublished resources accessed
by non-owners. This is the same pattern used by platforms such as GitHub
(private repositories return 404, not 403, to unauthenticated callers).

### Key Design & Optimisation Decisions Summary

| Property | Frontend-Driven Security (before) | Zero Trust (adopted) |
|---|---|---|
| Access decision location | Client call order assumed | Each route handler independently |
| Failure mode | One bypass = full exposure | Each layer fails independently |
| API testability | Only testable via browser flow | Each endpoint testable in isolation |
| Audit surface | Implicit, distributed across call chain | Explicit, co-located with each route |
| Prisma query cost per gate check | Full row fetch (all columns) | 2-column `SELECT` projection |
| Response for non-owner on unpublished | `403 Forbidden` (leaks existence) | `404 Not Found` (prevents enumeration) |
| Inter-endpoint dependency | High — modules trust course endpoint | None — each route is self-sufficient |

---

## ADR-002 · JWT Dual-Delivery Strategy (localStorage + HTTP-only Cookie)

**Date:** 2026-05-20  
**Phase:** 1B (Authentication)  
**Status:** Adopted

### Context

JWTs can be stored in `localStorage` (accessible by JS) or HTTP-only cookies
(inaccessible by JS, sent automatically by the browser).

Each has trade-offs:

| | localStorage | HTTP-only Cookie |
|---|---|---|
| XSS risk | **High** — JS can read it | **None** — browser protects it |
| CSRF risk | None — not auto-sent | Mitigated by `SameSite=Lax` |
| Works for API clients (curl, mobile) | ✅ Yes | ❌ No — not auto-sent |
| Works for Next.js middleware (Edge) | ❌ No — no browser | ✅ Yes |

### Decision: Both

The login endpoint writes the JWT to **both**:

1. **HTTP-only `SameSite=Lax` cookie** (`auth_token`) — consumed by Next.js
   middleware for SSR route protection (Edge Runtime has no `localStorage`).
2. **Response body** (`data.accessToken`) — stored in `localStorage` by the
   `AuthContext`, consumed by the `fetch` client for all API calls via the
   `Authorization: Bearer` header.

The `getAuthUser` helper checks the `Authorization` header first, then falls
back to the cookie — supporting both API clients and browser clients with one
implementation.

The cookie TTL and JWT expiry are set to the same value (7 days) to prevent
a state where the cookie is still valid after the JWT has expired.

---

## ADR-003 · Service Layer Pattern (No Direct Prisma in Route Handlers)

**Date:** 2026-05-20  
**Phase:** 2A (User Management)  
**Status:** Adopted

### Decision

All database operations are encapsulated in `lib/services/*.service.ts` files.
Route handlers call service functions — they never import `prisma` directly
(with the exception of the lightweight `fetchCourseGate` gate check, which is
intentionally kept inline for auditability).

### Rationale

| Concern | Without Service Layer | With Service Layer |
|---|---|---|
| Reuse | Prisma queries duplicated across routes | One source of truth per operation |
| Testing | Must spin up HTTP server to test DB logic | Service functions are unit-testable |
| Password leakage | Must remember `omit` in every route | `omit: { hashedPassword: true }` enforced once in service |
| Ownership check | Duplicated `where: { id, teacherId }` across routes | Centralised in `check-ownership.ts` |

---

## ADR-004 · orderIndex Auto-Calculation (Append-by-Default)

**Date:** 2026-05-26  
**Phase:** 2C/2D (Module & Lesson CRUD)  
**Status:** Adopted

### Decision

When creating a module or lesson, `orderIndex` is **not accepted from the
client**. The server calculates it as `max(existing orderIndex) + 1`:

```ts
const aggregate = await prisma.module.aggregate({
  where: { courseId },
  _max: { orderIndex: true },
});
const nextOrder = (aggregate._max.orderIndex ?? -1) + 1;
```

Explicit reordering is a separate operation (`PUT /modules` with `{ orderedIds }`),
executed atomically via `prisma.$transaction`.

### Rationale

- Prevents race conditions where two simultaneous POST requests claim the
  same `orderIndex` (at the cost of potential gaps, which are harmless).
- The client never needs to track current ordering state during creation.
- Bulk reorder via ordered IDs array is a clean, idempotent interface that
  maps naturally to drag-and-drop UI interactions.

---

## ADR-005 · Zod v4 Migration (required_error → error, .errors → .issues)

**Date:** 2026-05-20  
**Phase:** 1B  
**Status:** Adopted

### Context

The project uses Zod **v4.4.3**. Two breaking API changes from v3 affect
all validation schemas and error handlers:

| v3 API | v4 API | Location |
|---|---|---|
| `z.string({ required_error: "..." })` | `z.string({ error: "..." })` | All schema files |
| `ZodError.errors` | `ZodError.issues` | All route handlers |

All schemas and route handlers in this project use the v4 API exclusively.
The `RegisterInput` / `RegisterOutput` split (using `z.input<>` vs `z.output<>`)
was introduced to handle the `role` field's `.default("STUDENT")` making it
optional in the input type but required in the output — a common Zod v4
pattern for forms with default values.

---

## ADR-006 · Storage Adapter Pattern + Native Web API for File Uploads

**Date:** 2026-05-27  
**Phase:** 2E (Material Upload & Management)  
**Status:** Adopted

### Context

File upload in Next.js App Router can be implemented via:

1. **Legacy Node.js middleware** — `multer`, `formidable`, `busboy` + `next-connect`
2. **Native Web API** — `request.formData()` (built into the Fetch API / WinterCG)

Additionally, file storage can be implemented inline (direct `fs.writeFile` in a
route handler) or via an abstraction layer.

### Decision A: Native Web API (`request.formData()`)

All file parsing uses the native `request.formData()` method. No third-party
upload middleware is used.

**Why:**

| Concern | multer / next-connect | Native `request.formData()` |
|---|---|---|
| Compatibility | Designed for Express — requires wrappers in App Router | First-class in Next.js App Router |
| Edge Runtime | Not compatible | Fully compatible |
| Dependencies | +2 packages, CommonJS assumptions | Zero new dependencies |
| Maintenance | Separate ecosystem from Next.js | Maintained by Next.js / WinterCG spec |
| File object type | `multer.File` (Buffer, non-standard) | Web `File` object (WHATWG standard) |

The `File` object from `formData.get("file")` exposes `.arrayBuffer()`, `.size`,
`.name`, and `.type` — all the fields needed for validation and storage, with
no transformation layer required.

### Decision B: Storage Adapter Pattern

All physical file I/O is encapsulated in `lib/services/storage.service.ts`.
Route handlers never import `fs` directly.

**Current implementation** (local filesystem):

```
uploadFile(file, lessonId) → writes to public/uploads/<lessonId>/<uuid>-<name>
deleteFile(fileUrl)        → unlinks from public/uploads/...
resolveFilePath(fileUrl)   → maps /uploads/... → absolute path for streaming
```

**Future swap to AWS S3 — zero route handler changes required:**

```ts
// Only storage.service.ts changes — all callers are unaffected
export async function uploadFile(file: File, lessonId: string): Promise<UploadResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${lessonId}/${randomUUID()}-${sanitiseFilename(file.name)}`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer }));
  return { fileUrl: `https://${BUCKET}.s3.amazonaws.com/${key}`, ... };
}
```

### Key Design & Optimisation Decisions

| Decision | Choice Made | Rationale |
|---|---|---|
| Upload parsing | `request.formData()` (Web API) | App Router native, Edge-compatible, zero new dependencies |
| Middleware | None | multer / next-connect require Express-compatible wrappers |
| Storage namespacing | `public/uploads/<lessonId>/` | Prevents filename collisions across lessons |
| Filename safety | UUID prefix + non-ASCII sanitisation | Prevents path traversal and OS-unsafe character vulnerabilities |
| File size check | `file.size` before write | Fails fast — no partial disk I/O for oversized files |
| MIME type validation | `ALLOWED_MIME_TYPES` allowlist before write | Prevents upload of executables (`.sh`, `.exe`, `.php`) |
| DB-write failure | Orphan file deleted (compensation transaction) | Keeps storage and DB consistent on any failure path |
| Deletion order | Physical file first, then DB record | Orphan DB record is recoverable; a missing file with a live record is not |
| Download route | API route (`/api/materials/.../download`) | Enables auth gating, audit logging, and future presigned URL swap |
| Path traversal guard | `absolutePath.startsWith(UPLOADS_ROOT)` | Prevents `../../etc/passwd`-style attacks on resolveFilePath and deleteFile |
| Future storage swap scope | Only `storage.service.ts` | Route handlers, services, validation, and tests require no changes |

---

## ADR-007 · BigInt JSON Serialization — Global Prototype Patch

**Date:** 2026-05-27  
**Phase:** 2E (Material Upload) — Post-implementation Bug Fix  
**Status:** Adopted

### The Problem: Why BigInt Cannot Be Serialized by Default

JavaScript's `JSON.stringify` (and therefore `NextResponse.json()`) throws
a `TypeError` when it encounters a native `BigInt` value:

```
TypeError: Do not know how to serialize a BigInt
```

**Root cause — two mismatched specifications:**

1. **The JSON specification (RFC 8259)** defines numbers as IEEE 754 double-precision
   floats. The maximum safe integer representable is `2^53 − 1 ≈ 9×10¹⁵`.
2. **BigInt** was introduced in ES2020 to represent arbitrarily large integers —
   values that *cannot* be safely round-tripped through a JSON number.
3. **V8 (Node.js engine) deliberately omits a default** `.toJSON()` on BigInt
   to force developers to consciously decide on a serialization strategy, rather
   than silently losing precision.

**Why does Prisma produce BigInt?**

Prisma maps PostgreSQL's `BigInt` column type directly to JavaScript's native
`BigInt` primitive. Our `Material.fileSizeBytes` field is declared `BigInt?`
in `schema.prisma` because file sizes can theoretically exceed `2^31` bytes
(standard 32-bit `Int` max ≈ 2 GB) — a reasonable choice for a media platform.

### The Fix: `BigInt.prototype.toJSON`

`JSON.stringify` calls `.toJSON()` on a value *before* serializing it, if the
method exists. By patching the prototype once, every BigInt in every response
is handled automatically:

```ts
// lib/prisma.ts
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};
```

**Why stringify as a string, not a number?**

Converting `98360n` → `98360` (number) would appear to work for small values but
would silently truncate large values (e.g. a 10 GB file: `10_737_418_240n` exceeds
`Number.MAX_SAFE_INTEGER` and would be corrupted in transit). Converting to a
**string** is always safe and the client can parse it with `BigInt(value)` when
arithmetic is needed.

### Why a Global Prototype Patch vs. Per-Route Casting

Three alternative approaches were considered:

| Approach | Example | Assessment |
|---|---|---|
| **Per-route casting** | `Number(material.fileSizeBytes)` | Precision loss for large files; must be applied in every single route handler — fragile, easy to forget |
| **Service-layer transform** | Map `BigInt` → `string` in every service return | Requires custom transform types; breaks Prisma's auto-generated types |
| **Custom JSON replacer** | `JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)` | Must be threaded through every `NextResponse.json()` call — not compatible with the existing `ok/created/...` response helpers |
| **Global `BigInt.prototype.toJSON` patch** ✅ | Applied once in `lib/prisma.ts` | Zero per-route code, works with all existing response helpers, self-documenting, TypeScript-safe via `declare global` |

### Placement Decision

The patch lives in `lib/prisma.ts` rather than `instrumentation.ts` or a
custom `_app.tsx` for two reasons:

1. **Guaranteed early execution** — every database-touching module imports
   `lib/prisma.ts`, so the patch is always applied before any BigInt value
   could reach a response serializer.
2. **Co-location with the root cause** — BigInt values enter our system
   exclusively via Prisma's type mapping. Having the fix immediately adjacent
   to the Prisma client instantiation makes the relationship self-documenting
   and easy to find during future audits.

### Key Design & Optimisation Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Serialization format | `BigInt` → `string` | Prevents IEEE 754 precision loss for values > 2^53 |
| Patch location | `lib/prisma.ts` (module-level, runs once) | Guaranteed execution before any response; co-located with root cause |
| Patch mechanism | `BigInt.prototype.toJSON` | Hooks into `JSON.stringify`'s built-in `.toJSON()` protocol — zero changes to callers |
| TypeScript support | `declare global { interface BigInt { toJSON(): string } }` | Eliminates TS2339 "property does not exist" error on the prototype assignment |
| Scope | Process-global, applies to all BigInt values | One fix covers all current and future Prisma models with BigInt columns |
| Alternative rejected | Per-route `Number()` cast | Silent precision loss for large values; repeated boilerplate in every route |

---

## ADR-008 · CurriculumEditor — SSR Safety & State Decoupling

**Date:** 2026-06-02
**Phase:** 3C (Module & Lesson Management UI)
**Status:** Adopted

### Context

Two independent problems needed to be solved simultaneously when building the Curriculum Editor:

1. **The SSR Problem** — `@uiw/react-md-editor` reads `window` at import-time to detect the browser environment. In Next.js App Router, component modules are evaluated during server-side rendering (SSR). This causes an immediate crash:
   ```
   ReferenceError: window is not defined
   ```
   This is a well-known class of problem with any rich-text editor (CodeMirror, Quill, TipTap, etc.).

2. **The State Coupling Problem** — The Edit Course page already contains a `<CourseForm>` wrapped in `react-hook-form`. If the `CurriculumEditor` were embedded inside the same form's state tree (e.g., as additional fields), every lesson content keystroke would trigger `react-hook-form`'s internal re-render cycle, degrading editor performance and risking form state corruption.

### Decision A: `next/dynamic` with `{ ssr: false }` for the Markdown Editor

```tsx
// components/curriculum/LessonEditorDialog.tsx

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default),
  { ssr: false }   // ← never evaluated on the server
);
```

`next/dynamic` is Next.js's built-in code-splitting primitive. When `ssr: false` is set:

- The module is **excluded from the server bundle entirely**. It is never imported during SSR, so `window is not defined` cannot occur.
- The component is loaded **lazily in the browser** after hydration, at the point where it is first rendered.
- A `loading` fallback is rendered during the client-side load gap — here, a simple skeleton with a spinner.

The editor is also wrapped in `data-color-mode="light"` to force a consistent appearance regardless of OS dark mode setting.

### Decision B: State Decoupled from `CourseForm`

`CurriculumEditor` is a **self-contained component** that:
- Fetches its own data via `GET /api/courses/:courseId/modules`
- Maintains its own `modules: Module[]` state
- Is rendered as a sibling of `CourseForm` in the page layout — **not** a child of `CourseForm`'s `<form>` element

This means:
- Changes to lessons (typing in the Markdown editor) do **not** trigger CourseForm's re-render cycle
- Saving a lesson (`PATCH /api/lessons/:lessonId`) does **not** interact with the course form's `isDirty` state
- The two editors are independently focusable and independently submittable

### Key Design & Optimization Decisions

| Decision | Choice Made | Rationale |
|---|---|---|
| SSR fix for MD editor | `next/dynamic({ ssr: false })` | Prevents `window is not defined` at import time; excluded from server bundle entirely |
| State location | `CurriculumEditor` owns its own `useState<Module[]>` | Decouples from CourseForm's `react-hook-form` state; prevents cross-component re-renders |
| Lesson reorder UX | Up/Down arrow buttons (not DND) | Avoids nested `DndContext` which crashes with conflicting pointer sensors and event propagation |
| Module reorder UX | `@dnd-kit/sortable` with `PointerSensor` | DND only at the module level; `activationConstraint: { distance: 6 }` prevents accidental drags on button clicks |
| Optimistic UI | Module/lesson order updated before API confirms | Instant visual feedback; original order restored on API failure |
| Markdown editor import | `.then((m) => m.default)` in dynamic | Required when the module uses a default export — resolves the ESM interop correctly |
| `data-color-mode="light"` wrapper | Always use light mode | Prevents jarring dark-mode appearance mismatch when OS is in dark mode but site is light-only |
| Module reorder HTTP verb | `PUT /api/courses/:courseId/modules` | Consistent with the server-side `reorderModules` service (idempotent bulk-replace semantics) |
| Lesson edit URL | `PATCH /api/lessons/:lessonId` (not `/modules/:id/lessons/:id`) | The lesson route is directly addressable; no need to include moduleId in the URL — server resolves it from the lesson record |
| `useApi.put` addition | Added `put` method to `useApi` hook | Mirrors `patch`/`del` — keeps all authenticated fetch calls through one consistent helper with token injection |

---

## ADR-009 · XMLHttpRequest over fetch for Upload Progress

**Date:** 2026-06-03
**Phase:** 3D (Material Management UI)
**Status:** Adopted

### Context

The Material upload UI requires a real-time progress bar so the teacher can see how much of the file has been transmitted. Two browser APIs can perform file uploads from a web page:

1. **`fetch()`** (modern Fetch API)
2. **`XMLHttpRequest`** (legacy, but still widely supported)

### The Gap in the Fetch API

The Fetch API does not expose upload progress. Its `Response` object provides a `body` `ReadableStream` for *download* progress (reading the server response), but there is no equivalent interface for *upload* progress — how many bytes of the request body have been sent to the server.

This is a known, documented limitation. The [WHATWG Fetch specification](https://fetch.spec.whatwg.org/) does not include upload progress. A `fetch`-based progress bar would require a polyfill or a third-party streaming library (e.g., `axios`), adding a dependency.

### Decision: XMLHttpRequest

`XMLHttpRequest` exposes the `xhr.upload` property, which is an `XMLHttpRequestUpload` object that fires standard `ProgressEvent` events:

```ts
xhr.upload.onprogress = (e: ProgressEvent) => {
  if (e.lengthComputable) {
    setUploadProgress(Math.round((e.loaded / e.total) * 100));
  }
};
```

This is called repeatedly as bytes are transmitted, with `e.loaded` (bytes sent so far) and `e.total` (total file size). The values drive the `<Progress>` component's `value` prop directly — no additional state transformation needed.

### Why Not Axios?

`axios` wraps XHR and also exposes `onUploadProgress`. It is a valid alternative, but adding a ~13 KB dependency purely for upload progress tracking is not justified when the XHR API is built into every browser and already available in our codebase.

### Key Design & Optimization Decisions

| Decision | Choice Made | Rationale |
|---|---|---|
| Upload API | `XMLHttpRequest` | Only browser API with native `xhr.upload.onprogress` — no extra dependency |
| Auth header | Manually read `lms_auth_token` from `localStorage` and set via `xhr.setRequestHeader` | `useApi` is a hook and cannot be called inside an XHR callback; direct `localStorage` read is the correct pattern |
| Body format | `FormData` with `formData.append("file", file)` | Matches `request.formData()` on the server — browser sets correct `multipart/form-data` boundary automatically |
| Fetch alternative rejected | `fetch()` | No upload progress event in the Fetch specification |
| Axios rejected | Not added | ~13 KB dependency for a single feature; XHR achieves the same result natively |

---

## ADR-010 · LessonProgress Model & Hybrid Dashboard Data Fetching

**Date:** 2026-06-03
**Phase:** 3E/3F (Student Lesson View & Dashboards)
**Status:** Adopted

### Context

During Phase 3E, it became clear that student dashboards and analytics needed a way to track which lessons a student had completed. The original database schema did not include a progress tracking model.

Separately, Phase 3F required choosing a data-fetching strategy for the three role-based dashboards (Student, Teacher, Admin) and the analytics page.

### Decision A: `LessonProgress` Model

A new `LessonProgress` model was added to `prisma/schema.prisma`:

```prisma
model LessonProgress {
  id          String   @id @default(uuid())
  studentId   String
  lessonId    String
  isCompleted Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  student User   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@map("lesson_progress")
}
```

**Key design decisions:**
- `@@unique([studentId, lessonId])` — enforces one progress record per student-lesson pair; `upsert` is used for idempotent toggling.
- `isCompleted` boolean (not an enum) — sufficient for the current requirement; expandable to a status enum later if needed.
- Cascade deletes on both `User` and `Lesson` FKs — cleaning up orphan records automatically.

Two API routes were added:
- `GET /api/lessons/[lessonId]/progress` — reads the current student's completion status.
- `POST /api/lessons/[lessonId]/progress` — upserts the completion status (toggle).

### Decision B: Hybrid Dashboard Data Fetching

The dashboards use two different strategies depending on their interactivity needs:

| Component | Strategy | Why |
|---|---|---|
| `dashboard/page.tsx` → `AdminDashboard` / `TeacherDashboard` / `StudentDashboard` | Client component (`"use client"`) with `useApi` hooks | Interactive dashboards with role-based conditional rendering; `useAuth` provides the role at runtime |
| `admin/analytics/page.tsx` | Server Component with direct Prisma queries | Read-only analytics page; no interactivity needed; avoids creating a dedicated `/api/admin/stats` endpoint |

**Why no `GET /api/admin/stats` endpoint?**

The analytics page only needs to aggregate data for display. A dedicated stats endpoint would add:
1. A route handler that just wraps Prisma queries with no mutation logic.
2. An additional auth + role check layer (already handled by `getAuthUser()` in the Server Component).
3. Client-side fetch + loading states for data that is available server-side.

The Server Component approach is simpler, faster (no network round-trip), and equally secure (auth checked before any Prisma query).

---

## ADR-011 · Dual-Layout Chat UI — Standalone Page + Shadcn Sheet on Lesson View

**Date:** 2026-06-05
**Phase:** 5A/5B (AI Tutor Chat UI)
**Status:** Adopted

### Context

The AI Tutor chat needs to be accessible in two distinct user workflows:

1. **Focused conversation** — The student navigates to a dedicated chat page to have an extended Q&A session about the course.
2. **In-context Q&A** — While studying a lesson, the student has a quick question and wants to ask the AI without leaving the lesson content.

A single-page approach would force the student to navigate away from the lesson, losing their reading position. A panel-only approach would lack the space for thread management and extended conversations.

### Decision: Dual Layout with Shared Component Library

Build reusable chat components in `components/chat/` and compose them into **two layouts**:

| Layout | Route / Location | UX Pattern |
|---|---|---|
| **Standalone Chat Page** | `app/(dashboard)/courses/[courseId]/chat/page.tsx` | Full-page layout with `<ThreadSidebar>` + `<MessageList>` + `<ChatInput>` — for focused, multi-thread conversations |
| **Lesson View Sheet** | `app/(dashboard)/courses/[courseId]/lessons/[lessonId]/page.tsx` | Shadcn `<Sheet side="right">` containing `<ChatWidget>` — slide-out panel so the student can read the lesson and chat simultaneously (NotebookLM-style) |

Both layouts render the same `<ChatWidget>` component, which internally manages thread selection, message fetching, and message sending.

### Component Architecture

```
components/chat/
├── ChatWidget.tsx       # Complete chat experience (composes the below)
├── ThreadSidebar.tsx    # Thread list + create-new
├── MessageList.tsx      # Message rendering with Markdown + auto-scroll
└── ChatInput.tsx        # Input field + send button + keyboard shortcuts
```

### Why Shadcn `<Sheet>` for the Lesson View

| Concern | Modal / Dialog | Shadcn Sheet | Separate Page |
|---|---|---|---|
| Co-visibility with lesson content | ❌ Blocks lesson | ✅ Side-by-side | ❌ Navigates away |
| Implementation cost | Low | Low (Shadcn primitive) | Low |
| Mobile adaptation | Awkward | `side="bottom"` or full-screen | Full-screen |
| State preservation | Lesson state preserved | Lesson state preserved | Lesson state lost |
| Consistent with NotebookLM UX | No | ✅ Yes | No |

The `<Sheet>` component is already available via Shadcn UI and renders as a slide-out overlay that does not unmount the underlying page content. This preserves the student's scroll position and reading context while they interact with the AI Tutor.

### Key Design Decisions

| Decision | Choice Made | Rationale |
|---|---|---|
| Component location | `components/chat/` (reusable library) | Same components used in both standalone page and Sheet panel — zero duplication |
| Sheet trigger | "Ask AI Tutor" button on lesson page | Discoverable but non-intrusive; only visible when `aiEnabled === true` |
| Sheet side | `right` (desktop), `bottom` or full-screen (mobile) | Right panel preserves lesson reading flow on wide screens |
| Markdown rendering | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` | Supports code blocks, tables, LaTeX math — essential for educational Q&A |
| Thread management in Sheet | Simplified — single active thread, thread list collapsed | Sheet has limited width; full thread management available on standalone page |

