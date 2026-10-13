# Hướng Dẫn Deploy Lên Vercel

Dự án đã được tối ưu hóa đầy đủ để triển khai (deploy) trực tiếp lên nền tảng **Vercel**.

## 1. Deploy Tự Động (1-Click Deploy)

Bấm vào nút bên dưới để tự động tạo dự án mới trên Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcmsva%2Fhoangandev.git&env=MONGODB_URI,JWT_SECRET,ENCRYPTION_KEY,NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_APP_NAME&envDescription=Nhap%20thong%20tin%20MongoDB%20URI%20va%20cac%20khoa%20bao%20mat&project-name=hoangandev&repository-name=hoangandev)

---

## 2. Các Biến Môi Trường Cần Thiết Trên Vercel

Khi deploy trên Vercel, hãy cấu hình các biến môi trường (Environment Variables) trong phần **Settings → Environment Variables**:

| Tên biến | Bắt buộc | Giá trị mẫu / Hướng dẫn |
|---|---|---|
| `NODE_ENV` | Có | `production` |
| `NEXT_PUBLIC_APP_URL` | Có | `https://your-domain.vercel.app` (hoặc custom domain của bạn) |
| `NEXT_PUBLIC_APP_NAME` | Không | `HoangAnDev` |
| `MONGODB_URI` | Có | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/hoangandev?retryWrites=true&w=majority` |
| `JWT_SECRET` | Có | Chuỗi ngẫu nhiên tối thiểu 32 ký tự (ví dụ: `4f9b2a8c7e1d5a6b0c3e2f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c`) |
| `ENCRYPTION_KEY` | Có | Chuỗi 64 ký tự hex (32 bytes) dùng cho mã hóa AES-256 (tạo bằng lệnh `openssl rand -hex 32`) |
| `CRON_ENGINE` | Không | `true` |
| `REDIS_URL` | Không | URL Upstash Redis nếu bạn muốn dùng rate limiting và distributed cache |

---

## 3. Lưu Ý Khi Deploy Vercel
- Hệ thống hỗ trợ hoàn toàn Next.js 16 App Router với SSR, API routes và static prerendering an toàn.
- Nếu bạn sử dụng custom domain, hãy thêm domain vào tab **Domains** trong Vercel Project Settings và cập nhật lại biến `NEXT_PUBLIC_APP_URL`.
