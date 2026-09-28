# 🎬 Cinema Booking System Backend

Hệ thống quản lý đặt vé xem phim - Backend API được xây dựng cho môn học Phân tích Thiết kế Hệ thống Thông tin.

## 🛠️ Tech Stack

| Công nghệ | Phiên bản |
|-----------|-----------|
| Node.js | >= 18.x |
| Express | ^4.21 |
| TypeScript | ^5.8 |
| Prisma ORM | 5.22.0 |
| MySQL | 8.x |
| Zod | ^3.24 |
| bcrypt | ^5.1 |
| JWT | ^9.0 |

## 📁 Cấu trúc dự án

```
cinema-booking-system-backend/
├── src/
│   ├── app.ts                     # Express app setup
│   ├── server.ts                  # Server entry point
│   ├── config/
│   │   ├── env.ts                 # Environment config & validation
│   │   └── prisma.ts              # Prisma client singleton
│   ├── routes/index.ts            # Composition root, giữ URL contract
│   ├── modules/
│   │   ├── identity/              # Auth, tài khoản, quản trị user
│   │   ├── catalog/               # Phim, đánh giá
│   │   ├── cinema/                # Phòng, sơ đồ và loại ghế
│   │   ├── showtime/              # Suất chiếu, ghế theo suất
│   │   ├── booking/               # Giữ ghế, đặt/hủy vé, lịch sử
│   │   ├── billing/               # Payment, giao dịch, hoàn tiền
│   │   ├── reporting/             # Thống kê Admin
│   │   └── operational-settings/  # Policy giữ ghế runtime
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT verification
│   │   ├── role.middleware.ts     # Role-based authorization
│   │   ├── validate.middleware.ts # Zod schema validation
│   │   ├── error.middleware.ts    # Global error handler
│   │   └── not-found.middleware.ts# 404 handler
│   ├── shared/                    # Primitive dùng chung, không chứa nghiệp vụ
│   ├── utils/
│   │   ├── jwt.ts                 # JWT sign/verify helpers
│   │   ├── password.ts            # bcrypt helpers
│   │   ├── response.ts            # Standard response format
│   │   ├── errors.ts              # Custom error classes
│   │   └── asyncHandler.ts        # Async error wrapper
│   └── types/
│       └── express.d.ts           # Express type augmentation
├── prisma/
│   ├── schema.prisma              # Prisma schema (MySQL)
│   └── seed.ts                   # Database seed script
├── .env.example                  # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Hướng dẫn cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Thiết lập biến môi trường

Sao chép file `.env.example` và điền các giá trị:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
DATABASE_URL=mysql://root:your_password@localhost:3306/cinema_booking_db
PORT=5000
NODE_ENV=development
ACCESS_TOKEN_SECRET=your_very_long_random_secret_here
REFRESH_TOKEN_SECRET=another_very_long_random_secret_here
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
API_PREFIX=/api/v1
```

### 3. Tạo cơ sở dữ liệu MySQL

```sql
CREATE DATABASE cinema_booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Chạy migration

```bash
npx prisma migrate dev --name init
```

### 6. Seed dữ liệu mẫu

```bash
npm run prisma:seed
```

### 7. Khởi động server (development)

```bash
npm run dev
```

Server sẽ chạy tại: `http://localhost:5000`

---

## 📋 API Endpoints

### Health Check

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/health` | Kiểm tra trạng thái server |

### Auth

| Method | Endpoint | Mô tả | Access |
|--------|----------|-------|--------|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản mới | Public |
| POST | `/api/v1/auth/login` | Đăng nhập | Public |
| POST | `/api/v1/auth/refresh-token` | Làm mới access token | Public |
| POST | `/api/v1/auth/logout` | Đăng xuất | Private |
| GET | `/api/v1/auth/me` | Thông tin tài khoản hiện tại | Private |

### Phim (Movies)

| Method | Endpoint | Mô tả | Access |
|--------|----------|-------|--------|
| GET | `/api/v1/phim` | Danh sách phim (có lọc, phân trang) | Public |
| GET | `/api/v1/phim/:maPhim` | Chi tiết phim | Public |
| POST | `/api/v1/admin/phim` | Tạo phim mới | ADMIN |
| PUT | `/api/v1/admin/phim/:maPhim` | Cập nhật phim | ADMIN |
| PATCH | `/api/v1/admin/phim/:maPhim/soft-delete` | Ẩn phim (soft delete) | ADMIN |
| DELETE | `/api/v1/admin/phim/:maPhim` | Xóa phim vĩnh viễn | ADMIN |

### Query params cho GET /api/v1/phim

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `keyword` | string | Tìm theo tên phim, đạo diễn, diễn viên |
| `theLoai` | string | Lọc theo thể loại |
| `gioiHanTuoi` | P \| C13 \| C16 \| C18 | Lọc theo giới hạn tuổi |
| `page` | number | Trang hiện tại (mặc định: 1) |
| `limit` | number | Số lượng mỗi trang (mặc định: 10, tối đa: 100) |

---

## 📦 Scripts

| Script | Lệnh | Mô tả |
|--------|------|-------|
| `npm run dev` | ts-node-dev | Chạy server development (hot reload) |
| `npm run build` | tsc | Build TypeScript |
| `npm start` | node dist/server.js | Chạy bản production |
| `npm run prisma:generate` | prisma generate | Generate Prisma Client |
| `npm run prisma:migrate` | prisma migrate dev | Chạy migration |
| `npm run prisma:studio` | prisma studio | Mở Prisma Studio GUI |
| `npm run prisma:seed` | ts-node prisma/seed.ts | Seed dữ liệu mẫu |

---

## 👥 Tài khoản mẫu (sau khi seed)

| Vai trò | Tên đăng nhập | Mật khẩu |
|---------|---------------|----------|
| ADMIN | `admin` | `123456` |
| CUSTOMER | `khachhang01` | `123456` |

---

## 🔐 Xác thực (JWT)

### Flow đăng nhập:
1. `POST /auth/login` → nhận `accessToken` + `refreshToken`
2. Sử dụng `accessToken` trong header: `Authorization: Bearer <accessToken>`
3. Khi `accessToken` hết hạn → `POST /auth/refresh-token` với `{ refreshToken }` để lấy token mới

### Token:
- **Access Token**: hết hạn sau 15 phút
- **Refresh Token**: hết hạn sau 7 ngày, được hash và lưu trong DB

---

## 📊 Database Schema

```
TaiKhoan (tai_khoan)
  ├── KhachHang (khach_hang) - quan hệ 1-1
  └── RefreshToken (refresh_token) - quan hệ 1-n

KhachHang 1 ── n PhieuDatVe 1 ── n ChiTietDatVe
PhieuDatVe 1 ── n GiaoDich 1 ── n LichSuHoanTien
Phim 1 ── n SuatChieu 1 ── n GheSuatChieu

Enum Role: ADMIN | CUSTOMER
```

---

## 🔒 Phân quyền (RBAC)

| Hành động | ADMIN | CUSTOMER | Public |
|-----------|-------|----------|--------|
| Xem phim/suất chiếu | ✅ | ✅ | ✅ |
| Quản lý phim, phòng, suất chiếu | ✅ | ❌ | ❌ |
| Giữ ghế, đặt vé, xem lịch sử | ❌ | ✅ | ❌ |
| Quản lý giao dịch, hoàn tiền, thống kê | ✅ | ❌ | ❌ |

---

## 📝 Response Format

### Thành công:
```json
{
  "success": true,
  "message": "Thông báo thành công",
  "data": {}
}
```

### Lỗi:
```json
{
  "success": false,
  "message": "Thông báo lỗi",
  "errors": {}
}
```
