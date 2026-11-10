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

## Hạn chế đã biết (sẽ làm)

- Middleware (Edge) chỉ kiểm tra chữ ký JWT để chặn trang `/profile`, `/admin`…; phiên đã thu hồi vẫn mở được khung trang nhưng mọi dữ liệu/API đều bị từ chối (kiểm tra ở server)
- Upstash lỗi / chậm > 1,5 giây → rate limit tạm đếm trong bộ nhớ (không chặn người dùng thật) và ghi lỗi lên Sentry
- Ảnh đại diện là link ngoài (người xem tải ảnh từ server lạ) → Phase 10 chuyển sang upload ảnh
- Link upload ký sẵn không giới hạn dung lượng phía R2 → server kiểm tra lại kích thước trước khi xử lý; lifecycle rule xóa `u/incoming/` sau 1 ngày
- Developer sửa tên/mô tả game đã phát hành không cần duyệt lại → dựa vào **báo cáo vi phạm** của người chơi + admin xử lý
- Điểm do game gửi lên vẫn có thể bị sửa nếu người chơi đọc được code game – chỉ hạn chế được bằng giới hạn hợp lý; game cần chống gian lận mạnh phải tự xác minh phía server

## Kiểm tra định kỳ

- `npm run audit` mỗi khi cập nhật thư viện
- Theo dõi thông báo bảo mật của Next.js: <https://nextjs.org/blog>
- Chạy lại phần 5 của `docs/TEST_CHECKLIST.md` sau mỗi lần deploy lớn
