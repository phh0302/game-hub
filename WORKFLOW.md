# Game Hub – Workflow phát triển

> Cổng mini game HTML5, đăng nhập bằng ví MetaMask (SIWE), không có NFT/token.
> Định hướng: nền tảng mở – developer khác đăng game lên được – và kiếm tiền từ quảng cáo / chia doanh thu.

## Tech stack

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | 1 project làm cả frontend + API, deploy nhanh |
| Database | PostgreSQL + Prisma ORM | Leaderboard cần query xếp hạng, Prisma type-safe |
| Auth | SIWE (EIP-4361) + `viem` + JWT trong httpOnly cookie | Chuẩn login bằng ví, không lưu password |
| UI | Tailwind CSS 4 + next-intl | Làm giao diện nhanh, song ngữ |
| Game | HTML5 trong `iframe sandbox`, giao tiếp qua SDK `postMessage` | Game bên thứ ba không đụng được vào hub |
| Deploy | Vercel + Neon/Supabase (Postgres) — hoặc VPS + Docker | Miễn phí/rẻ cho giai đoạn đầu |

## Quyết định đã chốt
- Database dev: PostgreSQL chạy bằng **Docker** (`docker-compose.yml`)
- Giao diện: **song ngữ Việt/Anh**, có nút đổi ngôn ngữ (next-intl)
- Mobile: chỉ hỗ trợ **desktop + trình duyệt trong app MetaMask** (chưa làm WalletConnect)
- Tên tạm: **Game Hub**, giao diện tối, phong cách game/neon
- **Mở cho developer**: ai cũng đăng ký làm developer được, nhưng game phải **admin duyệt** mới lên hub (tạm chọn – đổi sang "chỉ người được mời" không cần đổi database)
- **Chơi không cần đăng nhập**: database đã hỗ trợ tài khoản khách; bản đầu khách chơi được nhưng phải kết nối ví để lưu điểm (tạm chọn)

## Nguyên tắc thiết kế để mở rộng (Phase 2.5)
- Tính năng mới = **thêm bảng / thêm dòng**, không sửa hay đổi tên cột cũ
- Đăng nhập tách khỏi User (`AuthIdentity`) · bản dịch, thể loại, phiên bản game, bảng xếp hạng là bảng riêng
- Cấu hình riêng từng game / bảng xếp hạng lưu JSON `settings` → thêm luật không cần migration
- File lưu **key** tương đối, URL ghép từ `.env` → đổi CDN không sửa dữ liệu
- Không xóa cứng (`deletedAt`, `ARCHIVED`) · nhật ký sự kiện chỉ ghi thêm (`Event`)
- Code chia theo nghiệp vụ `src/modules/*` (service), route API chỉ gọi service · API có phiên bản `/api/v1`
- Migration: thêm mới → chuyển dữ liệu → bỏ cũ; không sửa migration đã chạy

---

## Phase 0 – Chuẩn bị môi trường
- [x] Cài Node.js 20+
- [x] PostgreSQL chạy bằng Docker (`docker-compose.yml`)
- [ ] Cài extension MetaMask trên trình duyệt, tạo 1–2 ví test
- [x] Tạo repo GitHub cho project (github.com/phh0302/game-hub)

## Phase 1 – Khởi tạo project
- [x] Khởi tạo Next.js (TypeScript, Tailwind, App Router) – chưa có ESLint
- [x] Khai báo Prisma, `viem` (có sẵn SIWE), `jose` (JWT), `zod` (validate), `next-intl` (song ngữ)
- [x] Cấu trúc thư mục, file `.env.example`

## Phase 2 – Database schema (bản đầu)
- [x] User, AuthNonce, Game, GameSession, Score + seed game 2048
- [x] _Đã thay bằng thiết kế ở Phase 2.5_

## Phase 2.5 – Thiết kế lại để mở rộng
- [x] `User` + `AuthIdentity` (WALLET / GOOGLE / EMAIL / GUEST) – 1 user nhiều cách đăng nhập, hỗ trợ tài khoản khách
- [x] `Studio` + `StudioMember` – game thuộc về studio (developer cá nhân hoặc team)
- [x] `Category` + `CategoryTranslation` + `GameCategory` – thể loại do admin quản lý, 1 game nhiều thể loại
- [x] `GameTranslation` – bản dịch theo từng ngôn ngữ (thêm ngôn ngữ = thêm dòng)
- [x] `GameVersion` – phiên bản build, trạng thái duyệt, quay lại bản cũ; `Game.currentVersionId`
- [x] `Game.status`: DRAFT → PENDING_REVIEW → PUBLISHED / MAINTENANCE / SUSPENDED / ARCHIVED
- [x] `Leaderboard` (+ bản dịch) – nhiều bảng xếp hạng/game, sắp xếp tăng/giảm, có thời gian bắt đầu/kết thúc (dùng cho giải đấu)
- [x] `Score.value` kiểu BigInt, gắn với leaderboard; mỗi lượt chơi nộp 1 lần cho mỗi bảng
- [x] Cột `settings` JSON cho Game và Leaderboard (thời gian chơi tối thiểu, điểm tối đa…)
- [x] `Event` – nhật ký đăng nhập, bắt đầu lượt chơi, nộp điểm (sau dùng cho thống kê & chia doanh thu)
- [x] Soft delete: `deletedAt` cho User, Studio, Game, Leaderboard
- [x] File lưu key: `thumbnailKey`, `storageKey`; URL từ `NEXT_PUBLIC_ASSET_BASE_URL` / `NEXT_PUBLIC_GAME_BASE_URL`
- [x] Chia code `src/modules/{auth,users,games,scores,events}`, API chuyển sang `/api/v1`
- [x] Seed: 6 thể loại, studio "Game Hub", game 2048 v1.0.0 + bảng xếp hạng mặc định

## Phase 3 – Đăng nhập MetaMask (SIWE)
- [x] `POST /api/v1/auth/nonce` – nonce dùng 1 lần, hết hạn sau 5 phút
- [x] `POST /api/v1/auth/verify` – verify SIWE → tạo user + AuthIdentity nếu mới → set JWT cookie
- [x] `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- [x] Middleware bảo vệ `/profile` và `/admin`
- [x] Frontend: nút kết nối ví, xử lý chưa cài MetaMask / từ chối ký / đổi ví

## Phase 4 – API Game catalog
- [x] `GET /api/v1/games?category=puzzle` – danh sách game theo ngôn ngữ
- [x] `GET /api/v1/games/[slug]`, `GET /api/v1/categories`
- [x] Admin: `GET/POST /api/v1/admin/games`, `PATCH/DELETE /api/v1/admin/games/[id]` (DELETE = lưu trữ, không xóa cứng)
- [x] Admin phiên bản: thêm, duyệt/từ chối, đặt làm bản đang chạy (`.../versions`, `.../versions/[id]`, `.../activate`)
- [ ] Admin: tạo bảng xếp hạng / giải đấu mới cho game

## Phase 5 – Điểm số & Leaderboard
- [x] `POST /api/v1/games/[slug]/sessions` – bắt đầu lượt chơi (gắn phiên bản game)
- [x] `POST /api/v1/games/[slug]/scores` – nộp điểm `{ sessionId, score, leaderboard? }`
- [x] `GET /api/v1/games/[slug]/leaderboard?board=default&period=day|week|all` – top + hạng của mình
- [x] `GET /api/v1/me/scores`, `PATCH /api/v1/me`
- [x] Rate limit (lưu trong bộ nhớ – khi chạy nhiều server cần chuyển sang Redis)

## Phase 6 – Giao diện (Frontend)
- [x] Layout chung: header (logo, nút kết nối ví, tên/địa chỉ ví rút gọn), footer
- [x] Song ngữ Việt/Anh: `messages/vi.json`, `messages/en.json`, nút đổi ngôn ngữ
- [ ] Trang chủ: danh sách game dạng card, lọc theo thể loại
- [ ] Trang chơi game: iframe sandbox + bảng xếp hạng bên cạnh
- [ ] Trang leaderboard theo game (tab ngày / tuần / tất cả)
- [ ] Trang profile: đổi username/avatar, lịch sử điểm, điểm cao nhất từng game
- [ ] Trang admin: quản lý game, duyệt phiên bản
- [ ] Responsive mobile + thông báo khi mobile không có MetaMask

## Phase 7 – Game SDK & game mẫu
- [ ] Game SDK `gamehub-sdk.js` (giao thức `postMessage` có số phiên bản):
  - hub → game: `INIT` (ngôn ngữ, người chơi)
  - game → hub: `READY`, `GAME_START`, `GAME_OVER { score, leaderboard? }`
  - Chỗ cắm quảng cáo: `showRewardedAd()`, `showInterstitialAd()` (chưa bật quảng cáo thật)
- [ ] Hub chạy game trong `iframe sandbox`, chỉ nhận tin nhắn từ đúng nguồn game
- [ ] Viết game 2048 dùng SDK, đặt tại `public/uploads/games/2048/1.0.0/`
- [ ] Tài liệu "Cách tích hợp game vào Game Hub" cho developer

## Phase 8 – Kiểm thử & bảo mật
- [ ] Test luồng: kết nối ví → ký → chơi → nộp điểm → lên bảng xếp hạng
- [ ] Test lỗi: nonce hết hạn, ký lại nonce cũ, đổi ví giữa chừng, nộp điểm 2 lần
- [ ] Kiểm tra cookie httpOnly/secure/sameSite, validate input bằng zod
- [ ] Kiểm tra trên Chrome + MetaMask desktop, MetaMask mobile browser

## Phase 9 – Deploy
- [ ] Database Postgres online (Neon/Supabase)
- [ ] Deploy lên Vercel, cấu hình biến môi trường
- [ ] `prisma migrate deploy` + seed trên production
- [ ] Gắn domain (domain phải khớp với `domain` trong SIWE); domain riêng cho game (vd `games.<domain>`)

---

## Phase 10 – Nền tảng cho developer (sau MVP)
- [ ] Đăng ký làm developer → tạo Studio
- [ ] Trang quản lý game của developer: tạo game, upload `.zip` bản build, gửi duyệt
- [ ] Kiểm tra file upload (có `index.html`, giới hạn dung lượng, chỉ loại file cho phép) → lưu lên Cloudflare R2 / S3
- [ ] Admin duyệt game & phiên bản, ghi lý do từ chối
- [ ] Thống kê cho developer: lượt chơi, số người chơi (từ bảng `Event`)
- [ ] Báo cáo vi phạm game (`GameReport`), điều khoản cho người đăng game

## Phase 11 – Kiếm tiền (sau MVP)
- [ ] Quảng cáo có thưởng / xen giữa màn qua SDK (Google H5 Games Ads)
- [ ] Ghi nhận lượt xem quảng cáo theo game (`Event`) → chia doanh thu cho developer
- [ ] Sổ cái tiền (`LedgerEntry`), thanh toán cho developer (`Payout`)
- [ ] Gói Premium (`Subscription`) qua MoMo / VNPay / ZaloPay hoặc Stripe
- [ ] Giải đấu có nhà tài trợ (dùng `Leaderboard` có thời gian) – không thu phí tham gia
- [ ] Kiểm tra pháp lý (Nghị định 147/2024, đăng ký khuyến mại) trước khi thu tiền thật

## Ngoài phạm vi (làm sau nếu cần)
- Bạn bè, chat, thông báo · Achievement, daily quest
- Multiplayer realtime / matchmaking
- Đăng nhập Google / email, chơi khách có lưu điểm (database đã sẵn sàng)
- Analytics dashboard (DAU/MAU, retention)

## Thứ tự & ước lượng
| Phase | Nội dung | Ước lượng | Trạng thái |
|---|---|---|---|
| 0–2 | Môi trường, khởi tạo, database | 0.5 ngày | Xong |
| 2.5 | Thiết kế lại để mở rộng | 1 ngày | Xong |
| 3–5 | Đăng nhập ví, API game, điểm, bảng xếp hạng | 1.5–2 ngày | Xong |
| 6–7 | Giao diện + SDK + game 2048 | 2.5–3 ngày | |
| 8–9 | Kiểm thử + deploy | 0.5–1 ngày | |
| 10 | Nền tảng developer | 3–4 ngày | |
| 11 | Kiếm tiền | tùy hướng chọn | |
