# Game Hub – Workflow phát triển (MVP)

> Cổng mini game, đăng nhập 100% bằng ví MetaMask (SIWE), không có NFT/token.
> Mục tiêu: ra bản MVP chạy được nhanh nhất, đủ để test toàn bộ hệ thống.

## Tech stack

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | 1 project làm cả frontend + API, deploy nhanh |
| Database | PostgreSQL + Prisma ORM | Leaderboard cần query xếp hạng, Prisma type-safe |
| Auth | SIWE (EIP-4361) + `viem` + JWT trong httpOnly cookie | Chuẩn login bằng ví, không lưu password |
| UI | Tailwind CSS | Làm giao diện nhanh |
| Game | HTML5 nhúng qua `iframe`, giao tiếp bằng `postMessage` | Thêm game mới không phải sửa portal |
| Deploy | Vercel + Neon/Supabase (Postgres) — hoặc VPS + Docker | Miễn phí/rẻ cho giai đoạn đầu |

## Quyết định đã chốt
- Database dev: PostgreSQL chạy bằng **Docker** (`docker-compose.yml`)
- Giao diện: **song ngữ Việt/Anh**, có nút đổi ngôn ngữ (next-intl)
- Mobile: chỉ hỗ trợ **desktop + trình duyệt trong app MetaMask** (chưa làm WalletConnect)
- Tên tạm: **Game Hub**, giao diện tối, phong cách game/neon

---

## Phase 0 – Chuẩn bị môi trường
- [ ] Cài Node.js 20+ và Git
- [x] PostgreSQL: cài local hoặc chạy bằng Docker (`docker-compose.yml` sẽ có sẵn)
- [ ] Cài extension MetaMask trên trình duyệt, tạo 1–2 ví test
- [ ] Tạo repo GitHub cho project

## Phase 1 – Khởi tạo project
- [x] Khởi tạo Next.js (TypeScript, Tailwind, App Router) – viết tay, chưa có ESLint
- [x] Khai báo Prisma, `viem` (có sẵn SIWE, bỏ gói `siwe`), `jose` (JWT), `zod` (validate), `next-intl` (song ngữ)
- [x] Cấu trúc thư mục: `app/`, `app/api/`, `lib/`, `components/`, `prisma/`, `public/games/`
- [x] File `.env.example` (DATABASE_URL, JWT_SECRET, ADMIN_WALLETS, NEXT_PUBLIC_APP_DOMAIN)

## Phase 2 – Database schema
- [x] `User`: id, walletAddress (unique, lowercase), username, avatarUrl, role (USER/ADMIN), createdAt, lastLoginAt
- [x] `AuthNonce`: nonce, walletAddress, expiresAt, usedAt (chống replay)
- [x] `Game`: id, slug, name, description, thumbnail, category, embedUrl, status (ACTIVE/MAINTENANCE/HIDDEN), sortOrder
- [x] `GameSession`: id, userId, gameId, startedAt, endedAt (chống gửi điểm không qua lượt chơi thật)
- [x] `Score`: id, userId, gameId, sessionId, value, createdAt — index (gameId, value DESC)
- [x] Seed dữ liệu: 1 game mẫu (2048)

## Phase 3 – Đăng nhập MetaMask (SIWE)
- [ ] `POST /api/auth/nonce` – tạo nonce dùng 1 lần, hết hạn sau 5 phút
- [ ] `POST /api/auth/verify` – verify SIWE message (domain, chainId, nonce, chữ ký) → tạo user nếu mới → set JWT cookie
- [ ] `GET /api/auth/me` – lấy thông tin user đang đăng nhập
- [ ] `POST /api/auth/logout`
- [ ] Middleware bảo vệ các route cần đăng nhập + route admin
- [ ] Frontend: nút Connect Wallet, xử lý chưa cài MetaMask / user từ chối ký / `accountsChanged`

## Phase 4 – API Game catalog
- [ ] `GET /api/games` – danh sách game (lọc theo category, chỉ ACTIVE)
- [ ] `GET /api/games/[slug]` – chi tiết game
- [ ] Admin: `POST/PATCH/DELETE /api/admin/games` – quản lý game

## Phase 5 – Điểm số & Leaderboard
- [ ] `POST /api/games/[slug]/sessions` – bắt đầu lượt chơi, trả sessionId
- [ ] `POST /api/games/[slug]/scores` – nộp điểm kèm sessionId (mỗi session nộp 1 lần, kiểm tra thời gian chơi hợp lý, giới hạn điểm tối đa)
- [ ] `GET /api/games/[slug]/leaderboard?period=day|week|all` – top 50 + hạng của user hiện tại
- [ ] `GET /api/me/scores` – lịch sử điểm của user
- [ ] Rate limit cho API nộp điểm

## Phase 6 – Giao diện (Frontend)
- [ ] Layout chung: header (logo, Connect Wallet, avatar/địa chỉ ví rút gọn), footer
- [ ] Trang chủ: danh sách game dạng card, lọc theo thể loại
- [ ] Trang chơi game: iframe game + bảng xếp hạng bên cạnh
- [ ] Trang leaderboard theo game (tab ngày / tuần / tất cả)
- [ ] Trang profile: đổi username/avatar, lịch sử điểm, best score từng game
- [ ] Trang admin: CRUD game
- [ ] Song ngữ Việt/Anh: file dịch `messages/vi.json`, `messages/en.json`, nút đổi ngôn ngữ
- [ ] Responsive mobile + thông báo khi mobile không có MetaMask (gợi ý mở bằng MetaMask app)

## Phase 7 – Game mẫu & chuẩn tích hợp game
- [ ] Định nghĩa giao thức `postMessage` giữa portal ↔ game:
  - portal → game: `GAME_INIT` (sessionId, user)
  - game → portal: `GAME_READY`, `GAME_OVER { score }`
- [ ] Viết game 2048 (HTML5) theo giao thức trên, đặt tại `public/games/2048/`
- [ ] Tài liệu ngắn "Cách thêm game mới vào hub"

## Phase 8 – Kiểm thử & bảo mật
- [ ] Test luồng: connect ví → ký → chơi → nộp điểm → lên leaderboard
- [ ] Test trường hợp lỗi: nonce hết hạn, ký lại nonce cũ, đổi ví giữa chừng, nộp điểm 2 lần
- [ ] Kiểm tra cookie httpOnly/secure/sameSite, validate input bằng zod
- [ ] Kiểm tra trên Chrome + MetaMask desktop, MetaMask mobile browser

## Phase 9 – Deploy
- [ ] Tạo database Postgres online (Neon/Supabase)
- [ ] Deploy lên Vercel, cấu hình biến môi trường
- [ ] Chạy migration + seed trên production
- [ ] Gắn domain (domain phải khớp với field `domain` trong SIWE)

---

## Ngoài phạm vi MVP (làm sau nếu cần)
- Bạn bè, chat, thông báo
- Achievement, daily quest, event
- Multiplayer realtime / matchmaking
- Link nhiều ví vào 1 tài khoản, embedded wallet (đăng nhập bằng email cho người không có ví)
- Analytics dashboard (DAU/MAU, retention)

## Thứ tự & ước lượng
| Phase | Nội dung | Ước lượng |
|---|---|---|
| 0–2 | Môi trường, khởi tạo, database | 0.5 ngày |
| 3 | Đăng nhập MetaMask | 0.5–1 ngày |
| 4–5 | API game + leaderboard | 1 ngày |
| 6–7 | Giao diện (song ngữ) + game mẫu 2048 | 2–2.5 ngày |
| 8–9 | Kiểm thử + deploy | 0.5–1 ngày |
| **Tổng** | | **~4.5–5.5 ngày làm việc** |
