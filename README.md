# HoangAnDev - Hosting & Source Code Management Platform

Dashboard quản lý dịch vụ mã nguồn, website, logo, cronjob và tên miền.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcmsva%2Fhoangandev&env=MONGODB_URI,JWT_SECRET,ENCRYPTION_KEY,NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_APP_NAME&envDescription=Nhap%20thong%20tin%20MongoDB%20URI%20va%20cac%20khoa%20bao%20mat&project-name=hoangandev&repository-name=hoangandev)

---

## 🚀 Deploy lên Vercel (1-Click Deploy)

Bấm trực tiếp vào nút **Deploy with Vercel** ở trên. Vercel sẽ tự động:
1. Clone mã nguồn từ repository `https://github.com/cmsva/hoangandev.git`.
2. Yêu cầu nhập các biến môi trường cấu hình:
   - `MONGODB_URI`: Đường dẫn kết nối MongoDB Atlas (ví dụ: `mongodb+srv://user:password@cluster.mongodb.net/hoangandev?retryWrites=true&w=majority`)
   - `JWT_SECRET`: Khóa bí mật JWT (tối thiểu 32 ký tự ngẫu nhiên)
   - `ENCRYPTION_KEY`: Khóa mã hóa AES-256 (32 bytes hex, tạo bằng `openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_URL`: Domain ứng dụng (ví dụ: `https://hoangandev.vercel.app`)
   - `NEXT_PUBLIC_APP_NAME`: Tên ứng dụng hiển thị (ví dụ: `HoangAnDev`)
3. Tự động Build và Deploy hoàn tất trong vòng 1-2 phút!

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend API**: tRPC v11 + MongoDB (Mongoose)
- **Auth**: JWT httpOnly cookies + middleware protection
- **UI Components**: Radix UI primitives, Lucide Icons, Recharts
- **Hosting Ready**: Vercel Serverless / Node.js VPS / Docker

---

## ⚙️ Biến môi trường (Environment Variables)

| Biến | Bắt buộc | Mô tả | Ví dụ |
|------|----------|-------|-------|
| `NODE_ENV` | Có | Môi trường chạy | `production` |
| `NEXT_PUBLIC_APP_URL` | Có | URL chính thức của ứng dụng | `https://hoangandev.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | Không | Tên thương hiệu hiển thị | `HoangAnDev` |
| `MONGODB_URI` | Có | Connection string MongoDB | `mongodb+srv://...` |
| `JWT_SECRET` | Có | Secret ký JWT (tối thiểu 32 ký tự) | `my-secret-key-at-least-32-chars-long` |
| `JWT_EXPIRES_IN` | Không | Thời hạn token | `7d` |
| `ENCRYPTION_KEY` | Có | Key mã hóa dữ liệu nhạy cảm AES-256 (32 bytes hex) | `openssl rand -hex 32` |
| `CRON_ENGINE` | Không | Bật engine cronjob nội bộ | `true` |
| `REDIS_URL` | Không | Redis URL (Rate limit & caching) | `redis://default:...@...:6379` |

---

## 💻 Triển khai thủ công (Local hoặc VPS)

### 1. Clone repository
```bash
git clone https://github.com/cmsva/hoangandev.git
cd hoangandev
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình file `.env`
Sao chép `.env.example` thành `.env` và điền thông tin:
```bash
cp .env.example .env
```

### 4. Build cho Production
```bash
npm run build
```

### 5. Chạy ứng dụng Production
- Chạy với Node / TSX Server:
```bash
npm start
```
- Chạy nền với PM2:
```bash
npm install -g pm2
pm2 start npm --name "hoangandev" -- start
pm2 save
pm2 startup
```

---

## 📁 Cấu trúc thư mục

```
src/
├── app/                  # Next.js App Router (Pages & API routes)
│   ├── api/              # RESTful API handlers & Webhooks
│   ├── authentication/   # Đăng nhập, đăng ký, quên mật khẩu
│   ├── adminPanel/       # Quản trị viên
│   ├── customer/         # Khách hàng cá nhân
│   └── dashboard/        # Bảng điều khiển dịch vụ
├── components/           # UI components tái sử dụng (shadcn/ui)
├── controllers/          # Business logic (MVC controller layer)
├── models/               # Schema Mongoose (MongoDB models)
├── services/             # Domain logic (xử lý nghiệp vụ)
├── trpc/                 # tRPC router & procedures
├── lib/                  # Database, mã hóa, cache, utilities
└── middleware.ts         # Middleware phân quyền & bảo mật
```

---

## 📄 License
Phát triển và phân phối bởi **HoangAnDev**.
