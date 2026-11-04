# Game Hub

Cổng mini game: đăng nhập bằng ví MetaMask (SIWE), bảng xếp hạng, giao diện song ngữ Việt/Anh.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS 4 · next-intl · viem

Kế hoạch & tiến độ: xem [WORKFLOW.md](./WORKFLOW.md)

## Yêu cầu
- Node.js 20.9 trở lên
- Docker Desktop (để chạy PostgreSQL)
- Trình duyệt có extension MetaMask

## Chạy lần đầu

```bash
# 1. Tạo file .env từ mẫu, rồi mở .env và thay JWT_SECRET bằng chuỗi ngẫu nhiên
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Cài thư viện (tự chạy prisma generate)
npm install

# 3. Bật PostgreSQL bằng Docker (cổng 5433)
npm run db:up

# 4. Tạo bảng trong database
npm run db:migrate -- --name init

# 5. Thêm dữ liệu mẫu (game 2048)
npm run db:seed

# 6. Chạy web
npm run dev
```

Mở http://localhost:3000

> Thêm địa chỉ ví admin vào `ADMIN_WALLETS` trong `.env`. Khi deploy, dùng `JWT_SECRET` khác với máy dev.

## Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy web ở chế độ dev |
| `npm run build` | Build production |
| `npm run typecheck` | Kiểm tra lỗi TypeScript |
| `npm run db:up` / `db:down` | Bật / tắt PostgreSQL |
| `npm run db:migrate` | Tạo migration khi sửa `prisma/schema.prisma` |
| `npm run db:seed` | Thêm dữ liệu mẫu |
| `npm run db:studio` | Mở giao diện xem/sửa database |
| `npm run db:reset` | Xóa sạch DB, chạy lại migration + seed |

## Cấu trúc thư mục

```
prisma/            schema.prisma, seed.ts, migrations/
messages/          vi.json, en.json (bản dịch)
public/games/      các game HTML5 (mỗi game 1 thư mục)
src/app/           trang & API routes (Next.js App Router)
src/components/    component giao diện
src/i18n/          cấu hình song ngữ (ngôn ngữ lưu trong cookie NEXT_LOCALE)
src/lib/           prisma client, env, tiện ích dùng chung
```
