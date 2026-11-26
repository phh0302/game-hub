# @monlabs/cli

Đẩy bản build game lên [Monlabs Game Hub](https://play.monlabs.fun) từ terminal hoặc CI – không cần upload qua web.

```bash
# 1. Studio → Token cho CLI / CI → Tạo token
npx @monlabs/cli login
# 2. Build game rồi đẩy lên (version mặc định lấy từ package.json)
npm run build
npx @monlabs/cli deploy ./dist --game my-game --notes "Sửa lỗi nhảy"
```

| Lệnh | |
|---|---|
| `monlabs login` | Lưu token vào `~/.monlabs/config.json` (quyền 600) |
| `monlabs games` | Game của studio |
| `monlabs deploy [dir] --game <slug> [--version] [--notes] [--dry-run]` | Nén thư mục build (bỏ `node_modules`, `.git`, `.env*`, `*.map`), tải lên, tạo phiên bản chờ duyệt, in kết quả quét |
| `monlabs sandbox [url]` | Link thử game local với hub giả lập |

`monlabs.json` trong project: `{ "game": "my-game", "dir": "dist" }`.

## GitHub Actions

```yaml
- run: npm ci && npm run build
- run: npx @monlabs/cli deploy ./dist --game my-game --version ${{ github.ref_name }}
  env:
    MONLABS_TOKEN: ${{ secrets.MONLABS_TOKEN }}
```

**Đừng commit token.** Để trong `MONLABS_TOKEN` / GitHub Secrets. Lộ token → thu hồi ngay trong Studio. Token chỉ dùng được cho API Studio.
Mã thoát: `0` ok · `1` lỗi · `2` sai cách dùng / thiếu token · `3` upload xong nhưng bản build bị quét ra mức nguy hiểm.
