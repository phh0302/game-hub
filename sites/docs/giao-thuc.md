# Giao thức postMessage

Trang này dành cho ai muốn **tự viết SDK** – ví dụ plugin cho Unity, Godot hay engine riêng – thay vì dùng file `gamehub-sdk.js`. Nếu game là HTML/JavaScript, cứ dùng [SDK có sẵn](/sdk).

## Định dạng tin nhắn

Game và hub nói chuyện qua `window.postMessage`. Mọi tin nhắn có dạng:

```js
{ source: "gamehub", v: 1, type: "GAME_START", payload: {} }
```

- Game gửi lên trang cha: `window.parent.postMessage(message, "*")`
- Hub gửi xuống khung game; game lắng nghe sự kiện `message` trên `window` và bỏ qua tin không có `source: "gamehub"`

## Các loại tin nhắn

| Chiều | `type` | `payload` |
| --- | --- | --- |
| game → hub | `READY` | `{ sdkVersion }` |
| hub → game | `INIT` | `{ protocolVersion, standalone, locale, player, canSubmitScore }` |
| game → hub | `GAME_START` | `{}` |
| game → hub | `GAME_OVER` | `{ score, leaderboard }` |
| game → hub | `AD_REQUEST` | `{ requestId, kind: "rewarded" \| "interstitial" }` |
| hub → game | `SCORE_RESULT` | `{ saved, code, message, score?, best?, rank?, isNewBest? }` |
| hub → game | `AD_RESULT` | `{ requestId, shown, rewarded, reason? }` |
| hub → game | `PAUSE` / `RESUME` | `{}` |

## Trình tự

1. Game tải xong → gửi `READY`
2. Hub trả `INIT` (và gửi lại `INIT` mỗi khi người chơi đăng nhập hoặc đổi ngôn ngữ)
3. Người chơi bắt đầu ván → game gửi `GAME_START`
4. Hết ván → game gửi `GAME_OVER` → hub trả `SCORE_RESULT`

Nếu game không nằm trong khung (mở trực tiếp), hoặc sau 3 giây không nhận được `INIT`, SDK có sẵn coi như game chạy độc lập và trả về `standalone: true`. SDK tự viết nên làm tương tự.

## Phiên bản giao thức

Trường `v` là phiên bản giao thức, hiện là `1`. Phiên bản tăng khi có thay đổi không tương thích; hub tiếp tục hỗ trợ game dùng phiên bản cũ.
