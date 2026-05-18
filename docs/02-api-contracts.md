# API Contracts — E-Learning LMS

> **Version:** 2.0  
> **Last Updated:** 2026-05-18  
> **Base URL:** `http://localhost:8000/api/v1`  
> **Auth:** Bearer JWT token in `Authorization` header (unless noted as Public)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Courses](#3-courses)
4. [Modules](#4-modules)
5. [Lessons](#5-lessons)
6. [Materials](#6-materials)
7. [Enrollments](#7-enrollments)
8. [AI Tutor Chat](#8-ai-tutor-chat)

---

## Common Conventions

### Response Envelope

All responses follow a consistent structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "message": "Detailed error description",
  "errors": [
    { "field": "email", "message": "Email already registered" }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful delete) |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient role) |
| `404` | Not Found |
| `422` | Unprocessable Entity |
| `500` | Internal Server Error |

### Pagination Query Params

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | `int` | `1` | Page number |
| `limit` | `int` | `20` | Items per page (max 100) |

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

## 1. Authentication

### `POST /api/v1/auth/register`

> **Access:** Public

Register a new user account.

**Request Body:**

```json
{
  "email": "student@example.com",
  "password": "securePass123!",
  "full_name": "John Doe",
  "role": "STUDENT"
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "student@example.com",
    "full_name": "John Doe",
    "role": "STUDENT",
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### `POST /api/v1/auth/login`

> **Access:** Public

Authenticate and receive a JWT.

**Request Body:**

```json
{
  "email": "student@example.com",
  "password": "securePass123!"
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "student@example.com",
      "full_name": "John Doe",
      "role": "STUDENT"
    }
  }
}
```

---

### `GET /api/v1/auth/me`

> **Access:** Authenticated

Get current user profile.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "student@example.com",
    "full_name": "John Doe",
    "role": "STUDENT",
    "avatar_url": null,
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

## 2. Users

### `GET /api/v1/users`

> **Access:** ADMIN only

List all users with pagination.

**Query Params:** `page`, `limit`, `role` (optional filter)

**Response `200 OK`:** Paginated list of user objects.

---

### `GET /api/v1/users/{user_id}`

> **Access:** ADMIN or self

Get a single user profile.

---

### `PATCH /api/v1/users/{user_id}`

> **Access:** ADMIN or self

Update user profile.

**Request Body (partial):**

```json
{
  "full_name": "Jane Doe",
  "avatar_url": "https://cdn.example.com/avatars/jane.jpg"
}
```

---

### `DELETE /api/v1/users/{user_id}`

> **Access:** ADMIN only

Soft-delete a user (sets `is_active = false`).

**Response:** `204 No Content`

---

## 3. Courses

### `POST /api/v1/courses`

> **Access:** TEACHER, ADMIN

Create a new course.

**Request Body:**

```json
{
  "title": "Introduction to Machine Learning",
  "description": "A beginner-friendly course covering ML fundamentals.",
  "thumbnail_url": "https://cdn.example.com/courses/ml-101.jpg"
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Introduction to Machine Learning",
    "description": "A beginner-friendly course covering ML fundamentals.",
    "thumbnail_url": "https://cdn.example.com/courses/ml-101.jpg",
    "teacher_id": "550e8400-e29b-41d4-a716-446655440000",
    "ai_enabled": false,
    "is_published": false,
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### `GET /api/v1/courses`

> **Access:** Public (published only) | TEACHER sees own courses | ADMIN sees all

**Query Params:** `page`, `limit`, `search` (title search)

**Response `200 OK`:** Paginated list of course objects.

---

### `GET /api/v1/courses/{course_id}`

> **Access:** Public (if published) | Owner | Enrolled student | ADMIN

Get full course details including module/lesson tree.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Introduction to Machine Learning",
    "description": "...",
    "teacher": {
      "id": "...",
      "full_name": "Dr. Smith",
      "avatar_url": "..."
    },
    "ai_enabled": true,
    "is_published": true,
    "modules": [
      {
        "id": "...",
        "title": "Week 1: Foundations",
        "order_index": 0,
        "lessons": [
          {
            "id": "...",
            "title": "What is ML?",
            "order_index": 0,
            "material_count": 2
          }
        ]
      }
    ],
    "enrolled_count": 42,
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### `PATCH /api/v1/courses/{course_id}`

> **Access:** Owner TEACHER, ADMIN

Update course metadata.

**Request Body (partial):**

```json
{
  "title": "Updated Title",
  "is_published": true
}
```

---

### `DELETE /api/v1/courses/{course_id}`

> **Access:** Owner TEACHER, ADMIN

Delete a course and all nested resources. Also cleans up Gemini files.

**Response:** `204 No Content`

---

### `POST /api/v1/courses/{course_id}/setup-ai`

> **Access:** Owner TEACHER, ADMIN

Manually trigger creation of Gemini file integrations for this course. Uploads all existing materials to Gemini using the File API.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "ai_enabled": true,
    "files_synced": 5
  },
  "message": "AI Tutor enabled. 5 files uploaded to Gemini."
}
```

---

## 4. Modules

### `POST /api/v1/courses/{course_id}/modules`

> **Access:** Owner TEACHER, ADMIN

**Request Body:**

```json
{
  "title": "Week 1: Foundations",
  "description": "Introduction and core concepts.",
  "order_index": 0
}
```

**Response `201 Created`:** Module object.

---

### `GET /api/v1/courses/{course_id}/modules`

> **Access:** Enrolled student, Owner, ADMIN

List all modules for a course, ordered by `order_index`.

---

### `PATCH /api/v1/courses/{course_id}/modules/{module_id}`

> **Access:** Owner TEACHER, ADMIN

Update module title, description, or order.

---

### `DELETE /api/v1/courses/{course_id}/modules/{module_id}`

> **Access:** Owner TEACHER, ADMIN

**Response:** `204 No Content`

---

## 5. Lessons

### `POST /api/v1/modules/{module_id}/lessons`

> **Access:** Course Owner TEACHER, ADMIN

**Request Body:**

```json
{
  "title": "What is Machine Learning?",
  "content": "# Introduction\n\nMachine learning is...",
  "order_index": 0
}
```

**Response `201 Created`:** Lesson object.

---

### `GET /api/v1/modules/{module_id}/lessons`

> **Access:** Enrolled student, Owner, ADMIN

List all lessons for a module.

---

### `GET /api/v1/lessons/{lesson_id}`

> **Access:** Enrolled student, Owner, ADMIN

Get lesson detail with materials list.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "What is Machine Learning?",
    "content": "# Introduction\n\n...",
    "order_index": 0,
    "materials": [
      {
        "id": "...",
        "title": "ML Basics Slides.pdf",
        "material_type": "PDF",
        "file_url": "/files/materials/abc123.pdf",
        "file_size_bytes": 2048576,
        "gemini_file_uri": "https://generativelanguage.googleapis.com/v1beta/files/abc12345"
      }
    ],
    "module_id": "...",
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### `PATCH /api/v1/lessons/{lesson_id}`

> **Access:** Course Owner TEACHER, ADMIN

---

### `DELETE /api/v1/lessons/{lesson_id}`

> **Access:** Course Owner TEACHER, ADMIN

**Response:** `204 No Content`

---

## 6. Materials

### `POST /api/v1/lessons/{lesson_id}/materials/upload`

> **Access:** Course Owner TEACHER, ADMIN

Upload a file and optionally sync it to Gemini File API if the course has AI enabled.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `File` | Yes | The file to upload |
| `title` | `string` | No | Display name (defaults to filename) |
| `material_type` | `string` | No | `PDF`, `VIDEO`, `LINK`, `OTHER` (defaults to `PDF`) |

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "ML Basics Slides.pdf",
    "material_type": "PDF",
    "file_url": "/files/materials/abc123.pdf",
    "file_size_bytes": 2048576,
    "gemini_file_uri": "https://generativelanguage.googleapis.com/v1beta/files/abc12345",
    "lesson_id": "...",
    "created_at": "2026-05-18T10:00:00Z"
  },
  "message": "File uploaded and synced to AI tutor."
}
```

---

### `GET /api/v1/lessons/{lesson_id}/materials`

> **Access:** Enrolled student, Owner, ADMIN

List all materials for a lesson.

---

### `GET /api/v1/materials/{material_id}/download`

> **Access:** Enrolled student, Owner, ADMIN

Download the material file. Returns a file stream or redirect to storage URL.

---

### `DELETE /api/v1/materials/{material_id}`

> **Access:** Course Owner TEACHER, ADMIN

Deletes material from storage and removes from Gemini if synced.

**Response:** `204 No Content`

---

## 7. Enrollments

### `POST /api/v1/courses/{course_id}/enroll`

> **Access:** STUDENT (authenticated)

Enroll the current student in a published course.

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "student_id": "...",
    "course_id": "...",
    "status": "ACTIVE",
    "enrolled_at": "2026-05-18T10:00:00Z"
  },
  "message": "Successfully enrolled in the course."
}
```

---

### `DELETE /api/v1/courses/{course_id}/enroll`

> **Access:** Enrolled STUDENT

Unenroll (drop) from a course. Sets status to `DROPPED`.

**Response:** `204 No Content`

---

### `GET /api/v1/enrollments/my`

> **Access:** STUDENT (authenticated)

List all courses the current student is enrolled in.

**Response `200 OK`:** Paginated list of enrollment objects with nested course summary.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "status": "ACTIVE",
        "enrolled_at": "2026-05-18T10:00:00Z",
        "course": {
          "id": "...",
          "title": "Introduction to Machine Learning",
          "thumbnail_url": "...",
          "teacher": {
            "full_name": "Dr. Smith"
          }
        }
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### `GET /api/v1/courses/{course_id}/students`

> **Access:** Owner TEACHER, ADMIN

List all enrolled students for a course.

---

## 8. AI Tutor Chat

### `POST /api/v1/courses/{course_id}/chat/threads`

> **Access:** Enrolled STUDENT

Create a new chat thread locally.

**Request Body:**

```json
{
  "title": "Help with Gradient Descent"
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "course_id": "...",
    "title": "Help with Gradient Descent",
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### `GET /api/v1/courses/{course_id}/chat/threads`

> **Access:** Enrolled STUDENT (own threads only)

List all chat threads for the current student in this course.

---

### `GET /api/v1/chat/threads/{thread_id}/messages`

> **Access:** Thread owner

Get all messages in a thread.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "role": "user",
      "content": "Can you explain gradient descent?",
      "created_at": "2026-05-18T10:00:00Z"
    },
    {
      "id": "...",
      "role": "model",
      "content": "Gradient descent is an optimization algorithm...",
      "created_at": "2026-05-18T10:00:05Z"
    }
  ]
}
```

---

### `POST /api/v1/chat/threads/{thread_id}/ask`

> **Access:** Thread owner (enrolled STUDENT)

Send a message to the AI Tutor. The backend will:
1. Save the user message locally
2. Gather conversation history and Gemini file URIs
3. Call `genai.generate_content()` (Gemini API)
4. Save the model's response locally
5. Return both messages

**Request Body:**

```json
{
  "message": "Can you explain gradient descent in simple terms?"
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "user_message": {
      "id": "...",
      "role": "user",
      "content": "Can you explain gradient descent in simple terms?",
      "created_at": "2026-05-18T10:01:00Z"
    },
    "assistant_message": {
      "id": "...",
      "role": "model",
      "content": "Sure! Imagine you're standing on a hill and you want to get to the lowest point...",
      "created_at": "2026-05-18T10:01:05Z"
    }
  }
}
```

---

### `DELETE /api/v1/chat/threads/{thread_id}`

> **Access:** Thread owner

Delete a chat thread and its messages locally.

**Response:** `204 No Content`

---

## Endpoint Summary Table

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register |
| `POST` | `/auth/login` | Public | Login |
| `GET` | `/auth/me` | Auth | Current user |
| `GET` | `/users` | ADMIN | List users |
| `GET` | `/users/{id}` | ADMIN/Self | Get user |
| `PATCH` | `/users/{id}` | ADMIN/Self | Update user |
| `DELETE` | `/users/{id}` | ADMIN | Deactivate user |
| `POST` | `/courses` | TEACHER/ADMIN | Create course |
| `GET` | `/courses` | Public/Auth | List courses |
| `GET` | `/courses/{id}` | Public/Auth | Get course detail |
| `PATCH` | `/courses/{id}` | Owner/ADMIN | Update course |
| `DELETE` | `/courses/{id}` | Owner/ADMIN | Delete course |
| `POST` | `/courses/{id}/setup-ai` | Owner/ADMIN | Init Gemini AI integration |
| `POST` | `/courses/{id}/modules` | Owner/ADMIN | Create module |
| `GET` | `/courses/{id}/modules` | Enrolled/Owner | List modules |
| `PATCH` | `/courses/{id}/modules/{id}` | Owner/ADMIN | Update module |
| `DELETE` | `/courses/{id}/modules/{id}` | Owner/ADMIN | Delete module |
| `POST` | `/modules/{id}/lessons` | Owner/ADMIN | Create lesson |
| `GET` | `/modules/{id}/lessons` | Enrolled/Owner | List lessons |
| `GET` | `/lessons/{id}` | Enrolled/Owner | Get lesson detail |
| `PATCH` | `/lessons/{id}` | Owner/ADMIN | Update lesson |
| `DELETE` | `/lessons/{id}` | Owner/ADMIN | Delete lesson |
| `POST` | `/lessons/{id}/materials/upload` | Owner/ADMIN | Upload material |
| `GET` | `/lessons/{id}/materials` | Enrolled/Owner | List materials |
| `GET` | `/materials/{id}/download` | Enrolled/Owner | Download file |
| `DELETE` | `/materials/{id}` | Owner/ADMIN | Delete material |
| `POST` | `/courses/{id}/enroll` | STUDENT | Enroll |
| `DELETE` | `/courses/{id}/enroll` | STUDENT | Unenroll |
| `GET` | `/enrollments/my` | STUDENT | My enrollments |
| `GET` | `/courses/{id}/students` | Owner/ADMIN | List students |
| `POST` | `/courses/{id}/chat/threads` | STUDENT | Create thread |
| `GET` | `/courses/{id}/chat/threads` | STUDENT | List threads |
| `GET` | `/chat/threads/{id}/messages` | Owner | Get messages |
| `POST` | `/chat/threads/{id}/ask` | Owner | Ask AI tutor |
| `DELETE` | `/chat/threads/{id}` | Owner | Delete thread |
