# RakuLearn

RakuLearn là một hệ thống quản lý học tập (Learning Management System - LMS) dành cho bối cảnh đại học. Ứng dụng hỗ trợ sinh viên, giảng viên và quản trị viên trong các luồng học tập chính như quản lý khóa học, tổ chức nội dung, ghi danh có kiểm soát, theo dõi tiến độ, làm quiz và trao đổi với trợ lý AI theo ngữ cảnh khóa học.

Ứng dụng được xây dựng theo mô hình full-stack monolith với Next.js App Router. Phần mã nguồn chính nằm trong thư mục `client/`, vì vậy hầu hết lệnh cài đặt và phát triển cần được chạy từ thư mục này.

## 1. Giới thiệu

RakuLearn kết hợp các chức năng LMS cơ bản với trợ lý AI sử dụng Gemini. Giảng viên có thể tạo khóa học, tổ chức module/bài học, quản lý học liệu và cấu hình hỗ trợ AI cho khóa học. Sinh viên có thể duyệt khóa học, ghi danh, học bài, đánh dấu bài học quan trọng, theo dõi tiến độ, làm quiz và đặt câu hỏi cho trợ lý AI trong phạm vi khóa học.

Dự án hướng tới mục tiêu học thuật và demo đồ án, chưa đưa ra cam kết về khả năng chịu tải ở quy mô sản xuất hoặc hiệu quả học tập được đo lường định lượng.

## 2. Tính năng chính

- Xác thực người dùng và phân quyền theo vai trò `STUDENT`, `TEACHER`, `ADMIN`.
- Giao diện riêng cho sinh viên, giảng viên và quản trị viên.
- Duyệt danh sách khóa học, xem chi tiết khóa học và ghi danh khóa học.
- Quản lý khóa học, module, bài học và học liệu cho giảng viên.
- Tải lên và lưu trữ học liệu thông qua UploadThing.
- Không gian học tập cho sinh viên theo cấu trúc khóa học, module và bài học.
- Theo dõi tiến độ hoàn thành bài học.
- Đánh dấu bài học quan trọng bằng bookmark.
- Tạo, quản lý và làm quiz; lưu lượt làm bài và kết quả.
- Trợ lý AI theo ngữ cảnh khóa học sử dụng Gemini AI.
- Quản lý người dùng và một số thông tin thống kê/quản trị cơ bản.

## 3. Công nghệ sử dụng

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL
- UploadThing
- Gemini AI thông qua `@google/genai`
- Zod và React Hook Form cho kiểm tra dữ liệu/form
- `jose` và `bcryptjs` cho xác thực JWT và xử lý mật khẩu
- Shadcn/Base UI primitives và các component React tái sử dụng

## 4. Cấu trúc thư mục

```text
.
├── client/                    # Ứng dụng Next.js chính
│   ├── app/                   # App Router pages, layouts và API route handlers
│   ├── components/            # Component giao diện tái sử dụng
│   ├── contexts/              # React contexts, ví dụ AuthContext
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # Auth, services, Prisma, Gemini, utilities
│   ├── prisma/                # Prisma schema, migrations, seed/extract scripts
│   └── public/                # Static assets
├── docs/                      # Tài liệu dự án và tài liệu đồ án
├── docker-compose.yml         # PostgreSQL local và pgAdmin
├── AGENTS.md                  # Hướng dẫn làm việc cho AI/coding agents
└── README.md                  # Tài liệu tổng quan repository
```

## 5. Yêu cầu môi trường

- Node.js phù hợp với Next.js 15.
- npm.
- Docker và Docker Compose nếu muốn chạy PostgreSQL local bằng cấu hình có sẵn.
- PostgreSQL cho môi trường chạy thật hoặc môi trường phát triển không dùng Docker.
- Tài khoản/cấu hình UploadThing nếu sử dụng chức năng upload học liệu.
- Gemini API key nếu sử dụng chức năng trợ lý AI.

## 6. Cài đặt và chạy cục bộ

### 6.1 Cài đặt dependencies

Từ thư mục gốc repository:

```bash
cd client
npm install
```

Sau khi cài đặt, script `postinstall` sẽ chạy `prisma generate`.

### 6.2 Cấu hình biến môi trường

Tạo file môi trường trong thư mục `client/`, ví dụ `client/.env.local` hoặc `client/.env`. Không commit file môi trường thật lên repository.

Các biến được mã nguồn tham chiếu trực tiếp:

| Biến | Mục đích | Ghi chú |
| --- | --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma | Bắt buộc |
| `JWT_SECRET` | Khóa bí mật dùng để ký/xác minh JWT | Bắt buộc; nên đủ dài và không công khai |
| `GEMINI_API_KEY` | API key cho Gemini AI | Cần cho chức năng AI |
| `NODE_ENV` | Môi trường chạy ứng dụng | Thường do runtime thiết lập |
| `NEXT_PUBLIC_API_URL` | Base URL cho đoạn API client cũ | Mã cũ/legacy; không phải kiến trúc API chính hiện tại |

UploadThing cũng cần cấu hình khóa/token theo tài khoản và cấu hình SDK UploadThing đang sử dụng. Hãy kiểm tra cấu hình UploadThing của dự án trước khi chạy chức năng upload, và không ghi giá trị bí mật vào README hoặc commit lên Git.

### 6.3 Khởi tạo cơ sở dữ liệu

Repository có sẵn `docker-compose.yml` ở thư mục gốc để chạy PostgreSQL local và pgAdmin:

```bash
docker compose up -d
```

Sau đó cấu hình `DATABASE_URL` trong file môi trường của `client/` để trỏ tới PostgreSQL local tương ứng.

Chạy các lệnh Prisma từ thư mục `client/`:

```bash
cd client
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

Nếu không cần dữ liệu mẫu, có thể bỏ qua bước seed.

### 6.4 Chạy ứng dụng

Chạy môi trường phát triển:

```bash
cd client
npm run dev
```

Ứng dụng mặc định chạy tại:

```text
http://localhost:3000
```

Build và chạy bản production local:

```bash
npm run build
npm run start
```

## 7. Các script hữu ích

Các script chính được định nghĩa trong `client/package.json`:

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy Next.js ở chế độ phát triển |
| `npm run build` | Build ứng dụng Next.js |
| `npm run start` | Chạy ứng dụng sau khi build |
| `npm run lint` | Chạy ESLint |
| `npm run db:extract` | Chạy script trích xuất dữ liệu trong `prisma/extract.ts` |
| `npm install` | Cài dependencies và tự chạy `prisma generate` qua `postinstall` |

Hiện tại `package.json` chưa định nghĩa script test tự động.

## 8. Triển khai

RakuLearn có thể triển khai như một ứng dụng Next.js trên Vercel. Khi triển khai, cần cấu hình đầy đủ biến môi trường cho database, JWT, UploadThing và Gemini AI trong dashboard của nền tảng triển khai.

Môi trường triển khai thử nghiệm hiện tại:

```text
https://raku-learn.vercel.app/
```

Với môi trường cloud, PostgreSQL có thể được chạy trên dịch vụ quản lý như Neon. Phần triển khai công khai nên được xem là môi trường thử nghiệm/demo, không phải cam kết về hiệu năng hoặc khả năng chịu tải ở quy mô sản xuất.

## 9. Ghi chú

- Không commit `.env`, `.env.local` hoặc bất kỳ file nào chứa khóa bí mật.
- Không sử dụng câu trả lời AI như nguồn chân lý tuyệt đối; trợ lý AI chỉ đóng vai trò hỗ trợ học tập theo ngữ cảnh khóa học.
- Các lệnh ứng dụng chính cần chạy trong thư mục `client/`.
- Nếu thay đổi schema Prisma, hãy chạy lại `npx prisma generate` và cập nhật migration phù hợp.
- Nếu thay đổi lớn về kiến trúc, schema hoặc thư viện, hãy cập nhật tài liệu quyết định kiến trúc của dự án.
