# DEPLOYMENT & NETWORK DIAGRAM

Tài liệu này mô tả sơ đồ triển khai hiện tại, các điểm tiếp xúc mạng, cấu hình ngrok/Vercel và lệnh khởi chạy.

## 1. Mô tả topology

Logical overview:

- `Vercel (Frontend)` https://dacn-orcin.vercel.app
  - Gọi API qua `VITE_API_BASE` (HTTPS) → Ngrok public URL

- `Ngrok (tunnel vnpay)`
  - Tunneling public HTTPS → local backend:3000
  - Ví dụ hiện tại: https://awaited-easy-marten.ngrok-free.app

- `Backend (local)`
  - Node/Express lắng nghe `:3000` (hoặc `process.env.PORT`)
  - Mở Serial `COM5` để nhận dữ liệu IoT
  - Kết nối tới Postgres
  - Gửi mail qua Gmail SMTP

- `Mobile (Flutter)`
  - Chạy trên thiết bị thật; gọi backend thông qua ngrok URL (HTTPS)

ASCII diagram (simplified):

```
 [Vercel Web]  --HTTPS-->  [Ngrok public URL]  --tunnel-->  [Local Backend:3000]
                                             |
                                             +---> [Postgres DB]
                                             |
                                             +---> [Gmail SMTP]
                                             |
                                             +---> [Serial USB COM5] ---> [IoT device]
                                             |
                                             +-- WebSocket --> [Web / Mobile clients]
```

## 2. Ngrok config (example)

Place in `~/.ngrok2/ngrok.yml` or repo if you prefer:

```yaml
tunnels:
  vnpay:
    addr: 3000
    proto: http
    host_header: rewrite
```

Start ngrok:

```bash
ngrok start vnpay
# or specify config file
ngrok start --config=/path/to/ngrok.yml vnpay
```

Ngrok will print a public HTTPS URL (use that value for `VITE_API_BASE` and mobile config).

## 3. Environment variables (minimum)

- Backend (`backend/.env`):
  - `PORT=3000`
  - `DATABASE_URL` (or DB_HOST/DB_USER/DB_PASS/...)
  - `JWT_SECRET`
  - `MAIL_USER`, `MAIL_PASS` (Gmail app password recommended)

- Frontend (Vercel env):
  - `VITE_API_BASE=https://<your-ngrok-subdomain>.ngrok-free.app`

## 4. Run steps quick reference

1) Backend (local)

```bash
cd backend
npm install
node index.js
```

2) Ngrok

```bash
ngrok start vnpay
```

3) Frontend (if local)

```bash
cd frontend
npm install
npm run dev
```

4) Mobile

```bash
cd mobile
flutter pub get
flutter run -d <device-id>
```

## 5. Troubleshooting & notes

- CORS: ensure backend whitelist includes Vercel and ngrok URL. Backend allows null origin for mobile/postman.
- Mixed content: frontend on HTTPS must call HTTPS API (ngrok provides HTTPS).
- Ngrok URL volatility: free-tier URLs change on restart — update `VITE_API_BASE` on Vercel or mobile config after restart.
- Serial port: ensure correct COM number (Windows Device Manager) and that no other program locks the port.
- Gmail: prefer app password; watch for send rate limits.


