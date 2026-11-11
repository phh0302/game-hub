# monlabs.fun – landing page

Trang giới thiệu Monlabs. Trang tĩnh (HTML + CSS + JS thuần), không cần build.

- `index.html` – toàn bộ trang (song ngữ VI/EN, đổi bằng nút trên thanh trên cùng)
- `assets/` – ảnh bìa game, icon

Liên kết: Game Hub `https://play.monlabs.fun`, tài liệu `https://docs.monlabs.fun`.

## Deploy (Cloudflare Pages)

Project Cloudflare Pages `monlabs` nối với repo `game-hub`, nhánh `main`:
- Root directory: `sites/monlabs` · Build command: để trống · Build output directory: `.`
- Build watch paths → Include: `sites/monlabs/*` (chỉ deploy lại khi trang này đổi)
- Custom domain: `monlabs.fun` và `www.monlabs.fun`
