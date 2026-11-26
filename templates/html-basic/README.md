# Tap Rush – HTML thuần + Monlabs SDK

Game nhỏ nhất có đủ tích hợp: `init`, `gameStart` / `gameOver`, lưu tiến trình (`saveState` / `loadState`), `track`, chia sẻ / mời bạn, quảng cáo thưởng, `pause` / `resume`, 2 ngôn ngữ.

```bash
npx degit phh0302/game-hub/templates/html-basic my-game
cd my-game
npx serve game            # http://localhost:3000
```

1. **Thử không cần upload**: mở https://play.monlabs.fun/developer/sandbox, dán `http://localhost:3000`.
2. **Đưa lên hub**: sửa `game` trong `monlabs.json` thành slug game của bạn, rồi
   `npx @monlabs/cli login` → `npx @monlabs/cli deploy --version 1.0.0` (hoặc nén thư mục `game/` và upload trong Studio).

Không có bí mật nào trong code game. Token CLI để trong biến môi trường `MONLABS_TOKEN`, không commit.
Tài liệu: https://docs.monlabs.fun/sdk
