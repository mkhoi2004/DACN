# Hướng dẫn chạy và liên kết Backend / Frontend / Mobile

Phiên bản ngắn: Backend chạy local port `3000`, public qua ngrok tunnel tên `vnpay` (command: `ngrok start vnpay`). Frontend deploy: `https://dacn-orcin.vercel.app` (hoặc chạy local). Mobile: Flutter chạy trên thiết bị thật trỏ tới ngrok URL.

## Yêu cầu
- Node.js & npm
- Ngrok (đã login `ngrok authtoken <token>`)
- Vercel account (nếu deploy frontend)
- Flutter SDK và thiết bị thật (Android/iOS)

---

## 1. Backend (local trên port 3000)

1. Vào thư mục `backend` và cài dependency:

```powershell
cd backend
npm install
```

2. Thiết lập biến môi trường:
- Nếu có file `.env.example` sao chép thành `.env` và chỉnh thông tin: DB, MAILER, JWT_SECRET, v.v.

3. Chạy server (đảm bảo nó lắng nghe `3000`):

```powershell
npm start
# hoặc
node index.js
```

4. Kiểm tra:

```powershell
curl http://localhost:3000
```

---

## 2. Expose backend bằng ngrok (dùng tunnel đặt tên `vnpay`)

1. Cấu hình ngrok (tạo hoặc chỉnh file `ngrok.yml` ở `~/.ngrok2/ngrok.yml` hoặc trong repo nếu muốn):

```yaml
tunnels:
  vnpay:
    addr: 3000
    proto: http
    host_header: rewrite
```

2. Đăng nhập (nếu chưa):

```powershell
ngrok authtoken <YOUR_AUTHTOKEN>
```

3. Khởi chạy tunnel bằng tên `vnpay` (theo yêu cầu):

```powershell
ngrok start vnpay
```

4. Khi ngrok chạy, nó sẽ in ra URL public dạng `https://<subdomain>.ngrok-free.app`.
- Theo yêu cầu hiện tại sử dụng: `https://awaited-easy-marten.ngrok-free.app` (nếu đang active).

Lưu ý:
- Nếu bạn muốn chỉ định file config khác, dùng `ngrok start --config=path/to/ngrok.yml vnpay`.
- Đảm bảo dùng HTTPS để tránh lỗi mixed-content trên frontend.

---

## 3. Frontend (Vercel hoặc local)

Option A — Chạy local (dev):

1. Mở `frontend/src/api.js` và set base API lên ngrok URL (ví dụ):

```js
// frontend/src/api.js
const API_BASE = import.meta.env.VITE_API_BASE || 'https://awaited-easy-marten.ngrok-free.app';
export default API_BASE;
```

2. Chạy frontend local:

```powershell
cd frontend
npm install
npm run dev
```

Option B — Deploy trên Vercel (`https://dacn-orcin.vercel.app`):

1. Trong Vercel Dashboard → Project → Settings → Environment Variables, thêm biến `VITE_API_BASE` = `https://awaited-easy-marten.ngrok-free.app`.
2. Nếu code dùng `import.meta.env.VITE_API_BASE`, Vercel sẽ inject biến và bạn chỉ cần redeploy.

Kiểm tra bằng DevTools (Network) để thấy request tới ngrok URL.

---

## 4. Mobile (Flutter) — thiết bị thật

1. Tìm file cấu hình API trong `mobile/lib` (ví dụ `lib/config/` hoặc `lib/constants.dart`) và đặt base URL thành ngrok URL:

```dart
const String API_BASE = 'https://awaited-easy-marten.ngrok-free.app';
```

2. Cài dependency và chạy trên thiết bị thật:

```bash
cd mobile
flutter pub get
flutter devices
flutter run -d <device-id>
```

3. Nếu build release và cài thủ công (Android):

```bash
flutter build apk --release
# rồi cài file apk trên thiết bị
```

Ghi chú: Vì dùng ngrok (HTTPS) nên không cần bật cleartext. Nếu bạn dùng HTTP, cần cấu hình `android:usesCleartextTraffic` (không khuyến nghị).

---

## 5. Kiểm tra & xác thực

- Kiểm tra backend public:

```powershell
curl https://awaited-easy-marten.ngrok-free.app/health
```
- Kiểm tra từ frontend: mở `https://dacn-orcin.vercel.app` và xem Network logs.
- Kiểm tra từ mobile: xem logs trong terminal khi chạy `flutter run`.

---

## 6. Khắc phục sự cố thường gặp

- Lỗi CORS: bật middleware CORS trên backend (Express ví dụ `npm install cors` và `app.use(cors({ origin: ['https://dacn-orcin.vercel.app','http://localhost:5173'] }))`).
- Ngrok URL thay đổi: nếu dùng tài khoản free, URL thay đổi khi restart; cập nhật `VITE_API_BASE` hoặc `API_BASE` trên mobile và redeploy/rebuild.
- Mixed content: đảm bảo API dùng `https://` nếu frontend trên HTTPS.
- Ngrok chưa authenticated: chạy `ngrok authtoken <token>`.

---

## 7. Lệnh tóm tắt nhanh

```powershell
# Backend
cd backend
npm install
npm start

# Ngrok (tunnel 'vnpay' chỉ vào port 3000)
ngrok start vnpay

# Frontend local
cd ../frontend
npm install
npm run dev

# Flutter (thiết bị thật)
cd ../mobile
flutter pub get
flutter run -d <device-id>
```

---

Nếu bạn muốn, tôi có thể:
- Tự động thêm mẫu `ngrok.yml` vào repo `backend` hoặc gốc repo.
- Chỉnh `frontend/src/api.js` hoặc tạo ví dụ `lib/config/api.dart` cho Flutter.

Yêu cầu tiếp theo của bạn là gì? Muốn tôi tạo `ngrok.yml` mẫu trong repo không?
