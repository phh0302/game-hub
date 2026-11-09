# Deploy Game Hub lên mạng (Vercel + Neon)

Thời gian: khoảng 30 phút. Cần: tài khoản GitHub `phh0302` (đã có repo `game-hub`), ví MetaMask admin.

> **Lưu ý gói miễn phí Vercel (Hobby):** chỉ dùng cho mục đích **cá nhân, phi thương mại**.
> Khi bật quảng cáo, bán gói Premium hoặc nhận tiền để làm/host web → phải lên gói **Pro** (khoảng 20 USD/tháng).
> Giai đoạn chạy thử, chưa kiếm tiền thì dùng Hobby được.

## 0. Trước khi deploy

- CI trên GitHub đang **xanh** (tab *Actions* của repo): đã qua TypeScript, unit test, build
- Trên máy, file `.env` có thêm dòng `DIRECT_URL` giống hệt `DATABASE_URL` (xem `.env.example`)

## 1. Tạo database trên Neon

1. Vào <https://neon.com> → **Sign up with GitHub**
2. **Create project**: tên `game-hub`, Postgres bản mới nhất, **Region: AWS Asia Pacific (Singapore)** – gần Việt Nam nhất
3. Ở trang project → **Connect** → lấy 2 chuỗi kết nối:
   - Bật **Connection pooling** → copy → đây là `DATABASE_URL` (host có chữ `-pooler`)
   - Tắt **Connection pooling** → copy → đây là `DIRECT_URL`
4. Lưu 2 chuỗi này ở chỗ an toàn (có mật khẩu database bên trong – **không** dán lên chat / commit lên GitHub)

## 2. Tạo bảng + dữ liệu mẫu trên database production

Chạy trên máy, trong `D:\game hub`, bằng **PowerShell** (biến đặt ở đây chỉ có tác dụng trong cửa sổ này, không sửa `.env`):

```powershell
$env:DATABASE_URL="<chuỗi pooled ở bước 1>"
$env:DIRECT_URL="<chuỗi direct ở bước 1>"
npx prisma migrate deploy
npx prisma db seed
```

Thấy `Seed xong: 6 thể loại, studio Game Hub, game 2048` là được. Đóng cửa sổ PowerShell này sau khi xong.

## 3. Tạo project trên Vercel

1. Vào <https://vercel.com> → **Continue with GitHub** → cho phép truy cập repo `phh0302/game-hub`
2. **Add New… → Project** → chọn `game-hub` → **Import**
3. **Project Name**: đặt tên, vd `gamehub-vn` → web sẽ có địa chỉ `https://gamehub-vn.vercel.app`
4. **Build and Output Settings** → bật override **Build Command**: `npm run vercel-build`
   (tự chạy `prisma migrate deploy` trước khi build → mỗi lần deploy database luôn đúng cấu trúc mới)
5. **Environment Variables** – thêm từng dòng:

| Tên | Giá trị |
|---|---|
| `DATABASE_URL` | chuỗi **pooled** của Neon |
| `DIRECT_URL` | chuỗi **direct** của Neon |
| `JWT_SECRET` | chuỗi ngẫu nhiên MỚI (khác máy dev): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_WALLETS` | `0xa4014A8721bbC61c1e0b8871284C4D19c7D0F4FA` |
| `NEXT_PUBLIC_APP_URL` | `https://gamehub-vn.vercel.app` (đúng tên project ở bước 3) |
| `NEXT_PUBLIC_ASSET_BASE_URL` | `/uploads` |
| `NEXT_PUBLIC_GAME_BASE_URL` | `/uploads` |

6. **Deploy** → chờ 2–3 phút
7. Sau khi deploy xong: **Settings → Functions → Function Region** → chọn **Singapore (sin1)** (cùng nơi với database, giảm độ trễ) → **Deployments → Redeploy**

> Biến `NEXT_PUBLIC_*` được "đóng gói" lúc build → đổi giá trị thì phải **Redeploy** mới có tác dụng.

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

## 5. Gắn domain riêng (khi có)

1. Vercel → **Settings → Domains** → thêm domain (vd `gamehub.vn`) → làm theo hướng dẫn trỏ DNS
2. Sửa `NEXT_PUBLIC_APP_URL` = `https://gamehub.vn` → **Redeploy**
   (domain trong thông điệp ký ví phải trùng domain thật, nếu không sẽ không đăng nhập được)

## Lưu ý vận hành

- **Bản Preview** (mỗi nhánh / pull request Vercel tạo 1 link riêng): đăng nhập ví sẽ **không** chạy vì domain khác `NEXT_PUBLIC_APP_URL` – đây là cơ chế chống giả mạo, không phải lỗi
- **Thêm game mới**: hiện vẫn chép bản build vào `public/uploads/games/...`, commit + push → Vercel tự deploy; sau đó vào trang Quản trị thêm phiên bản + duyệt. Upload trực tiếp sẽ có ở Phase 10
- **Rate limit** đang lưu trong bộ nhớ từng server → trên Vercel chỉ chặn được một phần. Khi có nhiều người chơi: chuyển sang Upstash Redis
- **Xem lỗi**: Vercel → project → **Logs**
- **Sao lưu database**: Neon có khôi phục theo thời điểm (point-in-time restore) – kiểm tra số ngày giữ lại của gói đang dùng
- Mỗi lần push lên `main`: CI chạy kiểm tra **và** Vercel tự deploy. Nên mở trang *Actions* xem CI xanh trước khi chia sẻ link
