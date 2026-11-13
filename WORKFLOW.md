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
- [x] Cài extension MetaMask, tạo ví (đã đặt làm admin trong `.env`)
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
- [x] Admin: tạo bảng xếp hạng / giải đấu mới cho game (giải ăn theo bảng chính hoặc bảng riêng; trang game có nút chuyển bảng)

## Phase 5 – Điểm số & Leaderboard
- [x] `POST /api/v1/games/[slug]/sessions` – bắt đầu lượt chơi (gắn phiên bản game)
- [x] `POST /api/v1/games/[slug]/scores` – nộp điểm `{ sessionId, score, leaderboard? }`
- [x] `GET /api/v1/games/[slug]/leaderboard?board=default&period=day|week|all` – top + hạng của mình
- [x] `GET /api/v1/me/scores`, `PATCH /api/v1/me`
- [x] Rate limit (lưu trong bộ nhớ – khi chạy nhiều server cần chuyển sang Redis)

## Phase 6 – Giao diện (Frontend)
- [x] Layout chung: header (logo, nút kết nối ví, tên/địa chỉ ví rút gọn), footer
- [x] Song ngữ Việt/Anh: `messages/vi.json`, `messages/en.json`, nút đổi ngôn ngữ
- [x] Trang chủ: danh sách game dạng card, lọc theo thể loại
- [x] Trang chơi game `/games/[slug]`: iframe sandbox + bảng xếp hạng bên cạnh, thông báo kết quả nộp điểm, toàn màn hình
- [x] Trang bảng xếp hạng `/games/[slug]/leaderboard` (tab hôm nay / tuần / tất cả, top 100, hạng của mình)
- [x] Trang hồ sơ `/profile`: đổi tên hiển thị/ảnh đại diện, thành tích, lượt chơi gần đây
- [x] Trang quản trị `/admin`: tạo game, đổi trạng thái, thêm/duyệt/từ chối phiên bản, đặt bản đang chạy
- [x] Responsive mobile + thông báo khi mobile không có MetaMask (nút mở bằng app MetaMask)
- [x] Trang 404

## Phase 7 – Game SDK & game mẫu
- [x] Game SDK `public/sdk/gamehub-sdk.js` (giao thức `postMessage` có số phiên bản):
  - hub → game: `INIT` (ngôn ngữ, người chơi)
  - game → hub: `READY`, `GAME_START`, `GAME_OVER { score, leaderboard? }`
  - Chỗ cắm quảng cáo: `showRewardedAd()`, `showInterstitialAd()` (chưa bật quảng cáo thật)
- [x] Hub chạy game trong `iframe sandbox`, chỉ nhận tin nhắn từ đúng iframe game
- [x] Game 2048 dùng SDK (song ngữ, bàn phím + vuốt), tại `public/uploads/games/2048/1.0.0/` – đã chạy thử trong sandbox
- [x] Tài liệu tích hợp cho developer: `docs/GAME_SDK.md`

## Phase 8 – Kiểm thử & bảo mật
- [x] Vá lỗ hổng đã công bố: Next.js 15.5.4 → **15.5.29**, React 19.1.0 → **19.1.7+** (CVE-2025-66478 RCE, DoS Server Actions, các bản vá 2026)
- [x] Header bảo mật: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, chặn nhúng trang hub (`X-Frame-Options: DENY`), tắt `X-Powered-By`
- [x] File game luôn bị ép sandbox (`Content-Security-Policy: sandbox`) kể cả khi mở trực tiếp – đã chạy thử: game vẫn chơi được, không đọc được cookie
- [x] Chặn CSRF: API ghi dữ liệu từ web khác → 403 `CROSS_SITE_REQUEST`
- [x] Giới hạn body JSON 64KB · username chữ thường, cấm tên giả mạo (admin, system, 0x…)
- [x] Rà soát code: cookie httpOnly/secure/sameSite, validate input bằng zod, quyền admin kiểm tra ở cả middleware và API
- [x] Unit test (`npm test`, 23 test): kỳ xếp hạng giờ VN, giải đấu, CSRF, định dạng, URL file, username, settings
- [x] Checklist kiểm thử thủ công: `docs/TEST_CHECKLIST.md`
- [ ] Chạy checklist thủ công với MetaMask (đăng nhập, chơi, nộp điểm, admin, bảo mật)
- [ ] Kiểm tra trên điện thoại (trình duyệt trong app MetaMask)
- Hạn chế đã biết: ~~ảnh đại diện link ngoài~~, ~~thu hồi JWT~~, ~~rate limit Redis~~ → đã xử lý ở Phase 9b / 9d

## Phase 9 – Deploy
- [x] CI GitHub Actions: cài thư viện → kiểm tra schema → TypeScript → unit test → build production → npm audit (xanh)
- [x] Prisma `directUrl` (Neon/Supabase dùng pooler), script `vercel-build` tự chạy `prisma migrate deploy`
- [x] Endpoint kiểm tra sống `GET /api/v1/health`
- [x] Xử lý lỗ hổng thư viện: zod 4.6.7, tắt bộ tối ưu ảnh; đánh giá phần còn lại trong `docs/SECURITY.md`
- [x] Hướng dẫn từng bước: `docs/DEPLOY.md`
- [x] Tạo database Neon (region Singapore), chạy `migrate deploy` + seed production
- [x] Tạo project Vercel, nhập biến môi trường, deploy, chuyển Function Region sang Singapore
- [x] Kiểm tra sau deploy (health, đăng nhập ví, chơi, admin, cookie Secure, sandbox game)
- [x] Gắn domain riêng: Game Hub ở `play.monlabs.fun`, landing page `monlabs.fun` (`sites/monlabs`) · còn: `docs.monlabs.fun`, domain riêng cho file game (vd `cdn.monlabs.fun` thay cho `r2.dev`)
- Lưu ý: Vercel Hobby chỉ cho phi thương mại → lên Pro khi bật quảng cáo / thu tiền

---

## Phase 9b – Gia cố trước khi mời người dùng thật
- [x] Bảng phiên đăng nhập `AuthSession` (id nằm trong JWT): đăng xuất thu hồi phiên ngay, nút **Đăng xuất mọi thiết bị** ở trang hồ sơ
- [x] Admin khóa / mở khóa tài khoản (tìm theo ví hoặc tên): thu hồi mọi phiên, chặn đăng nhập, ẩn điểm khỏi bảng xếp hạng
- [x] Rate limit dùng chung qua Upstash Redis (REST, không cần thư viện), lỗi Redis → tạm đếm trong bộ nhớ
- [x] Theo dõi lỗi Sentry: lỗi API, lỗi trang (`onRequestError`), lỗi trình duyệt (`error.tsx`) – không cần thư viện `@sentry/*`
- [x] Trang báo lỗi thân thiện song ngữ (`error.tsx`, `global-error.tsx`)
- [x] Tạo Upstash Redis + Sentry, nhập biến môi trường trên Vercel (`docs/DEPLOY.md` mục 3c)
- Lưu ý: người đang đăng nhập bằng phiên cũ (trước bản này) phải kết nối ví lại 1 lần

## Phase 9c – Nội dung & thu hút người chơi
- [x] 3 game mẫu mới (song ngữ, phím + chạm): **Rắn săn mồi** (`snake`), **Neon Flap** (`neon-flap`), **Lật thẻ** (`memory`) – seed tự tạo khi deploy
- [x] Bảng xếp hạng tính theo thời gian: `format: "duration_ms"` (hiện `0:42,7`) + `timedScoreSlackSeconds` chống gửi thời gian giả
- [x] Chia sẻ: nút **Chia sẻ / Khoe điểm** (điện thoại mở bảng chia sẻ, máy tính copy link), ảnh xem trước 1200x630 cho Facebook/Zalo (`/api/og`)
- [x] SEO: `sitemap.xml`, `robots.txt`, metadata Open Graph cho trang chủ / game / bảng xếp hạng
- [x] Trang Quản trị có mục **Thống kê** (7/30/90 ngày): lượt chơi, người chơi, người dùng mới, điểm, biểu đồ theo ngày, bảng theo game
- [x] Đếm lượt chơi của khách chưa kết nối ví (`play.anonymous`) – cần cho thống kê và chia doanh thu quảng cáo sau này
- [x] Thử chia sẻ link game lên Facebook / Zalo (chỉ chạy trên bản deploy, link localhost không xem trước được)

## Phase 9d – Hoàn thiện trải nghiệm
- [x] Upload ảnh đại diện: tự cắt vuông 256x256 trên trình duyệt, server kiểm tra đúng chủ, ≤ 1MB, đúng chữ ký PNG/JPG/WEBP; bỏ link ảnh ngoài
- [x] Test trình duyệt tự động (Playwright) trong CI – job `e2e`: ví MetaMask giả lập, đăng nhập, chơi Lật thẻ lưu điểm, hồ sơ + ảnh đại diện, đăng xuất mọi thiết bị, chặn trang quản trị, thống kê, khóa/mở khóa, sandbox game, ảnh chia sẻ, sitemap, PWA (10+ test, chạy `npm run test:e2e`)
- [x] PWA: cài Game Hub lên màn hình chính (manifest, icon thường + maskable, nút **Cài Game Hub** ở chân trang, hướng dẫn riêng cho iPhone), service worker cache file tĩnh + trang `offline.html` khi mất mạng
- [x] Thử cài app trên điện thoại thật (Android Chrome + iPhone Safari) sau khi deploy – cần https

## Phase 9e – Tên miền & trang phụ
- [x] Landing page `monlabs.fun` (`sites/monlabs`, project Vercel `monlabs`), `www` chuyển về tên miền chính
- [x] Game Hub chuyển sang `play.monlabs.fun` (`NEXT_PUBLIC_APP_URL`, CORS R2)
- [x] Tắt bản Preview trên Vercel (`vercel.json` + `scripts/vercel-ignore-build.sh`): Preview dùng chung database thật; mỗi project chỉ build khi phần của nó thay đổi
- [x] Trang tài liệu cho developer (`sites/docs`, VitePress, 8 trang tiếng Việt), project Vercel `monlabs-docs`, CI có bước build docs
- [x] Gắn `docs.monlabs.fun` (CNAME `docs` ở Cloudflare)
- [x] Bản tiếng Anh cho trang docs (docs.monlabs.fun/en, nút đổi ngôn ngữ)

## Phase 10 – Nền tảng cho developer
- [x] Đăng ký làm developer → tạo Studio (trang `/developer`)
- [x] Developer tạo game (Nháp), sửa tên/mô tả/thể loại, upload ảnh bìa
- [x] Upload `.zip` thẳng lên kho lưu trữ bằng link ký sẵn (không qua Vercel – giới hạn 4,5MB/request), có thanh tiến độ
- [x] Kiểm tra bản build: tối đa 50MB / 150MB giải nén / 2000 file, chặn zip bomb, `../`, đuôi file lạ; tự bỏ thư mục bao ngoài; cần `index.html`
- [x] Kho lưu trữ: `local` (máy dev) / `s3` (Cloudflare R2 ở production); file người dùng có key `u/…`, phục vụ từ domain riêng
- [x] Phiên bản mới → Chờ duyệt; game Nháp → Chờ duyệt; developer thấy lý do bị từ chối
- [x] Trang **Chơi thử** `/preview/[id]` cho developer + admin: chạy như hub, không lưu điểm, nhật ký SDK + checklist tích hợp
- [x] Admin: nút Chơi thử từng phiên bản, hiện studio của game
- [x] Thống kê cho developer: lượt chơi, người chơi, điểm đã lưu
- [x] Tài liệu: quy trình đăng game + yêu cầu `.zip` (`docs/GAME_SDK.md`), cấu hình R2 (`docs/DEPLOY.md` mục 3b)
- [x] Thử toàn bộ luồng trên máy: tạo studio → tạo game → upload `.zip` → chơi thử → admin duyệt → phát hành (09/11/2026)
- [x] Tạo bucket R2 + biến môi trường trên Vercel, thử upload trên production
- [x] Báo cáo vi phạm game (`GameReport`): nút ⚑ Báo cáo dưới game (5 lý do, mỗi người 1 báo cáo đang mở/game), mục **Báo cáo vi phạm** ở trang Quản trị (Chờ xử lý / Đã xử lý / Bỏ qua + ghi chú)
- [x] Điều khoản người đăng game `/terms/developer` (có phiên bản): bắt buộc tick khi tạo studio; đổi phiên bản → chủ studio phải đồng ý lại mới tạo game / upload được *(bản nháp – nên nhờ luật sư xem lại)*
- [x] Thành viên studio: chủ studio thêm bằng địa chỉ ví (tối đa 20), xóa thành viên, chuyển quyền chủ; thành viên tự rời studio
- [x] CI có thêm job `migrations`: chạy migration trên Postgres thật + kiểm tra schema khớp migration + seed 2 lần
- [x] Hỗ trợ bản build nén `.br` / `.gz` (Unity WebGL Brotli/Gzip): giải nén lúc upload, giữ tên file, Content-Type theo file bên trong, chặn bomb nén

## Phase 11 – Kiếm tiền (sau MVP)
- [ ] Quảng cáo có thưởng / xen giữa màn qua SDK (Google H5 Games Ads)
- [ ] Ghi nhận lượt xem quảng cáo theo game (`Event`) → chia doanh thu cho developer
- [ ] Sổ cái tiền (`LedgerEntry`), thanh toán cho developer (`Payout`)
- [ ] Gói Premium (`Subscription`) qua MoMo / VNPay / ZaloPay hoặc Stripe
- [ ] Giải đấu có nhà tài trợ (dùng `Leaderboard` có thời gian) – không thu phí tham gia
- [ ] Kiểm tra pháp lý (Nghị định 147/2024, đăng ký khuyến mại) trước khi thu tiền thật

## Phase 12 – Platform as a Service (PaaS)
Bán **backend cho game web**: developer giữ game trên domain riêng nhưng dùng đăng nhập ví, bảng xếp hạng chống gian lận và giải đấu của Monlabs. Game Hub trở thành khách hàng đầu tiên của chính nền tảng.
Kế hoạch chi tiết (lý do, thiết kế, bảng giá): tài liệu **Kế hoạch: Game Hub thành PaaS**.

Nguyên tắc: 1 project = 1 `Game` hiện có (dùng lại studio, bảng xếp hạng, lượt chơi, luật chống gian lận); dữ liệu chỉ **thêm mới**; API `/api/v1` và SDK v1 trong hub **giữ nguyên**.

### Cần chốt trước khi làm 12a
- [x] Người chơi 1 ví dùng chung mọi project
- [x] Tên tạm "Monlabs Play API", bảng điều khiển giữ ở `play.monlabs.fun/developer` (đổi sau được)
- [x] Có chơi khách (có điểm, giới hạn tạo tài khoản khách theo IP)
- [x] Bảng giá: dùng phương án Free / Pro / Business trong kế hoạch (áp dụng ở 12c)

### Phase 12a – MVP: game chạy được trên domain riêng
- [x] Migration: `ApiKey` (publishable / secret, lưu bản băm, thu hồi được), `Game.allowedOrigins`, `AuthSession.gameId` – bỏ `Game.hosting`: mọi game (cả game trên hub) đều gắn key được, game nháp dùng API trên domain riêng mà không hiện trên hub
- [x] Trang Developer: mục **Platform API** ở mỗi game – khai báo domain, tạo / thu hồi publishable key (xác nhận ngay trên trang), đoạn mã nhúng
- [x] Client API `/api/p1`: xác thực key + `Origin` nằm trong domain đã khai báo, CORS không dùng cookie, giới hạn tần suất theo project / người chơi / IP
- [x] Đăng nhập SIWE trên domain của game → token người chơi (audience riêng, gắn `AuthSession.gameId`) chỉ dùng cho đúng project, không dùng được làm phiên hub; chơi khách
- [x] Bắt đầu / nộp lượt, đọc bảng xếp hạng & giải đấu qua Client API, dùng lại luật chống gian lận hiện tại
- [x] SDK v2 chế độ độc lập (`GameHub.init({ projectKey })`, `login()`, `logout()`, `me()`, `leaderboard()`, `leaderboards()`, `gameOver()` trả Promise); không có `projectKey` thì chạy như SDK v1
- [x] Game mẫu Tap Rush `/demo/index.html?key=…&api=…` dùng SDK v2 (chưa gắn domain riêng `demo.monlabs.fun`)
- [x] Test tự động: unit test domain; e2e chơi khách + ví từ domain khác, key sai, domain chưa khai báo, token người chơi không dùng được trên hub, thu hồi key; test hub cũ vẫn chạy
- [x] Docs: trang "Dùng ngoài Game Hub (Platform API)" (vi + en)
- [ ] Chạy lại toàn bộ test plan Game Hub sau khi xong 12a

### Phase 12b – Server API & số liệu
- [ ] Secret key + Server API `/api/s1`: đọc / xuất điểm, xóa điểm gian lận, cấm người chơi trong project, tạo giải đấu
- [ ] Chế độ "máy chủ xác nhận": game có backend tự nộp điểm bằng secret key, tắt nộp điểm từ trình duyệt
- [ ] `UsageDaily` (lượt gọi API, lượt chơi, điểm, người chơi hoạt động) + bảng điều khiển số liệu cho developer
- [ ] Webhook `score.submitted` ký HMAC, tự gửi lại khi lỗi
- [ ] Tài liệu API dạng OpenAPI
- [ ] Nhật ký (`Event`) cho tạo / thu hồi key, đổi domain, điểm bị từ chối – developer tra cứu được

### Phase 12c – Gói & hạn mức (chưa thu tiền)
- [ ] Bảng `Plan` + gói của studio; áp hạn mức theo gói (người chơi hoạt động / tháng, lần nộp điểm / tháng, số project, giải đấu)
- [ ] Cảnh báo 80% / 100%; hết hạn mức thì vẫn chơi được nhưng ngừng lưu điểm, SDK báo rõ
- [ ] Admin gán gói bằng tay cho khách beta
- [ ] Trang giới thiệu PaaS + bảng giá trên monlabs.fun

### Phase 12d – Thu tiền
- [ ] Cổng thanh toán: Stripe (quốc tế), VNPay / MoMo (Việt Nam), hóa đơn
- [ ] Điều khoản dịch vụ & chính sách dữ liệu cho khách PaaS; kiểm tra pháp lý trước khi thu tiền thật
- [ ] Trang trạng thái (status page), cam kết thời gian hoạt động cho gói Business

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
| 6–7 | Giao diện + SDK + game 2048 | 2.5–3 ngày | Xong (chờ chạy thử trên máy) |
| 8–9 | Kiểm thử + deploy | 0.5–1 ngày | Xong phần code + CI; chờ chạy checklist & tạo Neon/Vercel |
| 10 | Nền tảng developer | 3–4 ngày | Xong phần lõi; chờ cấu hình R2 |
| 11 | Kiếm tiền | tùy hướng chọn | |
| 12a | PaaS – game chạy trên domain riêng | 4–6 ngày | Xong code; chờ chạy lại test plan |
| 12b | PaaS – Server API, số liệu, webhook | 3–4 ngày | |
| 12c | PaaS – gói & hạn mức | 2–3 ngày | |
| 12d | PaaS – thu tiền | tùy cổng thanh toán | |
