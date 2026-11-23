# Bảo mật – Game Hub

## Các lớp bảo vệ đang có

| Mối nguy | Cách chặn | Ở đâu |
|---|---|---|
| Giả mạo đăng nhập / ký lại chữ ký cũ | SIWE: kiểm tra domain, thời hạn, chữ ký; nonce dùng 1 lần, hết hạn 5 phút | `src/modules/auth/service.ts` |
| Đánh cắp phiên | Cookie `httpOnly`, `secure` (production), `sameSite=lax`; JWT ký HS256 chứa id phiên (`jti`) – server kiểm tra phiên trong bảng `AuthSession` mỗi request → đăng xuất / đăng xuất mọi thiết bị / admin khóa tài khoản có hiệu lực ngay | `src/modules/auth/jwt.ts`, `src/modules/auth/session.ts`, `src/modules/auth/sessions.ts` |
| Web lạ gọi API thay người chơi (CSRF) | Request ghi dữ liệu có Origin khác host → 403 | `src/modules/auth/csrf.ts`, `src/middleware.ts` |
| Game độc lấy cookie / gọi API | Game chạy trong `iframe sandbox` + header `Content-Security-Policy: sandbox` kể cả khi mở trực tiếp | `next.config.ts`, `GameRoom.tsx` |
| Nhúng hub vào web lạ để lừa ký ví | `X-Frame-Options: DENY` cho trang hub | `next.config.ts` |
| Gian lận điểm | Lượt chơi phía server, nộp 1 lần, thời gian chơi tối thiểu, điểm tối đa theo bảng xếp hạng | `src/modules/scores/service.ts` |
| Spam API | Rate limit theo IP / user, bộ đếm dùng chung trên Upstash Redis (không có Redis → đếm trong bộ nhớ); body JSON tối đa 64KB | `src/lib/rate-limit.ts`, `src/lib/api.ts` |
| Ảnh đại diện độc hại / theo dõi người xem | Chỉ nhận ảnh upload lên kho của hub (không nhận link ngoài – link ngoài cũ bị ẩn); server kiểm tra key thuộc đúng user, ≤ 1MB, chữ ký file PNG/JPG/WEBP (chặn SVG/HTML giả ảnh) | `src/modules/users/service.ts`, `src/modules/uploads/image.ts` |
| Tài khoản phá hoại | Admin khóa tài khoản: thu hồi mọi phiên, chặn đăng nhập, ẩn điểm khỏi bảng xếp hạng | `src/modules/users/moderation.ts` |
| Lỗi không ai biết | Lỗi server (API, trang) + lỗi trình duyệt gửi lên Sentry (đã ẩn cookie/token, bỏ query string) | `src/lib/monitoring.ts`, `src/instrumentation.ts` |
| Dữ liệu sai định dạng | Kiểm tra mọi input bằng zod | `src/modules/*/schemas.ts` |
| Mạo danh bằng tên | Username chữ thường, cấm `admin`, `system`, `0x…` | `src/modules/users/username.ts` |
| Bản build độc hại của developer | Kiểm tra zip (zip bomb, `../`, đuôi file cho phép), file phục vụ từ domain kho lưu trữ khác hub + iframe sandbox, admin chơi thử trước khi duyệt | `src/modules/uploads/zip.ts`, `src/modules/storage` |
| Upload file thay người khác | Link upload ký sẵn hết hạn 15 phút, key gắn userId; server kiểm tra key thuộc đúng user trước khi xử lý | `src/modules/storage/keys.ts` |
| Leo quyền admin | Middleware chặn `/admin` + mọi API admin tự kiểm tra role từ database | `requireAdmin()` |

## Lỗ hổng thư viện đã đánh giá (chấp nhận tạm thời)

Kết quả `npm audit --omit=dev` ngày 09/11/2026 sau khi nâng Next.js 15.5.29 và zod 4:

| Thư viện | Mức | Vì sao chưa ảnh hưởng | Khi nào hết |
|---|---|---|---|
| `postcss` (nằm trong `next`) | high | Chỉ chạy lúc build, xử lý CSS của chính dự án – không nhận dữ liệu người dùng | Nâng lên Next.js 16 |
| `deepmerge-ts` (qua `prisma` CLI) | high | Chỉ dùng khi chạy lệnh Prisma trên máy dev / lúc build – không chạy trên web | Nâng lên Prisma 7 |
| `sharp` (tùy chọn của `next`) | high | Hub tắt bộ tối ưu ảnh (`images.unoptimized`) nên không gọi tới sharp | Chạy `npm audit fix` để lấy bản vá |

CI chặn lỗ hổng mức **critical**; mức **high** được in báo cáo ở mỗi lần chạy để xem lại.

## Rà soát bảo mật 23/11/2026

Phạm vi: đăng nhập SIWE / phiên, phân quyền từng API (hub, developer, admin, p1, s1), upload + zip,
webhook, header bảo mật, rate limit, bí mật trong lịch sử git, thư viện.

| # | Phát hiện | Mức | Trạng thái |
|---|---|---|---|
| 1 | Webhook: kiểm tra DNS rồi mới `fetch` → tên miền có thể đổi sang IP nội bộ giữa 2 bước (DNS rebinding, SSRF) | Trung bình | **Đã sửa**: kiểm tra địa chỉ ngay trong hàm `lookup` của socket, IP viết thẳng cũng bị chặn, không theo redirect, không giữ kết nối (`webhook-http.ts` + unit test) |
| 2 | Trang hub chưa có Content-Security-Policy | Thấp | **Đã sửa**: CSP nền `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` (không đụng script để không hỏng Next/ví) |
| 3 | Thiếu HSTS khi tự host (Vercel tự thêm) | Thấp | **Đã sửa**: `Strict-Transport-Security` trong `next.config.ts` + nginx (landing, docs) |
| 4 | Chưa có cập nhật thư viện tự động | Thấp | **Đã sửa**: `.github/dependabot.yml` (npm hằng tuần, GitHub Actions hằng tháng). Cảnh báo Dependabot của repo đang **tắt** → bật ở Settings → Advanced Security |
| 5 | Lỗi 500 không có mã để đối chiếu log | Thấp | **Đã sửa**: mã request (`x-request-id`) ở mọi API + trong body lỗi 500 |

Đã kiểm tra, không có lỗi:

- SIWE: nonce dùng 1 lần + hết hạn, kiểm tra domain, JWT HS256 (≥ 32 ký tự) có `jti` đối chiếu database, cookie httpOnly/secure/lax; token p1 không dùng được làm phiên hub; tài khoản bị khóa/xóa bị chặn
- Phân quyền theo đối tượng (IDOR): thu hồi API key, gửi lại webhook, thành viên studio, chuyển chủ sở hữu, rollback phiên bản, cấm người chơi (s1) đều lọc theo game/studio của người gọi
- Upload: zip chặn `../` và đường dẫn tuyệt đối, giới hạn số file + dung lượng giải nén, chỉ nhận đuôi file cho phép; ảnh đại diện chỉ PNG/JPEG/WebP (không SVG) và phải là file chính user đó upload
- File game: luôn có CSP `sandbox` (origin `null`), không đọc được cookie của hub
- IP cho rate limit: Vercel và nginx đều ghi đè `X-Forwarded-For` → client không giả được
- Lịch sử git: không có khóa / mật khẩu thật (chỉ mật khẩu giả của CI)

## Hạn chế đã biết (sẽ làm)

- Middleware (Edge) chỉ kiểm tra chữ ký JWT để chặn trang `/profile`, `/admin`…; phiên đã thu hồi vẫn mở được khung trang nhưng mọi dữ liệu/API đều bị từ chối (kiểm tra ở server)
- Upstash lỗi / chậm > 1,5 giây → rate limit tạm đếm trong bộ nhớ (không chặn người dùng thật) và ghi lỗi lên Sentry
- Link upload ký sẵn không giới hạn dung lượng phía R2 → server kiểm tra lại kích thước trước khi xử lý; lifecycle rule xóa `u/incoming/` sau 1 ngày
- Developer sửa tên/mô tả game đã phát hành không cần duyệt lại → dựa vào **báo cáo vi phạm** của người chơi + admin xử lý
- Điểm do game gửi lên vẫn có thể bị sửa nếu người chơi đọc được code game – chỉ hạn chế được bằng giới hạn hợp lý; game cần chống gian lận mạnh phải tự xác minh phía server

## Kiểm tra định kỳ

- `npm run audit` mỗi khi cập nhật thư viện
- Theo dõi thông báo bảo mật của Next.js: <https://nextjs.org/blog>
- Chạy lại phần 5 của `docs/TEST_CHECKLIST.md` sau mỗi lần deploy lớn
