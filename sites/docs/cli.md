# npm, TypeScript & CLI

## SDK qua npm {#npm}

```bash
npm i @monlabs/sdk
```

```ts
import { GameHub, type InitData } from "@monlabs/sdk";

const hub: InitData = await GameHub.init();
GameHub.gameStart();
const result = await GameHub.gameOver(score); // result.saved, result.best, result.rank…
await GameHub.saveState({ level });
```

- Cùng mã với `<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js">` – chọn 1 trong 2 cách.
- Có sẵn kiểu TypeScript cho mọi hàm, dữ liệu `init`, kết quả điểm / lưu / quảng cáo / chia sẻ.
- Import an toàn khi SSR (Next.js, Nuxt…): SDK chỉ chạy khi gọi lần đầu trên trình duyệt.
- Chế độ độc lập (`init({ projectKey })`) mặc định gọi API `https://play.monlabs.fun`.

## Đẩy bản build từ terminal {#cli}

1. Studio → **Token cho CLI / CI** → **Tạo token** (chỉ hiện 1 lần).
2. Đăng nhập rồi deploy:

```bash
npx @monlabs/cli login
npm run build
npx @monlabs/cli deploy ./dist --game my-game --version 1.0.1 --notes "Sửa lỗi"
```

- Nén thư mục build (bỏ `node_modules`, `.git`, `.env*`, `*.map`), tải lên, tạo phiên bản **chờ duyệt**, in kết quả [quét tự động](/chuan-bi-zip#quet).
- `version` bỏ trống → lấy từ `package.json`. `monlabs.json`: `{ "game": "my-game", "dir": "dist" }`.
- `monlabs games` – game của studio · `monlabs sandbox http://localhost:5173` – link [Sandbox](/sdk#sandbox).

### GitHub Actions

```yaml
name: deploy
on: { push: { tags: ["v*"] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - run: npx @monlabs/cli deploy ./dist --game my-game --version ${GITHUB_REF_NAME#v}
        env:
          MONLABS_TOKEN: ${{ secrets.MONLABS_TOKEN }}
```

## Giữ bí mật {#bi-mat}

| Thứ | Lộ được không | Để ở đâu |
|---|---|---|
| API key `pk_…` (chế độ độc lập) | Được – công khai, giới hạn theo domain | Code game |
| Secret key `sk_…`, webhook secret | **Không** | Biến môi trường máy chủ của bạn |
| Token CLI `mlb_…` | **Không** | `MONLABS_TOKEN` / GitHub Secrets – lộ thì thu hồi ngay trong Studio |

Token CLI chỉ dùng được cho API Studio (không xem được tài khoản, không vào trang quản trị, không tạo token khác).
Thêm `.env*` vào `.gitignore`; project mẫu đã có sẵn.
