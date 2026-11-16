# monlabs.fun – landing page

Trang giới thiệu Monlabs. Trang tĩnh (HTML + CSS + JS thuần), không cần build.

- `index.html` – toàn bộ trang (song ngữ VI/EN, đổi bằng nút trên thanh trên cùng)
- `assets/` – ảnh bìa game, icon

Liên kết: Game Hub `https://play.monlabs.fun`, tài liệu `https://docs.monlabs.fun`.

## Deploy (Vercel)

Project Vercel `monlabs` (cùng tài khoản với Game Hub) nối với repo `game-hub`, nhánh `main`:
- Root Directory: `sites/monlabs` · Application Preset: Other (không build)
- Không build bản Preview; bản chính chỉ build khi `sites/monlabs` thay đổi (`scripts/vercel-ignore-build.sh`)
- Tên miền: `monlabs.fun` (chính), `www.monlabs.fun` → chuyển 308 về `monlabs.fun`
- DNS ở Cloudflare (tài khoản Anbinh3785): CNAME `@` và `www` → giá trị Vercel đưa ở Settings → Domains, **Proxy tắt (DNS only)**

Tên miền con: `play.monlabs.fun` → project `game-hub` (CNAME `play`, DNS only); `docs.monlabs.fun` → project `monlabs-docs` (CNAME `docs`, DNS only).

## Trang trạng thái (`/status/`)

`status/index.html` kiểm tra trực tiếp từ trình duyệt người xem: `play.monlabs.fun`, `/api/v1/health` (API + database), `/api/p1/project` không có key (phải trả 401 `INVALID_API_KEY`), `docs.monlabs.fun`, chính `monlabs.fun`.

Ghi sự cố: thêm 1 mục vào đầu `status/incidents.json` rồi commit (Vercel tự deploy):

```json
{
  "id": "2026-12-01-db",
  "status": "investigating",
  "components": ["api"],
  "startedAt": "2026-12-01",
  "resolvedAt": null,
  "title": { "vi": "…", "en": "…" },
  "updates": [{ "at": "2026-12-01", "text": { "vi": "…", "en": "…" } }]
}
```

`status`: `investigating` (đang xử lý) hoặc `resolved` (đã xử lý). Ngày dạng `YYYY-MM-DD` hoặc ISO đầy đủ.
