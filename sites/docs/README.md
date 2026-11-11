# docs.monlabs.fun – tài liệu cho developer

Trang tài liệu đăng game lên Game Hub, viết bằng [VitePress](https://vitepress.dev) (Markdown → trang tĩnh).
Tiếng Việt ở gốc, tiếng Anh trong thư mục `en/` – **cùng tên file** với bản tiếng Việt để nút đổi ngôn ngữ chuyển đúng trang. Thêm trang mới thì thêm cả 2 bản và cả 2 sidebar (`themeConfig` và `locales.en.themeConfig`).

```bash
cd sites/docs
npm install
npm run dev     # xem thử ở http://localhost:5173
npm run build   # build ra .vitepress/dist (báo lỗi nếu có link hỏng)
```

Mỗi trang là 1 file `.md`; mục lục bên trái khai báo ở `themeConfig.sidebar` trong `.vitepress/config.mts`.

## Deploy (Vercel)

Project Vercel `monlabs-docs` nối repo `game-hub`, nhánh `main`:
- Root Directory: `sites/docs` · cấu hình build trong `sites/docs/vercel.json` (output `.vitepress/dist`)
- Tên miền `docs.monlabs.fun` – DNS ở Cloudflare: CNAME `docs` → giá trị Vercel đưa, **Proxy tắt (DNS only)**
