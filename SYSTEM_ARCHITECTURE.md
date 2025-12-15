# SYSTEM ARCHITECTURE

Tài liệu tóm tắt kiến trúc hệ thống DACN — các thành phần, giao tiếp, và nơi chứa mã nguồn liên quan.

## 1. Tổng quan thành phần

- **Frontend (Web)**
  - Framework: React + Vite
  - Triển khai: Vercel — https://dacn-orcin.vercel.app
  - Source: frontend/
  - API base được cấu hình qua `VITE_API_BASE` (xem `frontend/src/api.js`).

- **Backend (API, Realtime, Serial)**
  - Node.js + Express, WebSocket (ws)
  - Đọc dữ liệu từ thiết bị IoT qua Serial (USB, ví dụ `COM5`) bằng `serialport`.
  - Xử lý dữ liệu: lưu vào Postgres, broadcast qua WebSocket, gửi email alert qua Gmail SMTP.
  - Source: backend/ (entry: backend/index.js, DB helper: backend/db.js, mailer: backend/mailer.js)

- **Database**
  - Postgres được đóng gói và chạy trong Docker (định nghĩa trong `backend/docker-compose.yml`).
  - Khởi động container bằng: `cd backend && docker-compose up -d`.
  - Backend kết nối tới Postgres qua `DATABASE_URL` hoặc hostname `db` (theo cấu hình trong `backend/docker-compose.yml`).

- **Mobile (Flutter)**
  - Chạy trên thiết bị thật, gọi backend thông qua URL public (ngrok).
  - Source: mobile/

- **IoT devices**
  - Thiết bị (Arduino/ESP, ...) gửi các dòng text qua USB serial.
  - Dữ liệu có dạng line-based: `SNAP:...`, `EV:...`, `ALERT:...`.

## 2. Giao tiếp & giao thức

- HTTP(S): REST API cho các thao tác CRUD, auth, quản lý, v.v.
- WebSocket: realtime broadcast sự kiện đến clients (web/mobile).
- Serial (USB): cổng COM trên host (ví dụ `COM5`) — backend mở và parse dòng văn bản.
- Email/SMTP: gửi cảnh báo qua Gmail (mailer module).

## 3. Luồng dữ liệu chính

1. IoT -> Serial -> Backend
   - IoT gửi dòng; backend parse; lưu vào DB; broadcast qua WebSocket.
2. Frontend/Mobile -> Backend (REST)
   - Gọi API để quản lý user, lấy lịch sử, xử lý alert, v.v.
3. Alert không handled -> Backend gửi Email -> Ghi `email_logs` vào DB

## 4. Auth & Bảo mật

- JWT cho authentication; `JWT_SECRET` lưu trong `.env` (không commit).
- CORS: backend whitelist origin (Vercel + ngrok URL) và cho phép null origin cho mobile/postman.
- Không commit credentials (DB, MAIL_PASS). Dùng `.env` hoặc secret store.

## 5. Key files (tham chiếu)

- Backend entry: [backend/index.js](backend/index.js)
- DB helper: [backend/db.js](backend/db.js)
- Mailer: [backend/mailer.js](backend/mailer.js)
- Frontend API base: [frontend/src/api.js](frontend/src/api.js)

## 6. Frontend deployment (Vercel)

- **URL (production):** https://dacn-orcin.vercel.app
- **Repository / Source:** `frontend/` (connected branch in Vercel).
- **Build & deploy:** Vercel auto-deploys on push to the connected branch. Alternatively use `vercel --prod` from the `frontend/` folder.
- **Environment variable:** Add `VITE_API_BASE` in Vercel Project Settings and set it to your public backend URL (ngrok HTTPS for local testing or production API URL).
- **Recommendation:** Use a stable backend endpoint for production. If using ngrok for local backend, update `VITE_API_BASE` whenever the ngrok URL changes.

## 6. Triển khai Frontend (Vercel)

- **URL (production):** https://dacn-orcin.vercel.app
- **Kho nguồn / Thư mục:** `frontend/` (branch được kết nối trên Vercel).
- **Build & deploy:** Vercel tự động deploy khi có push lên branch được kết nối. Có thể deploy thủ công bằng `vercel --prod` từ thư mục `frontend/`.
- **Biến môi trường:** Thêm `VITE_API_BASE` trong Vercel Project Settings và đặt giá trị là URL backend công cộng (dùng ngrok HTTPS cho test local hoặc URL production cho môi trường thật).
- **Khuyến nghị:** Sử dụng endpoint backend ổn định cho production. Nếu dùng ngrok để test local, nhớ cập nhật `VITE_API_BASE` khi URL ngrok thay đổi.



