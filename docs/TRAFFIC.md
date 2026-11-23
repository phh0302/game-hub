# Chống DDoS & giới hạn request

Ba lớp, từ ngoài vào trong. Lớp ngoài cùng chặn rẻ nhất (không tốn tài nguyên máy chủ của mình).

| Lớp | Ở đâu | Chặn gì |
|---|---|---|
| 1. Cloudflare | Trước VPS (proxy – đám mây cam) | DDoS tầng mạng, bot xấu, quy tắc WAF, giới hạn tần suất theo IP ở biên |
| 2. nginx | Trên VPS, trước app (`docker/nginx`) | Giới hạn request / kết nối theo IP, body quá lớn, kết nối chậm (slowloris) |
| 3. App (middleware) | `src/lib/traffic/` | Giới hạn theo nhóm API, tự chặn tạm IP gửi dồn dập, 413 body > 64 KB |

Khi còn chạy trên Vercel: lớp 1 là tường lửa có sẵn của Vercel (tự chống DDoS; khi bị tấn công bật **Firewall → Attack Challenge Mode**), Cloudflare để chế độ chỉ DNS.

## Lớp 3 – giới hạn trong app

Cấu hình ở `src/lib/traffic/limits.ts`, áp cho mọi `/api` (trừ `/api/cron/*`), đếm theo IP:

| Nhóm | Đường dẫn | Giới hạn |
|---|---|---|
| auth | `/api/v1/auth/*`, `/api/p1/auth/*` | 30 / phút |
| write | POST / PUT / PATCH / DELETE còn lại | 120 / phút |
| read | GET còn lại | 300 / phút |
| platform | `/api/p1/*`, `/api/s1/*` | 900 / phút (thêm giới hạn theo project) |
| admin | `/api/v1/admin/*` | 300 / phút |
| Dồn dập | mọi nhóm | > 150 request / 10 giây → **chặn IP 15 phút** |

- Vượt giới hạn: `429` `{ error: { code: "RATE_LIMITED" | "IP_BLOCKED", retryAfter } }` + header `Retry-After`.
- Trang **Admin → IP đang bị chặn**: xem và bỏ chặn.
- Bộ đếm dùng Redis qua REST (`UPSTASH_REDIS_REST_URL` / `_TOKEN`): Upstash trên Vercel, hoặc Redis + `serverless-redis-http` trên VPS. Redis lỗi → dùng bộ nhớ, **không chặn nhầm** người dùng.
- `TRAFFIC_EXEMPT_IPS` (phân cách bằng dấu phẩy): IP bỏ qua lớp này – chỉ dùng cho máy chạy test.
- IP lấy từ phần tử đầu `x-forwarded-for`: proxy phía trước **phải ghi đè** header này (Vercel tự làm; nginx: `proxy_set_header X-Forwarded-For $remote_addr;` sau khi lấy IP thật từ Cloudflare). Không để Node lộ trực tiếp ra Internet.

## Lớp 1 – Cloudflare khi chạy trên VPS

Làm trong dashboard Cloudflare của tên miền `monlabs.fun`:

1. **DNS**: bản ghi `A` của `play`, `@`, `www`, `docs`, `stats` trỏ về IP VPS, bật **Proxied** (đám mây cam).
2. **SSL/TLS → Overview**: chọn **Full (strict)** (nginx dùng chứng chỉ Cloudflare Origin hoặc Let's Encrypt).
3. **Security → Settings**: Security level **Medium**; bật **Browser Integrity Check**.
4. **Security → Bots**: bật **Bot Fight Mode**.
5. **Security → WAF → Rate limiting rules** (gói Free được 1 quy tắc): khi `URI Path starts with /api/` và quá **600 request / 10 giây** cùng IP → **Block 10 giây**.
6. **Security → WAF → Custom rules** (tùy chọn): chặn quốc gia / ASN đang tấn công.
7. **Khi bị tấn công**: Overview → **Under Attack Mode** (mọi người phải qua bước kiểm tra trình duyệt ~5 giây) – tắt khi hết.
8. **Firewall của VPS**: chỉ mở cổng 80/443 cho [dải IP của Cloudflare](https://www.cloudflare.com/ips/), cổng SSH giới hạn IP của bạn → kẻ tấn công không gọi thẳng được VPS.

## Theo dõi & cảnh báo (stats.monlabs.fun)

- **Lấy mẫu:** middleware ghi `TRAFFIC_SAMPLE_RATE` (mặc định `0.2` = 20%) số request API vào Redis: tổng, theo nhóm, theo route (id/slug gom thành `:id` / `:slug`), mã trả về, thời gian xử lý, IP (SHA-256 có salt, chỉ 10 ký tự – không lưu IP thật). Số hiển thị = số mẫu ÷ tỷ lệ. Request bị chặn (429/413) **đếm đủ**.
- **Lưu trữ:** bucket theo phút (giữ 2 ngày) và theo giờ (giữ 9 ngày) trong Redis; cron `/api/cron/daily` gộp ngày hôm qua vào bảng `TrafficDaily` (xem 30 ngày).
- **Phát hiện bất thường** (tối đa 1 lần / phút, chạy sau request được lấy mẫu):

| Loại | Điều kiện (5 phút gần nhất) |
|---|---|
| Tăng đột biến | > 300 request và gấp 3 lần trung bình của 24 giờ trước |
| Lỗi cao | ≥ 5% request trả 5xx (tối thiểu 20 mẫu) |
| 1 IP chiếm nhiều | 1 IP ≥ 50% lưu lượng (≥ 100 request) |
| Bị chặn nhiều | ≥ 100 request bị 429/413 |
| Chặn IP | Có IP vừa bị chặn tạm 15 phút |

  Mỗi loại chỉ cảnh báo 1 lần / 30 phút (chặn IP: 1 lần / IP / 15 phút).
- **Telegram:** tạo bot bằng @BotFather → đặt `TELEGRAM_BOT_TOKEN` (Vercel → Settings → Environment Variables, **không** dán vào chat/commit) → nhắn 1 tin cho bot → trang stats bấm **Tìm chat** → **Gửi tin thử**. Hoặc đặt sẵn `TELEGRAM_CHAT_ID`.
- **Tên miền:** thêm `stats.monlabs.fun` vào project Vercel `game-hub` + bản ghi DNS CNAME `stats` → `cname.vercel-dns.com` (Cloudflare: DNS only). Middleware chuyển `/` của tên miền này sang `/stats`; đăng nhập ví ngay trên trang (chỉ admin xem được số liệu).

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `TRAFFIC_SAMPLE_RATE` | `0.2` | Tỷ lệ request được ghi số liệu (0–1) |
| `TRAFFIC_IP_SALT` | `JWT_SECRET` | Salt mã hóa IP |
| `TELEGRAM_BOT_TOKEN` | – | Token bot gửi cảnh báo |
| `TELEGRAM_CHAT_ID` | – | Chat nhận cảnh báo (nếu không dùng nút "Tìm chat") |
| `STATS_URL` | `https://stats.monlabs.fun` | Link trong tin cảnh báo + domain đăng nhập hợp lệ |

## Log & mã request

- Mọi request `/api/*` có mã riêng, trả về ở header `x-request-id` (trên Vercel dùng luôn `x-vercel-id` để khớp Vercel Logs).
  Lỗi 500 còn trả mã trong body: `{ "error": { "code": "INTERNAL_ERROR", "details": { "requestId": "…" } } }` – người dùng gửi mã này khi báo lỗi.
- Log máy chủ là JSON 1 dòng: `{"ts","level","msg",…}`. Trường có tên chứa cookie / token / secret / password / signature / apiKey bị ẩn thành `[redacted]`, chuỗi dài bị cắt 500 ký tự.
  - `request.failed` (5xx) và `request.slow` (≥ `SLOW_REQUEST_MS`, mặc định 2000) kèm `requestId`, `route`, `status`, `ms`
  - `exception` – lỗi chưa xử lý (cũng gửi lên Sentry nếu có `SENTRY_DSN`, tag `request_id` + `route`)
- Tìm 1 lỗi người dùng báo: Vercel → Logs → tìm theo mã request; Docker: `docker compose logs hub | grep <mã>`.
- Đổi mức log: `LOG_LEVEL=debug|info|warn|error`.

## Độ trễ theo route

Request được lấy mẫu ghi thêm tổng thời gian, số mẫu và số lỗi 5xx theo route (`rt:` / `rc:` / `re:` trong bucket Redis, gộp vào `TrafficDaily` mỗi ngày).
Trang stats có bảng **API chậm nhất** (độ trễ trung bình, cần ≥ 3 mẫu) cho 1 giờ / 24 giờ / 7 ngày / 30 ngày.
