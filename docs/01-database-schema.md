# Database Schema — E-Learning LMS (PostgreSQL)

> **Version:** 3.0  
> **Last Updated:** 2026-06-04  
> **Engine:** PostgreSQL 16 + Prisma ORM

---

## Entity-Relationship Overview

```
┌──────────┐       ┌───────────┐       ┌──────────┐
│  users   │──1:N──│  courses   │──1:N──│ modules  │
│          │       │            │       │          │
│ (ADMIN,  │       │ ai_enabled │       └────┬─────┘
│  TEACHER,│       │ (Gemini)   │            │ 1:N
│  STUDENT)│       └─────┬──────┘       ┌────┴─────┐
└────┬─────┘             │              │ lessons  │
     │                   │              └────┬─────┘
     │ N:M               │                   │ 1:N
     │          ┌────────┴────────┐     ┌────┴──────────────┐
     └──────────│  enrollments    │     │  materials        │
                └─────────────────┘     │  gemini_file_uri  │
                                        └────┬─────────────┘
                                             │ 1:N
                ┌────────────────────────────┘
                │
        ┌───────┴──────────┐     ┌──────────────────┐
        │ chat_threads     │     │ lesson_progress   │
        └──────────────────┘     │ (studentId,       │
                                 │  lessonId,        │
                                 │  isCompleted)     │
                                 └──────────────────┘
```

> `lesson_progress` links `users` ↔ `lessons` (Many-to-Many through progress tracking).

---

## Enum Types

```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');
CREATE TYPE material_type AS ENUM ('PDF', 'VIDEO', 'LINK', 'OTHER');
```

---

## Tables

### 1. `users`

Stores all platform users. Role determines permissions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Unique user identifier |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | Login email |
| `hashed_password` | `VARCHAR(255)` | `NOT NULL` | bcrypt hash |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | Display name |
| `role` | `user_role` | `NOT NULL, DEFAULT 'STUDENT'` | ADMIN / TEACHER / STUDENT |
| `avatar_url` | `TEXT` | `NULLABLE` | Profile image URL |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-disable account |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Last modification |

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role            user_role NOT NULL DEFAULT 'STUDENT',
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);
```

---

### 2. `courses`

A course is owned by a TEACHER and optionally linked to Gemini AI for the AI Tutor feature.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | Unique course identifier |
| `title` | `VARCHAR(255)` | `NOT NULL` | Course title |
| `description` | `TEXT` | `NULLABLE` | Rich-text description |
| `thumbnail_url` | `TEXT` | `NULLABLE` | Cover image |
| `teacher_id` | `UUID` | `FK → users.id, NOT NULL` | Course creator/owner |
| `ai_enabled` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Gemini AI integration active |
| `is_published` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Visibility flag |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE courses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    thumbnail_url    TEXT,
    teacher_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ai_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    is_published     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_teacher    ON courses(teacher_id);
CREATE INDEX idx_courses_published  ON courses(is_published);
```

---

### 3. `modules`

Logical groupings within a course (e.g., "Week 1", "Chapter 3").

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `course_id` | `UUID` | `FK → courses.id, NOT NULL` | Parent course |
| `title` | `VARCHAR(255)` | `NOT NULL` | Module title |
| `description` | `TEXT` | `NULLABLE` | |
| `order_index` | `INTEGER` | `NOT NULL, DEFAULT 0` | Display order within course |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE modules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_modules_course ON modules(course_id);
```

---

### 4. `lessons`

Individual learning units within a module.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `module_id` | `UUID` | `FK → modules.id, NOT NULL` | Parent module |
| `title` | `VARCHAR(255)` | `NOT NULL` | Lesson title |
| `content` | `TEXT` | `NULLABLE` | Rich-text / Markdown body |
| `order_index` | `INTEGER` | `NOT NULL, DEFAULT 0` | Display order within module |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE lessons (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id    UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    content      TEXT,
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lessons_module ON lessons(module_id);
```

---

### 5. `materials`

Uploaded files attached to a lesson. PDFs are uploaded to the Gemini File API for use in AI Tutor context windows.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `lesson_id` | `UUID` | `FK → lessons.id, NOT NULL` | Parent lesson |
| `title` | `VARCHAR(255)` | `NOT NULL` | Display filename |
| `material_type` | `material_type` | `NOT NULL, DEFAULT 'PDF'` | File category |
| `file_url` | `TEXT` | `NOT NULL` | Storage path or URL |
| `file_size_bytes` | `BIGINT` | `NULLABLE` | Size for UI display |
| `gemini_file_uri` | `VARCHAR(255)` | `NULLABLE` | Gemini File API URI |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE materials (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id        UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    material_type    material_type NOT NULL DEFAULT 'PDF',
    file_url         TEXT NOT NULL,
    file_size_bytes  BIGINT,
    gemini_file_uri  VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_lesson ON materials(lesson_id);
```

---

### 6. `enrollments`

Join table linking students to courses (N:M).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `student_id` | `UUID` | `FK → users.id, NOT NULL` | Enrolled student |
| `course_id` | `UUID` | `FK → courses.id, NOT NULL` | Target course |
| `status` | `enrollment_status` | `DEFAULT 'ACTIVE'` | ACTIVE / COMPLETED / DROPPED |
| `enrolled_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | When the student enrolled |

```sql
CREATE TABLE enrollments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status      enrollment_status NOT NULL DEFAULT 'ACTIVE',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(student_id, course_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course  ON enrollments(course_id);
```

---

### 7. `chat_threads`

Persists a chat thread per student×course pair so conversation history is maintained.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `student_id` | `UUID` | `FK → users.id, NOT NULL` | Thread owner |
| `course_id` | `UUID` | `FK → courses.id, NOT NULL` | Scoped course |
| `title` | `VARCHAR(255)` | `NULLABLE` | Auto-generated or user-set label |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE chat_threads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title             VARCHAR(255),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_threads_student_course ON chat_threads(student_id, course_id);
```

---

### 8. `chat_messages`

Local storage of messages. When querying Gemini, this history is retrieved and passed as context.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `thread_id` | `UUID` | `FK → chat_threads.id, NOT NULL` | Parent thread |
| `role` | `VARCHAR(20)` | `NOT NULL` | `user` or `model` (Gemini API mapping) |
| `content` | `TEXT` | `NOT NULL` | Message body |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE chat_messages (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id          UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role               VARCHAR(20) NOT NULL,
    content            TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id);
```

---

### 9. `lesson_progress`

Tracks which lessons a student has completed. Used to calculate course progress percentages on dashboards and analytics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | |
| `student_id` | `UUID` | `FK → users.id, NOT NULL` | Student who completed the lesson |
| `lesson_id` | `UUID` | `FK → lessons.id, NOT NULL` | Completed lesson |
| `is_completed` | `BOOLEAN` | `DEFAULT FALSE` | Whether the lesson is marked complete |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |

```sql
CREATE TABLE lesson_progress (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(student_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX idx_lesson_progress_lesson  ON lesson_progress(lesson_id);
```

---

## Relationship Summary

| Relationship | Type | FK |
|---|---|---|
| `users` → `courses` | One-to-Many | `courses.teacher_id` |
| `courses` → `modules` | One-to-Many | `modules.course_id` |
| `modules` → `lessons` | One-to-Many | `lessons.module_id` |
| `lessons` → `materials` | One-to-Many | `materials.lesson_id` |
| `users` ↔ `courses` (enrollment) | Many-to-Many | `enrollments(student_id, course_id)` |
| `users` ↔ `lessons` (progress) | Many-to-Many | `lesson_progress(student_id, lesson_id)` |
| `users` + `courses` → `chat_threads` | One-to-Many | `chat_threads(student_id, course_id)` |
| `chat_threads` → `chat_messages` | One-to-Many | `chat_messages.thread_id` |

---

## Notes

1. **UUIDs everywhere** — Avoids sequential ID enumeration; safe for public-facing APIs.
2. **Cascade deletes** — Deleting a course removes its modules, lessons, materials, enrollments, and chat threads.
3. **Gemini URIs are nullable** — They are populated asynchronously after Gemini File API calls succeed.
4. **Context window usage** — Gemini models support large context windows. `chat_threads` and `chat_messages` are stored locally, and the history is passed along with `gemini_file_uri`s on every request, avoiding the need for an external stateful Assistant API.
