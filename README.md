# Game Hub

[![CI](https://github.com/phh0302/game-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/phh0302/game-hub/actions/workflows/ci.yml)

Cổng mini game: đăng nhập bằng ví MetaMask (SIWE), bảng xếp hạng, giao diện song ngữ Việt/Anh.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS 4 · next-intl · viem

Kế hoạch & tiến độ: xem [WORKFLOW.md](./WORKFLOW.md) · Tích hợp game cho developer: [docs/GAME_SDK.md](./docs/GAME_SDK.md) · Kiểm thử thủ công: [docs/TEST_CHECKLIST.md](./docs/TEST_CHECKLIST.md) · Deploy: [docs/DEPLOY.md](./docs/DEPLOY.md) · Bảo mật: [docs/SECURITY.md](./docs/SECURITY.md)

## Yêu cầu
- Node.js 22.12 trở lên (Node 20 đã hết hỗ trợ)
- Docker Desktop (để chạy PostgreSQL)
- Trình duyệt có extension MetaMask

## Chạy lần đầu

```bash
# 1. Tạo file .env từ mẫu, rồi mở .env và thay JWT_SECRET bằng chuỗi ngẫu nhiên
#    (DATABASE_URL_UNPOOLED để giống hệt DATABASE_URL khi chạy trên máy)
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Cài thư viện (tự chạy prisma generate)
npm install

# 3. Bật PostgreSQL bằng Docker (cổng 5433)
npm run db:up

# 4. Tạo bảng trong database
npm run db:migrate -- --name init

# 5. Thêm dữ liệu mẫu (thể loại, studio Game Hub, game 2048)
npm run db:seed

# 6. Chạy web
npm run dev
```

Mở http://localhost:3000

> Thêm địa chỉ ví admin vào `ADMIN_WALLETS` trong `.env`. Khi deploy, dùng `JWT_SECRET` khác với máy dev.
> Deploy lên mạng: xem [docs/DEPLOY.md](./docs/DEPLOY.md). Ở production dùng `npm run db:deploy` (không dùng `migrate dev`).

## Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy web ở chế độ dev |
| `npm run build` | Build production |
| `npm run typecheck` | Kiểm tra lỗi TypeScript |
| `npm test` | Chạy unit test (`tests/unit/`) |
| `npm run audit` | Kiểm tra lỗ hổng thư viện |
| `npm run db:up` / `db:down` | Bật / tắt PostgreSQL |
| `npm run db:migrate` | Tạo migration khi sửa `prisma/schema.prisma` |
| `npm run db:seed` | Thêm dữ liệu mẫu |
| `npm run db:studio` | Mở giao diện xem/sửa database |
| `npm run db:reset` | Xóa sạch DB, chạy lại migration + seed |

## Cấu trúc thư mục

```
prisma/              schema.prisma, seed.ts, migrations/
messages/            vi.json, en.json (bản dịch giao diện)
public/sdk/          Game Hub SDK cho game (gamehub-sdk.js)
public/uploads/      file tĩnh khi chạy local: ảnh, bản build game (games/<slug>/<version>/)
docs/                tài liệu cho developer
src/app/             trang (Next.js App Router)
src/app/api/v1/      API – chỉ đọc request, gọi service, trả JSON
src/modules/         nghiệp vụ theo từng phần: auth, users, games, scores, events
src/components/      component giao diện
src/i18n/            cấu hình song ngữ (ngôn ngữ lưu trong cookie NEXT_LOCALE)
src/lib/             prisma client, env, xử lý lỗi API, rate limit, URL file, tiện ích
```

## Nguyên tắc khi phát triển tiếp
- Tính năng mới: **thêm bảng / thêm dòng**, không đổi tên hay đổi nghĩa cột cũ
- Luật/cấu hình riêng của game hoặc bảng xếp hạng: thêm field vào `settings` (xem `src/modules/games/settings.ts`)
- Database chỉ lưu **key** của file; URL đầy đủ ghép từ `NEXT_PUBLIC_ASSET_BASE_URL` / `NEXT_PUBLIC_GAME_BASE_URL`
- Không xóa cứng game/user: dùng `deletedAt` hoặc trạng thái `ARCHIVED`
- Logic nằm trong `src/modules/*/service.ts`; file `route.ts` chỉ gọi service
- Đổi API theo cách không tương thích ngược → tạo `/api/v2`, giữ `/api/v1` cho client cũ
