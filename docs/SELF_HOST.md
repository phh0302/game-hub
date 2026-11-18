# Chạy Game Hub trên VPS bằng Docker

Cả cụm chạy bằng 1 lệnh `docker compose`, mô hình:

```
Người dùng ─► Cloudflare (proxy, WAF, chặn DDoS) ─► VPS: nginx :443 ─► app (Next.js) :3000
                                                         │              ├─► Redis (+ srh: REST kiểu Upstash)
                                                         │              ├─► Neon Postgres (giữ nguyên)
                                                         │              └─► Cloudflare R2 (giữ nguyên)
                                                         ├─► monlabs.fun  (file tĩnh: sites/monlabs)
                                                         └─► docs.monlabs.fun (file tĩnh: VitePress)
                                                cron ──► app /api/cron/daily (03:17 UTC)
```

| Service | Vai trò |
|---|---|
| `app` | Next.js standalone (`Dockerfile`, target `runner`) |
| `migrate` | Chạy 1 lần mỗi lần cập nhật: `prisma migrate deploy` + seed, xong mới khởi động `app` |
| `nginx` | HTTPS, IP thật từ Cloudflare, giới hạn request theo IP, gzip, cache, phục vụ landing + docs |
| `redis` + `srh` | Rate limit, số liệu lưu lượng, cảnh báo – app gọi qua REST nên **không đổi code** so với Upstash |
| `cron` | Thay Vercel Cron |
| `db` | Postgres – chỉ khi chạy toàn bộ trên máy (`--profile db`) |

Chống quá tải 3 lớp: Cloudflare → nginx (`limit_req` 20 request/giây/IP cho API, 10/giây cho trang; `limit_conn` 60) → app (giới hạn theo nhóm + tự chặn IP, xem [TRAFFIC.md](TRAFFIC.md)).

## 1. Thuê VPS

- Tối thiểu **2 vCPU, 2 GB RAM, 40 GB SSD**, Ubuntu 24.04 (Vultr / DigitalOcean / Hetzner / VPS Việt Nam đều được).
- Khu vực gần người chơi (Singapore / Việt Nam). Ghi lại **IP của VPS**.

## 2. Cài Docker

```bash
ssh root@<IP-VPS>
curl -fsSL https://get.docker.com | sh
adduser deploy && usermod -aG docker deploy      # chạy bằng user thường
# Tường lửa: chỉ mở SSH + 80/443
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
```

> Nên chỉ cho Cloudflare gọi vào 80/443 (người khác không vượt được Cloudflare bằng IP thật của VPS):
> `for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from $ip to any port 80,443 proto tcp; done`
> rồi `ufw delete allow 80,443/tcp`.

## 3. Lấy code + cấu hình

```bash
su - deploy
git clone https://github.com/phh0302/game-hub.git && cd game-hub/deploy
cp .env.example .env && nano .env
```

Điền `.env` (**không** commit, không gửi qua chat):

| Biến | Lấy ở đâu |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Copy từ Vercel → Settings → Environment Variables (Neon) |
| `JWT_SECRET`, `ADMIN_WALLETS`, `CRON_SECRET` | Copy từ Vercel (giữ nguyên `JWT_SECRET` → người dùng không bị đăng xuất) |
| `S3_*`, `NEXT_PUBLIC_UPLOAD_BASE_URL`, `NEXT_PUBLIC_GAME_BASE_URL` | Copy từ Vercel (R2) |
| `REDIS_REST_TOKEN` | Tự tạo: `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | Như trên Vercel (nếu có) |

Redis trên VPS là Redis mới: số liệu lưu lượng cũ / IP đang bị chặn trên Upstash không chuyển sang (không ảnh hưởng người chơi).

## 4. Chứng chỉ HTTPS (Cloudflare Origin Certificate)

Cloudflare → domain `monlabs.fun` → **SSL/TLS → Origin Server → Create Certificate** (mặc định: `*.monlabs.fun, monlabs.fun`, 15 năm) → lưu 2 file vào VPS:

```bash
mkdir -p ~/game-hub/deploy/certs
nano ~/game-hub/deploy/certs/origin.pem   # dán "Origin Certificate"
nano ~/game-hub/deploy/certs/origin.key   # dán "Private Key"
chmod 600 ~/game-hub/deploy/certs/origin.key
```

**SSL/TLS → Overview → Full (strict)**. Thiếu chứng chỉ thì nginx tự tạo chứng chỉ tự ký (chỉ để chạy thử).

## 5. Chạy

```bash
cd ~/game-hub/deploy
docker compose up -d --build        # lần đầu ~5–10 phút (build image)
docker compose ps                   # app: healthy, migrate: exited (0)
BASE_IP=127.0.0.1 bash ../scripts/docker-smoke.sh   # kiểm tra nhanh (mục cuối sẽ chặn tạm IP máy chạy test 15 phút)
```

## 6. Chuyển DNS (lúc ít người chơi)

Cloudflare → DNS: đổi các bản ghi sang **A → IP VPS**, bật **Proxied** (mây cam):

| Tên | Trước (Vercel) | Sau |
|---|---|---|
| `play` | CNAME → Vercel | A → IP VPS, Proxied |
| `stats` | (chưa có) | A → IP VPS, Proxied |
| `@` (monlabs.fun) | Vercel | A → IP VPS, Proxied |
| `docs` | CNAME → Vercel | A → IP VPS, Proxied |
| `www` | – | CNAME → monlabs.fun, Proxied |

Kiểm tra: `curl -I https://play.monlabs.fun/api/v1/health`. Giữ project Vercel vài ngày để quay lại nhanh (đổi DNS về như cũ) nếu có sự cố, sau đó tắt **Vercel Cron** (Settings → Cron Jobs) để không chạy 2 lần.

Cloudflare nên bật thêm (xem [TRAFFIC.md](TRAFFIC.md#lớp-1--cloudflare-khi-chạy-trên-vps)): WAF managed rules, Bot Fight Mode, rate limiting rule cho `/api/`, cache cho `monlabs.fun` / `docs`.

## 7. Cập nhật phiên bản

```bash
cd ~/game-hub && git pull
cd deploy && docker compose up -d --build   # migrate tự chạy trước khi app mới khởi động
docker image prune -f
```

App khởi động lại mất ~10 giây (nginx trả 502 trong lúc đó). Quay lại bản trước: `git checkout <commit-cũ>` rồi chạy lại lệnh trên (migration database chỉ thêm, không xóa cột → bản cũ vẫn chạy được).

## 8. Theo dõi & sao lưu

- Log: `docker compose logs -f app nginx` (tự xoay vòng, tối đa 100MB/service).
- Lưu lượng, bất thường, cảnh báo Telegram: **stats.monlabs.fun**.
- Database: Neon tự sao lưu (Point-in-time restore). Chạy Postgres trong compose thì sao lưu hằng ngày:
  `docker compose exec -T db pg_dump -U gamehub gamehub | gzip > ~/backup/gamehub-$(date +%F).sql.gz` (cho vào `crontab -e`).
- File game: R2 (Cloudflare lo). Dùng `STORAGE_DRIVER=local` thì sao lưu volume `gamehub_uploads`.
- Redis chỉ chứa số liệu tạm (có `appendonly`), mất cũng không sao.
- Danh sách IP Cloudflare đổi (hiếm): `bash deploy/nginx/update-cloudflare-ips.sh` rồi `docker compose up -d --build nginx`.

## Chạy toàn bộ trên máy (không cần Neon / R2)

```bash
cd deploy && cp .env.example .env
# .env: DATABASE_URL=postgresql://gamehub:<mật-khẩu>@db:5432/gamehub (UNPOOLED giống vậy), POSTGRES_PASSWORD=<mật-khẩu>,
#       STORAGE_DRIVER=local, NEXT_PUBLIC_UPLOAD_BASE_URL=/uploads, NEXT_PUBLIC_GAME_BASE_URL=/uploads + các chuỗi bí mật
docker compose --profile db up -d --build
bash ../scripts/docker-smoke.sh   # dùng --resolve, không cần sửa file hosts
```

Mở trình duyệt: thêm vào file hosts `127.0.0.1 play.monlabs.fun monlabs.fun docs.monlabs.fun stats.monlabs.fun`, chấp nhận chứng chỉ tự ký. Với `STORAGE_DRIVER=local`, file developer upload nằm trong volume và nginx phục vụ ở `/uploads/u/` (vẫn chạy trong sandbox).
