# @monlabs/sdk

SDK cho game HTML5 chạy trên [Monlabs Game Hub](https://play.monlabs.fun): điểm & bảng xếp hạng, lưu tiến trình, sự kiện, chia sẻ / mời bạn, quảng cáo. Có sẵn kiểu TypeScript.

```bash
npm i @monlabs/sdk
```

```ts
import { GameHub } from "@monlabs/sdk";

const hub = await GameHub.init();          // trong hub: tự nhận người chơi, ngôn ngữ…
GameHub.gameStart();
const result = await GameHub.gameOver(1234);
await GameHub.saveState({ level: 3 });     // thay cho localStorage (bị chặn trong hub)
GameHub.track("level_complete", { level: 3 });
shareButton.onclick = () => GameHub.share({ score: 1234 });
```

- Không cần bundler? Dùng thẳng `<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script>`.
- Thử game đang chạy trên máy mà không cần upload: [Sandbox](https://play.monlabs.fun/developer/sandbox).
- Đẩy bản build từ terminal: [`@monlabs/cli`](https://www.npmjs.com/package/@monlabs/cli).
- Không có bí mật nào trong SDK. API key `pk_…` (chế độ độc lập) được phép lộ; **secret key `sk_…` chỉ dùng phía máy chủ** – để trong biến môi trường, đừng đưa vào code game.

Tài liệu đầy đủ: https://docs.monlabs.fun/sdk
