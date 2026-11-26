# Star Dodge – Phaser 3 + Vite + TypeScript + Monlabs SDK

```bash
npx degit phh0302/game-hub/templates/phaser-vite-ts my-game
cd my-game && npm install
npm run dev               # http://localhost:5173
```

- **Thử không cần upload**: https://play.monlabs.fun/developer/sandbox → dán `http://localhost:5173`.
- **Tích hợp SDK** gom ở `src/hub.ts` (có kiểu TypeScript từ `@monlabs/sdk`): init, lưu tiến trình thay localStorage, điểm, sự kiện, quảng cáo hồi sinh, chia sẻ, mời bạn, tạm dừng.
- **Build**: `npm run build` → `dist/` (đường dẫn tương đối, `base: "./"`).
- **Đẩy lên hub**: sửa `game` trong `monlabs.json`, `npx monlabs login`, rồi `npm run deploy`. Tự động khi tạo tag: `.github/workflows/deploy.yml` + secret `MONLABS_TOKEN`.

## Bí mật

- Trong hub **không cần key nào**.
- Chạy trên domain riêng: chép `.env.example` → `.env`, điền API key công khai `pk_…`.
- **Không** đặt secret key `sk_…` hay token `mlb_…` vào biến `VITE_*` – Vite nhúng mọi biến `VITE_*` vào bản build ai cũng đọc được. `.env` đã có trong `.gitignore`.
