# Deploy Game Hub lên mạng (Vercel + Neon)

Thời gian: khoảng 30 phút. Cần: tài khoản GitHub `phh0302` (đã có repo `game-hub`), ví MetaMask admin.

> **Lưu ý gói miễn phí Vercel (Hobby):** chỉ dùng cho mục đích **cá nhân, phi thương mại**.
> Khi bật quảng cáo, bán gói Premium hoặc nhận tiền để làm/host web → phải lên gói **Pro** (khoảng 20 USD/tháng).
> Giai đoạn chạy thử, chưa kiếm tiền thì dùng Hobby được.

## 0. Trước khi deploy

- CI trên GitHub đang **xanh** (tab *Actions* của repo): đã qua TypeScript, unit test, build
- Trên máy, file `.env` có thêm dòng `DATABASE_URL_UNPOOLED` giống hệt `DATABASE_URL` (xem `.env.example`)

## 1. Tạo database Neon ngay trong Vercel

1. Vercel → tab **Storage** → **Create Database** → chọn **Neon** (Serverless Postgres) → **Continue**
2. **Region: Singapore** (gần Việt Nam nhất) · **Plan: Free** · đặt tên `game-hub-db` → **Create**
3. Database sẽ được **kết nối vào project ở bước 3** → Vercel tự tạo 2 biến môi trường:
   - `DATABASE_URL` (kết nối qua pooler – web dùng khi chạy)
   - `DATABASE_URL_UNPOOLED` (kết nối trực tiếp – Prisma dùng để chạy migration)
4. **Không** chụp màn hình / dán chuỗi kết nối lên chat hay GitHub (có mật khẩu database). Lỡ lộ thì vào
   **Open in Neon → Roles → `neondb_owner` → Reset password**, rồi kết nối lại database vào project

> Tạo ở trang Neon riêng (<https://neon.com>) cũng được: bật/tắt **Connection pooling** để lấy 2 chuỗi,
> rồi tự nhập vào Vercel với đúng 2 tên biến trên.

## 2. Tạo bảng + dữ liệu mẫu

Không cần làm tay: lệnh build `npm run vercel-build` tự chạy `prisma migrate deploy` (tạo/cập nhật bảng)
và `prisma db seed` (thể loại, studio, game 2048 – chạy lại nhiều lần vẫn an toàn, không ghi đè dữ liệu admin đã sửa).

## 3. Tạo project trên Vercel

1. Vào <https://vercel.com> → **Continue with GitHub** → cho phép truy cập repo `phh0302/game-hub`
2. **Add New… → Project** → chọn `game-hub` → **Import**
3. **Project Name**: đặt tên, vd `gamehub-vn` → web sẽ có địa chỉ `https://gamehub-vn.vercel.app`
4. **Build and Output Settings** → bật override **Build Command**: `npm run vercel-build`
   (tự chạy migration + seed trước khi build → mỗi lần deploy database luôn đúng cấu trúc mới)
5. **Environment Variables** – thêm từng dòng (2 biến database KHÔNG cần nhập, xem bước 6):

| Tên | Giá trị |
|---|---|
| `JWT_SECRET` | chuỗi ngẫu nhiên MỚI (khác máy dev): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_WALLETS` | `0xa4014A8721bbC61c1e0b8871284C4D19c7D0F4FA` |
| `NEXT_PUBLIC_APP_URL` | `https://gamehub-vn.vercel.app` (đúng tên project ở bước 3) |
| `NEXT_PUBLIC_ASSET_BASE_URL` | `/uploads` |
| `NEXT_PUBLIC_GAME_BASE_URL` | `/uploads` |

6. Kết nối database: **Storage → `game-hub-db` → Connect Project** → chọn project này, tick đủ
   Production / Preview / Development → **Connect** (tạo `DATABASE_URL` + `DATABASE_URL_UNPOOLED`).
   Nếu bước Import đã deploy trước khi có database thì bản đó lỗi – không sao, sang bước 8 Redeploy
7. **Deploy** → chờ 2–3 phút
8. Sau khi deploy xong: **Settings → Functions → Function Region** → chọn **Singapore (sin1)** (cùng nơi với database, giảm độ trễ) → **Deployments → Redeploy**

> Biến `NEXT_PUBLIC_*` được "đóng gói" lúc build → đổi giá trị thì phải **Redeploy** mới có tác dụng.

## 3b. Kho lưu file cho developer upload (Cloudflare R2)

Cần khi mở cho developer đăng game. Vercel không cho ghi file, nên bản build và ảnh bìa lưu ở R2
(miễn phí 10GB, **không tính phí băng thông** – hợp với game nhiều lượt tải).

1. <https://dash.cloudflare.com> → **R2 Object Storage** → **Create bucket** → tên `gamehub-uploads`, location **Asia-Pacific**
2. Bucket → **Settings → Public Development URL** → **Allow** → copy URL dạng `https://pub-xxxx.r2.dev`
   (hoặc **Custom Domains** → gắn `cdn.<domain-của-bạn>`; khuyên dùng khi có domain riêng)
3. Bucket → **Settings → CORS Policy** → **Add** → tab JSON, dán (thay domain hub của bạn):

```json
[
  {
    "AllowedOrigins": ["https://play.monlabs.fun", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Bucket → **Settings → Object lifecycle rules** → **Add rule**: prefix `u/incoming/`, xóa object sau **1 ngày**
   (file .zip đã xử lý tự xóa, rule này dọn các lần upload bị bỏ dở)
5. R2 → **Manage R2 API Tokens** → **Create API token** → quyền **Object Read & Write**, chỉ bucket `gamehub-uploads`
   → lưu **Access Key ID**, **Secret Access Key** và **endpoint** `https://<account-id>.r2.cloudflarestorage.com`
6. Vercel → **Settings → Environment Variables** → thêm:

| Tên | Giá trị |
|---|---|
| `STORAGE_DRIVER` | `s3` |
| `NEXT_PUBLIC_UPLOAD_BASE_URL` | URL công khai ở bước 2 (`https://pub-xxxx.r2.dev`) |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `gamehub-uploads` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | khóa ở bước 5 |
| `S3_REGION` | `auto` |

7. **Redeploy**. Kiểm tra: tạo studio → tạo game → upload `.zip` → **Chơi thử** chạy được

> Bản build chạy ở domain R2 (khác hub) nên tự cô lập với cookie đăng nhập của hub – đây là lý do không phục vụ game của developer từ chính domain hub.
> Nhắc developer nhúng SDK bằng đường dẫn đầy đủ `https://<domain-hub>/sdk/gamehub-sdk.js`.

## 3c. Chống spam + theo dõi lỗi (Upstash Redis, Sentry) – miễn phí

**Upstash Redis** (rate limit dùng chung cho mọi server – trên Vercel mỗi request có thể chạy ở server khác nhau):

1. Vercel → project → tab **Storage** → **Create Database** → **Upstash for Redis** → region **Singapore** (`ap-southeast-1`), gói **Free**
2. **Connect Project** → chọn project, tick Production / Preview / Development → Vercel tự tạo `KV_REST_API_URL` và `KV_REST_API_TOKEN`
   (tạo ở <https://console.upstash.com> cũng được: copy **REST URL** / **REST Token** vào `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)

**Sentry** (gửi email khi web có lỗi, kèm vị trí lỗi):

1. <https://sentry.io> → đăng ký gói **Developer** (miễn phí) → **Create Project** → nền tảng **Next.js** → đặt tên `game-hub`
2. Bỏ qua bước cài wizard (hub tự gửi lỗi, không cần thư viện) → **Settings → Projects → game-hub → Client Keys (DSN)** → copy **DSN**
3. Vercel → **Environment Variables** → `SENTRY_DSN` = DSN vừa copy (chỉ cần cho Production)

**Redeploy** để nhận biến mới. Kiểm tra: `https://<tên>.vercel.app/api/v1/health` → có `"rateLimit":"redis"`.

## 4. Kiểm tra sau khi deploy

| Kiểm tra | Mong đợi |
|---|---|
| `https://<tên>.vercel.app/api/v1/health` | `{"status":"ok","db":"ok",...}` |
| Trang chủ | Hiện game 2048 + thể loại |
| Kết nối ví → ký | MetaMask hiện đúng domain `<tên>.vercel.app`; đăng nhập được |
| Chơi 2048 > 5 giây | Điểm lên bảng xếp hạng |
| Menu → Quản trị | Vào được bằng ví admin |
| F12 → Application → Cookies → `gh_session` | HttpOnly ✓, **Secure ✓**, SameSite Lax ✓ |
| Mở `https://<tên>.vercel.app/uploads/games/2048/1.0.0/index.html`, Console gõ `document.cookie` | `SecurityError` (game bị ép sandbox) |

## 5. Gắn domain riêng

Đang dùng: **`https://play.monlabs.fun`** (project `game-hub`), landing page `https://monlabs.fun` (project `monlabs`, xem `sites/monlabs/README.md`).
DNS của `monlabs.fun` ở Cloudflare: CNAME `play` → giá trị Vercel đưa ở Settings → Domains, **Proxy tắt (DNS only)** để Vercel tự cấp https.
Khi đổi domain: sửa `NEXT_PUBLIC_APP_URL` → Redeploy, thêm domain vào **CORS của R2** (bước 3b) – nếu không upload sẽ lỗi.

Cách làm cho domain khác:

1. Vercel → **Settings → Domains** → thêm domain (vd `gamehub.vn`) → làm theo hướng dẫn trỏ DNS
2. Sửa `NEXT_PUBLIC_APP_URL` = `https://gamehub.vn` → **Redeploy**
   (domain trong thông điệp ký ví phải trùng domain thật, nếu không sẽ không đăng nhập được)

## Lưu ý vận hành

- **Không có bản Preview**: `vercel.json` (gốc repo, `sites/monlabs`, `sites/docs`) gọi `scripts/vercel-ignore-build.sh` →
  Vercel bỏ qua build cho pull request ("Canceled by Ignored Build Step") vì Preview dùng chung database/Redis với bản chính.
  Pull request được kiểm tra bằng GitHub CI. Bản chính của mỗi project chỉ build khi phần của nó thay đổi
  (sửa `sites/` không build lại Game Hub)

- **Thêm game mới**: developer tự upload ở trang `/developer` (cần R2 – mục 3b) → admin chơi thử + duyệt ở trang Quản trị
- **Rate limit** đang lưu trong bộ nhớ từng server → trên Vercel chỉ chặn được một phần. Khi có nhiều người chơi: chuyển sang Upstash Redis
- **Xem lỗi**: Vercel → project → **Logs**
- **Sao lưu database**: Neon có khôi phục theo thời điểm (point-in-time restore) – kiểm tra số ngày giữ lại của gói đang dùng
- Mỗi lần push lên `main`: CI chạy kiểm tra **và** Vercel tự deploy. Nên mở trang *Actions* xem CI xanh trước khi chia sẻ link
