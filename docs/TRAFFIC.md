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
