# monlabs.fun – landing page

Trang giới thiệu Monlabs. Trang tĩnh (HTML + CSS + JS thuần), không cần build.

- `index.html` – toàn bộ trang (song ngữ VI/EN, đổi bằng nút trên thanh trên cùng)
- `assets/` – ảnh bìa game, icon

Liên kết: Game Hub `https://play.monlabs.fun`, tài liệu `https://docs.monlabs.fun`.

## Deploy (Vercel)

Project Vercel `monlabs` (cùng tài khoản với Game Hub) nối với repo `game-hub`, nhánh `main`:
- Root Directory: `sites/monlabs` · Application Preset: Other (không build)
- Tên miền: `monlabs.fun` (chính), `www.monlabs.fun` → chuyển 308 về `monlabs.fun`
- DNS ở Cloudflare (tài khoản Anbinh3785): CNAME `@` và `www` → giá trị Vercel đưa ở Settings → Domains, **Proxy tắt (DNS only)**

Tên miền con: `play.monlabs.fun` → project `game-hub` (CNAME `play`, DNS only); `docs.monlabs.fun` – chưa làm.
