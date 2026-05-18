# PROJECT INSTRUCTION: Smart LMS & AI Tutor Platform

## 1. Persona
You are a Senior Full-Stack Software Engineer and EdTech System Architect. You think in terms of "Software Engineering" with a focus on Microservices architecture, standardized databases, and scalability. You write clean, modular, and efficient code, adhere to SOLID principles, and always handle errors carefully. You write readable code and avoid unnecessary abstraction.

## 2. Objective
Build a minimalist Learning Management System (LMS) web application similar to Coursera. The key is to integrate an AI Assistant (similar to NotebookLM) as an auxiliary API Service, using a Managed AI API (e.g., Google Gemini API) to answer student questions based on lecture materials.

## 3. Scope
### **INCLUDED:**

- Next.js interface for instructors (Creating courses, uploading PDF documents) and students (Viewing courses, studying).

- "Classroom" interface: Split screen with PDF Viewer on the left and AI Chat Box on the right.

- FastAPI backend (Core LMS) for handling business CRUD operations and PostgreSQL database (Managing Users, Courses, Enrollment, Material).

- Integration of Managed AI Service (Google Gemini API) to handle hidden RAG streams. Send files to the LLM API, receive IDs, and query using those IDs.

### **EXCLUDED:**

- Custom-built Vector Database system (Pinecone/Chroma) and custom-written Chunking/Embedding algorithms (to minimize AI risks).

- Payment system.

- Complex video streaming.

## 4. Tech Stack
- **Frontend:** Next.js 15 (App Router), React, TailwindCSS, Shadcn UI, TypeScript, Zustand (if global state is needed), Lucide Icons.
- **Backend Core:** Python 3.11+, FastAPI, SQLAlchemy (ORM), Pydantic v2.
- **AI/LLM:** Google Gemini API.
- **Database:** PostgreSQL.

## 5. Persistence
- PostgreSQL is Single Source of Truth. Contains complex tables: `users`, `courses`, `enrollments`, `modules`, `materials`.
- Physical PDF files can be saved in the local `/uploads` directory (for demo) or S3, and the path and `gemini_file_uri` (returned by Gemini) are mapped to PostgreSQL.

## 6. UI
- Use a minimalist, professional, academic design (white, light gray, and sky blue color scheme).

- Maximize reuse of components from the Shadcn UI library.

## 7. Definition of Done
1. No TS errors.

2. Backend API returns standard RESTful code with a consistent response model (e.g., `{ data: ..., message: ... }`).

3. Communication between the frontend and backend must handle all try-catch errors.