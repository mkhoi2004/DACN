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


