# 📋 Kịch Bản Demo — RakuLearn LMS

> **Dự án:** RakuLearn — Hệ thống Quản lý Học tập (LMS) dành cho môi trường Đại học
> **Thời lượng ước tính:** 20–25 phút
> **Người trình bày:** Sinh viên thực hiện đồ án
> **Đối tượng:** Giáo viên hướng dẫn (Giảng viên phản biện)
> **Ngày cập nhật:** 2026-06-19

---

## Tổng Quan Demo

Demo được chia thành **8 Phân cảnh (Scenes)**, dẫn dắt từ tổng quan kỹ thuật → trải nghiệm Giảng viên → trải nghiệm Sinh viên → tích hợp AI → kết luận:

| # | Phân cảnh | Thời lượng | Vai trò đăng nhập |
|---|-----------|------------|-------------------|
| 1 | Branding & First Impression | 2 phút | Chưa đăng nhập |
| 2 | Đăng ký & Đăng nhập | 2 phút | Đăng ký mới |
| 3 | Teacher: Tạo & Quản lý Khóa học | 4 phút | TEACHER |
| 4 | Teacher: Quản lý Sinh viên & Private Course | 3 phút | TEACHER |
| 5 | Student: Trải nghiệm Học tập | 3 phút | STUDENT |
| 6 | Student: Làm bài Quiz & Review | 3 phút | STUDENT |
| 7 | AI Tutor & Gemini Integration | 4 phút | STUDENT → TEACHER |
| 8 | Production Deployment & Data Engineering | 2 phút | Terminal |

---

## Phân Cảnh 1 — Branding & First Impression

### 🎯 Mục tiêu
Chứng minh ứng dụng có thiết kế chuyên nghiệp, chất lượng production-grade, không phải một prototype thô sơ.

### 🖱️ Hành động
1. Mở trình duyệt tại trang **Login** (`/login`).
2. **Dừng lại 3 giây** — để hiệu ứng animation chạy hoàn toàn.
3. Trỏ chuột vào logo **RakuLearn** ở góc trên.
4. Scroll nhẹ — quan sát animation background.
5. Click vào nút "Chưa có tài khoản? Đăng ký" → chuyển sang `/register` — quan sát animation chuyển cảnh.

### 💬 Lời thoại

> *"Đây là RakuLearn — Hệ thống Quản lý Học tập mà em xây dựng cho đồ án. Ngay từ trang đăng nhập, em muốn nhấn mạnh rằng đây không phải một bài tập frontend đơn giản.*
>
> *Logo RakuLearn sử dụng typography đối lập có chủ đích: chữ 'Raku' dùng font chữ viết tay Caveat, nghiêng -2 độ — tạo cảm giác thân thiện, nhân văn. Chữ 'Learn' dùng font Sans-serif đậm — thể hiện sự vững chắc, học thuật. Sự kết hợp này truyền tải triết lý của app: việc học nên nhẹ nhàng nhưng vẫn nghiêm túc.*
>
> *Background không phải là ảnh tĩnh — đây là animation CSS thuần, sử dụng kỹ thuật blob morphing với pan và scale, tạo nên hiệu ứng organic loop. Toàn bộ được viết bằng CSS `@keyframes`, không dùng bất kỳ thư viện animation JavaScript nào."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Tailwind CSS v4 | Kiến trúc CSS-first mới với `@theme` trong `global.css`, không còn dùng file config `tailwind.config.js` truyền thống |
| CSS Keyframes Animation | Blob pan/scale animation — organic loop, zero JS |
| Contrast Typography | Font Caveat (handwriting) + Sans-serif — brand identity có chủ đích |
| Lucide-React Icons | Toàn bộ emoji được thay thế bằng icon vector chuyên nghiệp |

---

## Phân Cảnh 2 — Đăng ký & Đăng nhập (Authentication)

### 🎯 Mục tiêu
Chứng minh hệ thống xác thực hoàn chỉnh, bảo mật đúng chuẩn enterprise: JWT, bcrypt, dual-delivery, role-based access.

### 🖱️ Hành động
1. Tại trang `/register`, nhập thông tin hợp lệ (email, mật khẩu, họ tên), chọn vai trò **STUDENT**.
2. **Cố tình để trống một field** → quan sát thông báo lỗi validation hiển thị realtime.
3. Sửa lại → Submit → tự động chuyển sang `/login`.
4. Đăng nhập bằng tài khoản **TEACHER** đã seed sẵn.
5. Quan sát Dashboard hiển thị đúng vai trò.

### 💬 Lời thoại

> *"Hệ thống xác thực của RakuLearn là custom JWT — không dùng NextAuth hay bất kỳ thư viện auth bên thứ ba nào. Em tự implement toàn bộ flow: register, login, route protection.*
>
> *Password được hash bằng bcrypt trước khi lưu vào database — không bao giờ lưu plaintext. Khi đăng nhập thành công, JWT token được deliver theo chiến lược Dual-Delivery — đây là một quyết định kiến trúc quan trọng mà em ghi nhận trong ADR-002.*
>
> *(Chỉ vào form validation)... Validation ở đây dùng Zod v4 — chạy realtime trên cả client và server, cùng một schema. Nếu ai đó bypass frontend và gọi API trực tiếp bằng curl, server vẫn reject request sai format."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| JWT Dual-Delivery (ADR-002) | HTTP-only cookie (`auth_token`) cho Next.js Middleware + `localStorage` cho client-side `fetch` qua `Authorization: Bearer` header |
| bcryptjs | Password hashing — one-way, salt-based |
| Zod v4 Shared Schemas | Cùng schema validate trên client (react-hook-form) và server (route handler) — `z.input<>` / `z.output<>` |
| Next.js Middleware | Route protection tại Edge Runtime — đọc JWT từ cookie, redirect nếu chưa xác thực |
| Zero Trust (ADR-001) | Mỗi API endpoint tự kiểm tra auth + role + ownership — không dựa vào request trước đó |

---

## Phân Cảnh 3 — Teacher: Tạo & Quản lý Khóa học

### 🎯 Mục tiêu
Chứng minh RakuLearn là một LMS hoàn chỉnh với đầy đủ flow quản lý khóa học: tạo, chỉnh sửa, sắp xếp curriculum, upload tài liệu.

### 🖱️ Hành động
1. **Dashboard** (`/dashboard`) — Quan sát giao diện Teacher Dashboard với thống kê tổng quan.
2. **Tạo khóa học mới** → Click "Tạo khóa học" → Nhập tiêu đề, mô tả → Submit.
3. **Course Edit Page** (`/courses/[id]/edit`) → Quan sát tabs: *Thông tin*, *Chương trình*, *Tài liệu*, *Cài đặt AI*.
4. **Curriculum Builder:**
   - Tạo một Module mới (VD: "Chương 1: Giới thiệu").
   - Tạo 2 Lesson trong module đó (1 LECTURE + 1 QUIZ).
   - **Drag & Drop** module — kéo thả để sắp xếp thứ tự.
   - **Up/Down arrows** — sắp xếp bài học trong module.
5. **Upload tài liệu:**
   - Vào tab "Tài liệu" → Upload một file PDF.
   - Quan sát **progress bar** upload realtime.
   - Quan sát file xuất hiện trong bảng tài liệu với status upload.
6. **Publish khóa học** → Toggle "Đã xuất bản" → Save.

### 💬 Lời thoại

> *"Đây là flow chính của Giảng viên. Giao diện quản lý khóa học được thiết kế theo mô hình tab-based, tương tự cách Google Classroom hay Coursera xử lý.*
>
> *Curriculum Builder hỗ trợ cấu trúc Module → Lesson. Thứ tự sắp xếp dùng `orderIndex` — em dùng kỹ thuật auto-calculation: khi tạo mới, server tự tính `max(orderIndex) + 1`. Khi reorder bằng drag-and-drop, client gửi mảng ID đã sắp xếp, server xử lý trong transaction. Đây là ADR-004.*
>
> *Phần upload tài liệu — progress bar realtime. Thú vị là ở đây em phải dùng XMLHttpRequest thay vì Fetch API. Lý do: Fetch API không hỗ trợ upload progress — nó chỉ có download progress trên `Response.body` ReadableStream. Chỉ có `xhr.upload.onprogress` mới cung cấp event này. Em đã cân nhắc dùng Axios nhưng quyết định không thêm dependency 13KB chỉ cho một feature. Quyết định này được ghi nhận trong ADR-009.*
>
> *File upload lên UploadThing — cloud storage — rồi URL được lưu vào database. Mô hình Storage Adapter cho phép chuyển sang S3 trong tương lai mà không cần thay đổi bất kỳ route handler nào."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Service Layer Pattern (ADR-003) | Route handler gọi service function — không bao giờ import Prisma trực tiếp |
| orderIndex Auto-Calc (ADR-004) | `max(orderIndex) + 1` — server-side, tránh race condition |
| @dnd-kit/sortable | Module drag-and-drop với `PointerSensor`, `activationConstraint: { distance: 6 }` |
| XMLHttpRequest (ADR-009) | `xhr.upload.onprogress` — upload progress tracking không cần thư viện bên ngoài |
| UploadThing (ADR-012) | Cloud storage backend — App Router file router, typed integration |
| SSR Safety (ADR-008) | Markdown Editor dùng `next/dynamic({ ssr: false })` — tránh `window is not defined` |
| State Decoupling (ADR-008) | CurriculumEditor tách biệt khỏi CourseForm — tránh cross-component re-render |

---

## Phân Cảnh 4 — Teacher: Quản lý Sinh viên & Private Course

### 🎯 Mục tiêu
Chứng minh RakuLearn giải quyết được bài toán thực tế của môi trường đại học: lớp tín chỉ bắt buộc cần kiểm soát enrollment.

### 🖱️ Hành động
1. **Course Settings** → Bật toggle **"Khóa học riêng tư"** (Private Course / Closed Enrollment).
2. **Tab Sinh viên** → Quan sát bảng danh sách sinh viên (hiện tại trống hoặc có vài sinh viên).
3. **Thêm sinh viên hàng loạt (Bulk Enroll):**
   - Click "Thêm sinh viên".
   - Trong dialog, bắt đầu gõ email → quan sát **autocomplete gợi ý** xuất hiện realtime.
   - Chọn 2-3 sinh viên → email xuất hiện dưới dạng **Badge** có nút xóa.
   - Submit → thông báo thành công, bảng cập nhật.
4. **Xóa sinh viên hàng loạt (Bulk Delete):**
   - Tick **Checkbox** chọn 2 sinh viên trong bảng.
   - Quan sát **Action Bar** xuất hiện: "Xóa 2 sinh viên".
   - Click → **AlertDialog** xác nhận hiện ra → Xác nhận → Xóa thành công.

### 💬 Lời thoại

> *"Đây là tính năng em tự hào nhất vì nó giải quyết một bài toán thực tế mà không có trong Coursera hay Udemy.*
>
> *Trong môi trường đại học, nhiều lớp tín chỉ là bắt buộc — sinh viên không được tự đăng ký hay tự hủy đăng ký. Khi bật 'Khóa học riêng tư', nút Enroll trên trang public sẽ bị disabled, và API endpoint `/enroll` cũng reject request. Zero Trust — cả frontend và backend đều kiểm tra flag `isPrivate`.*
>
> *Giảng viên thêm sinh viên qua Bulk Enroll. Dialog cho phép gõ email — hệ thống gọi API `/users/search` asynchronous để gợi ý. Mỗi email được chọn hiển thị dưới dạng Badge có thể xóa — pattern này giống cách Gmail xử lý recipients. Khi submit, API xử lý thông minh: trả về `addedCount`, `matchedCount`, `skippedCount` — giảng viên biết chính xác có bao nhiêu sinh viên được thêm thành công.*
>
> *Xóa hàng loạt dùng checkbox selection với Action Bar. AlertDialog bảo vệ chống click nhầm — pattern phổ biến trong các ứng dụng enterprise."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Private Course (ADR-018) | `Course.isPrivate` — enforce ở cả UI (disabled CTA) và API (reject request) |
| Async Autocomplete | Debounced `GET /api/users/search?q=...` — lightweight student lookup by email/name |
| Removable Badge UX | Gmail-style recipient chips — visual, interactive, cancelable |
| Bulk Enroll API | `POST /api/courses/[courseId]/enroll-bulk` — trả về `addedCount`/`matchedCount`/`skippedCount` |
| Bulk Delete | `DELETE /api/courses/[courseId]/enroll-bulk` với `{ userIds: [...] }` |
| Shadcn AlertDialog | Confirmation dialog — chống destructive action nhầm lẫn |
| Shadcn Checkbox + DataTable | Row selection pattern cho bảng danh sách |

---

## Phân Cảnh 5 — Student: Trải nghiệm Học tập

### 🎯 Mục tiêu
Chứng minh trải nghiệm học tập mượt mà, có progress tracking, bookmarks, và giao diện thân thiện.

### 🖱️ Hành động
1. **Đăng xuất** → Đăng nhập lại bằng tài khoản **STUDENT**.
2. **Course Catalog** (`/courses`) → Quan sát Course Cards với gradient Sky-themed.
3. **Dùng Search Bar** → Tìm kiếm khóa học.
4. **Click vào một khóa học** → Trang chi tiết → Click **"Ghi danh"** (nếu khóa học public).
5. **Course Learning Hub** (`/courses/[id]/learn`):
   - Quan sát **sidebar module/lesson** với progress indicator.
   - Click vào một bài giảng → đọc nội dung Markdown.
   - Click nút **"Hoàn thành bài học"** → progress bar cập nhật realtime.
   - Click **Bookmark icon** ⭐ trên một bài học.
   - Click **"Bài học đã lưu"** → Dialog hiển thị danh sách bookmarks.
6. **Download tài liệu** → Click nút download trên file PDF đính kèm.

### 💬 Lời thoại

> *"Bây giờ em chuyển sang góc nhìn sinh viên. Trang catalog hiển thị Course Cards với Sky-themed gradient — không phải màu phẳng, mà là gradient động dựa trên palette thiết kế.*
>
> *Course Learning Hub là trung tâm học tập. Sidebar bên trái hiển thị toàn bộ curriculum — module, bài học — với progress indicator. Khi sinh viên hoàn thành bài, API `POST /api/lessons/[id]/progress` upsert trạng thái vào bảng `LessonProgress`. Progress tổng thể của khóa học được tính realtime từ service layer — không lưu trữ số phần trăm cứng, mà derive từ dữ liệu gốc.*
>
> *Tính năng Bookmark cho phép sinh viên save bài học quan trọng mà không gây rối layout. Một model `Bookmark` riêng biệt, join giữa `User` và `Lesson` với unique constraint — toggle idempotent. Đây là ADR-017.*
>
> *Toàn bộ giao diện này sử dụng consolidated Learn API — một endpoint duy nhất `/courses/[id]/learn` trả về cả course data và `completedLessonIds` trong một request, tránh network waterfall."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Consolidated Learn API | `GET /courses/[id]/learn` — trả về `{ course, completedLessonIds }` trong 1 request |
| Derived Progress | Không lưu percentage cứng — tính từ `LessonProgress` records |
| Upsert Pattern | `@@unique([studentId, lessonId])` — idempotent completion toggle |
| Bookmark (ADR-017) | `Bookmark` model riêng biệt — independent từ progress & enrollment |
| Dynamic Gradients | Course Cards dùng Sky-themed gradient, không flat color |
| Shared Search Bar | Component dùng chung cho catalog và my-courses |

---

## Phân Cảnh 6 — Student: Làm bài Quiz & Review

### 🎯 Mục tiêu
Chứng minh Quiz UX đạt chuẩn "university-grade": navigation thông minh, logic chọn/bỏ chọn đáp án, review kết quả với AI giải thích.

### 🖱️ Hành động
1. Từ Learning Hub, click vào một **bài Quiz** (lesson type = QUIZ).
2. Quan sát giao diện quiz:
   - **Single-column layout** — câu hỏi theo chiều dọc.
   - **Horizontal Sticky Navigator** dính dưới Navbar — hiển thị các nút 1, 2, 3... cho từng câu.
3. **Click câu 5** trên Navigator → trang scroll smooth xuống câu 5.
4. **Chọn đáp án** cho câu 5 → Radio button active.
5. **Click lại đáp án đã chọn** → Đáp án bị bỏ chọn (**Flex-Unselect logic**).
6. **Trả lời hết** → Submit bài → Xem điểm.
7. **Trang Review:**
   - Xem lại từng câu — đáp án đúng/sai được highlight.
   - Click **"Giải thích bằng AI"** trên một câu sai → Gemini trả về explanation ngắn gọn.

### 💬 Lời thoại

> *"Quiz engine là một trong những phần phức tạp nhất của dự án. Em thiết kế UX theo mô hình university exam — không phải quiz nhỏ của Duolingo.*
>
> *Layout single-column với Horizontal Sticky Navigator — luôn dính dưới Navbar. Khi scroll trang, Navigator vẫn visible. Click vào số câu — trang smooth scroll đến câu đó. `scroll-mt-40` đảm bảo câu hỏi không bị che khuất bởi Navbar và Navigator.*
>
> *Điểm nhấn quan trọng nhất: Flex-Unselect. Đây là một UX pain point mà nhiều hệ thống quiz lớn vẫn mắc phải. Khi sinh viên click radio button chọn đáp án A, rồi muốn bỏ chọn — hầu hết form HTML không cho phép vì behavior mặc định của radio group là phải luôn có một lựa chọn. Em implement custom logic: click vào đáp án đã chọn sẽ clear selection — sinh viên có thể để trống câu nếu không chắc chắn.*
>
> *Sau khi submit, trang Review hiển thị kết quả chi tiết. Và đây là phần AI: mỗi câu sai có nút 'Giải thích bằng AI'. Gemini API nhận vào questionText, options, correctOption, studentOption — trả về lời giải thích ngắn gọn, tập trung vào lý do đáp án đúng và sai lầm phổ biến."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Horizontal Sticky Navigator | `position: sticky` dưới Navbar — persistent question navigation |
| `scroll-mt-40` | CSS scroll margin — đảm bảo câu hỏi không bị che khi scroll |
| Flex-Unselect Logic | Custom radio button behavior — click lại để deselect, giải quyết HTML radio limitation |
| Quiz Data Model (ADR-013) | `Quiz → QuizQuestion → QuizOption`, `QuizAttempt → QuizAnswer` |
| AI Quiz Explanation | `POST /api/quiz/explain` — Gemini context: question + options + student answer |
| Attempt Safety | Existing attempts block destructive question/option edits |
| Submission Scoring | Server-side score calculation — `score` / `totalPoints` |

---

## Phân Cảnh 7 — AI Tutor & Gemini Integration

### 🎯 Mục tiêu
Chứng minh AI không chỉ là chatbot generic — mà là Pedagogical AI Assistant: grounded trong tài liệu khóa học, và cung cấp insights dạy học cho giảng viên.

### 🖱️ Hành động

**Phần A — Student: AI Tutor Chat (3 phút)**

1. Từ trang bài giảng, click nút **"Hỏi AI Tutor"** → Shadcn **Sheet** slide từ bên phải.
2. Quan sát chat interface trong Sheet — **không rời khỏi trang bài giảng**.
3. Gõ một câu hỏi liên quan đến nội dung bài (VD: *"Giải thích khái niệm biến đổi Z cho em"*) → AI trả lời.
4. Quan sát: câu trả lời render **Markdown**, bao gồm **LaTeX math** nếu có.
5. Đóng Sheet → Vào trang **Chat toàn màn hình** (`/courses/[id]/chat`).
6. Quan sát **Thread Sidebar** — lịch sử cuộc hội thoại.
7. Tạo thread mới → Hỏi câu khác → Quan sát thread xuất hiện.

**Phần B — Teacher: AI Pedagogical Insights (1 phút)**

8. **Đăng xuất** → Đăng nhập lại bằng **TEACHER**.
9. Vào **Course Analytics** → Tab **Quiz Analytics**.
10. Click vào một quiz cụ thể → Trang **Quiz Analytics Detail**.
11. Quan sát bảng **"Câu hỏi khó nhất"** (Top Difficult Questions) — tỷ lệ sai cao nhất.
12. Click **"Xin lời khuyên từ AI"** → Gemini phân tích danh sách câu hỏi sai nhiều nhất → trả về **lời khuyên giảng dạy**.

### 💬 Lời thoại

> *"Phần AI là điểm khác biệt lớn nhất của RakuLearn so với các LMS truyền thống.*
>
> *Đầu tiên, AI Tutor cho sinh viên. Khi sinh viên đang đọc bài giảng và có câu hỏi, họ click 'Hỏi AI Tutor' — một Shadcn Sheet slide ra từ bên phải mà không rời trang bài giảng. Pattern này em học từ Google NotebookLM — giữ context đọc trong khi chat. Quyết định này được ghi trong ADR-011.*
>
> *Quan trọng: AI Tutor không phải ChatGPT generic. Mỗi câu trả lời được grounded trong tài liệu PDF của khóa học. Khi giảng viên bật AI cho khóa học, hệ thống upload toàn bộ PDF lên Gemini File API, lưu `geminiFileUri` vào database. Khi sinh viên hỏi, backend gửi cho Gemini: system prompt + file references + toàn bộ chat history. AI chỉ trả lời dựa trên tài liệu đã upload — đây gọi là grounded generation.*
>
> *Model em chọn là `gemini-3.1-flash-lite` — nhanh, tiết kiệm, và context window đủ lớn để truyền nguyên file PDF. Không cần vector store hay RAG pipeline phức tạp.*
>
> *(Chuyển sang Teacher) Nhưng phần ấn tượng hơn là AI cho giảng viên. Hệ thống tổng hợp 'Top Câu hỏi khó nhất' từ quiz — những câu sinh viên sai nhiều nhất, kèm tỷ lệ sai. Khi giảng viên click 'Xin lời khuyên từ AI', Gemini nhận danh sách này và trả về phân tích sư phạm: sinh viên đang hiểu sai khái niệm nào, cần nhấn mạnh phần nào trong buổi giảng tiếp theo.*
>
> *Đây không phải chatbot — đây là Pedagogical AI Assistant."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Google Gemini (`@google/genai`) | SDK chính thức — không dùng `@google/generative-ai` (deprecated) |
| Model: `gemini-3.1-flash-lite` | Fast, cost-effective, large context window |
| Gemini File API | Upload PDF → `ai.files.upload()` → poll `state === "ACTIVE"` → lưu `geminiFileUri` |
| Grounded Generation | System prompt + file URIs + chat history → `generateContent()` |
| Stateless Chat Architecture | Mỗi request rebuild full context — không dùng Gemini session state |
| Dual Chat Layout (ADR-011) | Standalone page + Shadcn Sheet trên lesson view |
| Markdown + LaTeX | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` |
| AI Pedagogical Advice | `POST /api/lessons/[id]/quiz/ai-advice` — top difficult questions → teaching insights |
| AI Quiz Generation (ADR-014) | `responseMimeType: "application/json"` + `responseSchema` + Zod validation |
| Gemini Re-Sync (ADR-015) | Material dashboard hiển thị freshness indicator, resync từ UploadThing URL |

---

## Phân Cảnh 8 — Production Deployment & Data Engineering

### 🎯 Mục tiêu
Chứng minh dự án không chỉ chạy localhost — mà có quy trình triển khai production thực tế, bao gồm data migration pipeline.

### 🖱️ Hành động
1. Mở **terminal** — show cấu trúc thư mục `prisma/`.
2. Chạy lệnh `npm run db:extract` → show file `data.json` được tạo.
3. Giải thích flow: `extract.ts` → `data.json` → `seed.ts` → Production DB.
4. **(Nếu có thời gian)** Mở app trên **Vercel production URL** → show cùng dữ liệu.
5. Quay lại slides/app → show bảng **15 models** trong Prisma Schema.

### 💬 Lời thoại

> *"Cuối cùng, em muốn nói về phần Data Engineering — thường bị bỏ qua nhưng rất quan trọng.*
>
> *Thách thức: làm sao migrate dữ liệu mock từ local development lên Vercel Production mà không gặp lỗi constraint — vì database có 15 models liên kết chặt chẽ với cascade delete, unique constraints, và foreign keys.*
>
> *Em xây dựng một pipeline tự động: `prisma/extract.ts` đọc toàn bộ dữ liệu local — users, courses, modules, lessons, materials, quizzes, attempts — xuất ra file `data.json`. Sau đó `prisma/seed.ts` nhận file này, dùng Prisma `upsert` để restore dữ liệu lên production. Upsert đảm bảo: nếu record đã tồn tại thì update, nếu chưa thì create — không bao giờ lỗi duplicate key.*
>
> *Prisma Schema hiện có 15 models, 10 quan hệ chính, cascade delete xuyên suốt từ Course đến QuizAnswer. Đây là một relational database thực thụ — không phải NoSQL document store đơn giản."*

### 🔧 Điểm nhấn công nghệ

| Kỹ thuật | Chi tiết |
|----------|----------|
| Prisma ORM | 15 models, PostgreSQL 16, typed queries, cascade deletes |
| `extract.ts` + `seed.ts` | Automated data pipeline — export → JSON → upsert vào production |
| Upsert Strategy | Tránh duplicate key errors khi re-seed — idempotent |
| BigInt Serialization (ADR-007) | Global `BigInt.prototype.toJSON` patch — xử lý `Material.fileSizeBytes` |
| 15 Prisma Models | User, Course, Module, Lesson, Material, Enrollment, ChatThread, ChatMessage, LessonProgress, Bookmark, Quiz, QuizQuestion, QuizOption, QuizAttempt, QuizAnswer |
| 50+ API Endpoints | Full CRUD + analytics + AI — inventory trong `02-api-contracts.md` |

---

## 🎤 Lời kết thúc Demo

> *"Tổng kết, RakuLearn là một hệ thống LMS fullstack monolith xây dựng trên Next.js 15 với:*
>
> - *15 database models, 50+ API endpoints, 18 quyết định kiến trúc được ghi nhận*
> - *Hệ thống xác thực JWT custom với Zero Trust security*
> - *Quiz engine university-grade với UX nâng cao*
> - *AI Tutor grounded trong tài liệu khóa học, không phải chatbot generic*
> - *AI Pedagogical Advisor cho giảng viên — từ dữ liệu quiz sang insights giảng dạy*
> - *Production deployment pipeline với automated data migration*
>
> *Em tin rằng RakuLearn không chỉ là một đồ án học phần — mà là một sản phẩm có thể tiếp tục phát triển và triển khai thực tế trong môi trường đại học.*
>
> *Em xin cảm ơn Thầy/Cô. Em sẵn sàng trả lời câu hỏi."*

---

## 🧠 Dự Đoán Câu Hỏi Của Giáo Viên & Cách Trả Lời

### ❓ Q1: "Tại sao em không dùng NextAuth (Auth.js) mà tự viết authentication?"

> **Trả lời:**
>
> *"Đây là quyết định có chủ đích. NextAuth tối ưu cho việc đăng nhập bằng OAuth providers (Google, GitHub). Nhưng RakuLearn cần email/password authentication truyền thống — phù hợp với môi trường đại học nơi sinh viên dùng email trường.*
>
> *Thêm nữa, em muốn hiểu sâu cách JWT hoạt động — từ signing, verification, đến middleware integration. Với NextAuth, em sẽ bị abstract hóa khỏi chi tiết này. Chiến lược Dual-Delivery (cookie + localStorage) là kết quả của việc em phải giải quyết bài toán thực tế: Edge Runtime không có `localStorage`, còn client-side `fetch` cần `Authorization` header.*
>
> *Nếu dự án mở rộng cần OAuth, em hoàn toàn có thể add thêm provider mà không thay đổi core JWT logic."*

---

### ❓ Q2: "Tại sao dùng Gemini mà không dùng OpenAI GPT?"

> **Trả lời:**
>
> *"Hai lý do chính:*
>
> 1. *Gemini File API cho phép upload PDF trực tiếp vào context window mà không cần dựng RAG pipeline phức tạp (chunking, embedding, vector store). GPT-4 Turbo cũng có vision nhưng File API của Gemini tích hợp tốt hơn cho use case truyền file lớn.*
>
> 2. *`gemini-3.1-flash-lite` nhanh hơn và rẻ hơn GPT-3.5 cho task grounded Q&A. Context window đủ lớn cho nhiều file PDF cùng lúc.*
>
> *Tuy nhiên, kiến trúc của em dùng Service Layer — toàn bộ Gemini logic nằm trong `lib/gemini/gemini.service.ts`. Nếu muốn chuyển sang GPT hay Claude, chỉ cần thay implementation trong file này — route handlers không thay đổi."*

---

### ❓ Q3: "Hệ thống này có xử lý concurrent access không? Ví dụ 100 sinh viên submit quiz cùng lúc?"

> **Trả lời:**
>
> *"Có, ở multiple layers:*
>
> - *Database level: PostgreSQL với ACID transactions. `QuizAttempt` creation là atomic — không bị conflict.*
> - *Unique constraints: `@@unique([studentId, lessonId])` cho progress, `@@unique([studentId, courseId])` cho enrollment — PostgreSQL reject duplicate ở DB level, không phụ thuộc vào app logic.*
> - *orderIndex: khi reorder modules, em dùng `prisma.$transaction` — batch update atomic, tránh partial update.*
> - *Connection pooling: Prisma Client singleton pattern — một instance duy nhất cho cả Next.js app, tránh connection exhaustion.*
>
> *Tuy nhiên, em chưa implement rate limiting cho Gemini API calls — đây là improvement cho production. Em đã design error handling cho Gemini 429 (rate limit) response nhưng chưa implement preemptive throttling."*

---

### ❓ Q4: "Tại sao chọn monolith fullstack thay vì tách backend riêng (microservices)?"

> **Trả lời:**
>
> *"Với quy mô hiện tại, Next.js fullstack monolith là lựa chọn tối ưu:*
>
> - *Deployment: một app duy nhất trên Vercel — không cần orchestrate multiple services.*
> - *Type safety: Prisma types flow từ schema → service → route handler → component mà không cần serialize qua network boundary.*
> - *Server Components: có thể query Prisma trực tiếp trong page render — zero network round-trip cho data fetching (ADR-010).*
> - *Shared validation: Zod schema dùng chung giữa API và frontend — DRY principle.*
>
> *Nếu scale lên, em có thể extract Gemini service thành microservice riêng (vì nó đã isolated trong `lib/gemini/`) mà không cần refactor core LMS logic."*

---

### ❓ Q5: "Em xử lý file upload security như thế nào? Có thể upload malware không?"

> **Trả lời:**
>
> *"Nhiều lớp bảo vệ:*
>
> 1. *MIME type allowlist: chỉ chấp nhận PDF, video, image — reject executable files (.sh, .exe, .php) trước khi xử lý.*
> 2. *File size validation: kiểm tra `file.size` trước khi upload — fail fast, không ghi file lớn dở dang lên disk.*
> 3. *Filename sanitization: UUID prefix + non-ASCII cleaning — chống path traversal (`../../etc/passwd`).*
> 4. *Auth gating: chỉ TEACHER/ADMIN mới có quyền upload — middleware kiểm tra JWT trước khi xử lý file.*
> 5. *Path traversal guard: `absolutePath.startsWith(UPLOADS_ROOT)` — validate đường dẫn trước khi serve hay delete.*
> 6. *Cloud storage: UploadThing xử lý physical storage — app không trực tiếp ghi file lên server filesystem.*
>
> *Chi tiết đầy đủ trong ADR-006."*

---

### ❓ Q6: "Tailwind CSS v4 khác v3 như thế nào? Tại sao em chọn v4?"

> **Trả lời:**
>
> *"Điểm khác biệt lớn nhất: Tailwind v4 chuyển sang CSS-first architecture. Thay vì config bằng JavaScript trong `tailwind.config.js`, em khai báo design tokens trực tiếp trong `global.css` bằng directive `@theme`. Ví dụ:*
>
> ```css
> @theme {
>   --color-primary: oklch(0.65 0.19 240);
>   --font-heading: 'Inter', sans-serif;
> }
> ```
>
> *Ưu điểm: CSS native — IDE autocomplete tốt hơn, không cần restart dev server khi thay đổi theme, và loại bỏ dependency vào JavaScript config ecosystem.*
>
> *Em chọn v4 vì muốn dùng phiên bản mới nhất, và architecture mới phù hợp với triết lý của đồ án: tối ưu, hiện đại, production-grade."*

---

### ❓ Q7: "Nếu Gemini File API reference hết hạn thì sao?"

> **Trả lời:**
>
> *"Em đã xử lý case này — ghi nhận trong ADR-015. Gemini File API có retention window — sau thời gian nhất định, file reference trở nên unusable.*
>
> *Giải pháp: UploadThing URL là source of truth bền vững. Trong Materials Dashboard, mỗi file có Gemini sync freshness indicator. Nếu reference cũ, giảng viên click 'Re-sync' — hệ thống tải file từ UploadThing URL, upload lại lên Gemini, cập nhật `geminiFileUri` và `geminiFileName` trong database. Không cần giảng viên re-upload file gốc.*
>
> *Kiến trúc two-tier: UploadThing (durable) → Gemini File API (cache-like, regenerable)."*

---

### ❓ Q8: "AI quiz generation có đảm bảo chất lượng không? Làm sao validate output?"

> **Trả lời:**
>
> *"Đây là bài toán thú vị. Em dùng Gemini structured output:*
>
> - *`responseMimeType: "application/json"` — buộc model trả JSON, không trả text tự do.*
> - *`responseSchema` — định nghĩa cấu trúc output: array of questions, mỗi question có `questionText`, `options` (array), `correctOptionIndex`.*
> - *Sau khi nhận response, Zod validate toàn bộ cấu trúc trước khi hiển thị cho giảng viên.*
>
> *Quan trọng: AI generation chỉ trả về draft — không tự động lưu vào database. Giảng viên review, chỉnh sửa trong Quiz Builder, rồi mới save. Đây là ADR-014 — giữ quyền kiểm soát cho giảng viên, không để AI tạo quiz trực tiếp."*

---

## 📌 Checklist Trước Khi Demo

- [ ] Database đã seed đầy đủ dữ liệu mock (courses, students, quiz attempts)
- [ ] Tài khoản TEACHER và STUDENT đã chuẩn bị sẵn (ghi email/password ra giấy)
- [ ] Ít nhất 1 khóa học đã có quiz với student attempts (để demo analytics)
- [ ] Gemini API key hoạt động (test trước 1 lần)
- [ ] UploadThing đang active (test upload 1 file nhỏ)
- [ ] Trình duyệt đã clear cache, không auto-fill password
- [ ] Zoom trình duyệt 110-125% cho dễ nhìn trên projector
- [ ] Tắt notifications máy tính (Do Not Disturb mode)
- [ ] File PDF sẵn sàng để demo upload (nhỏ, dưới 5MB, load nhanh)
- [ ] Mở sẵn tab Vercel production (nếu demo production deployment)
- [ ] Đọc lại toàn bộ kịch bản 1 lần, canh thời gian
