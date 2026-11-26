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
| hub → game | `INIT` | `{ protocolVersion, standalone, locale, player, canSubmitScore, ads: { rewarded, interstitial }, social: { share, invite }, invites }` |
| game → hub | `GAME_START` | `{}` |
| game → hub | `GAME_OVER` | `{ score, leaderboard }` |
| game → hub | `AD_REQUEST` | `{ requestId, kind: "rewarded" \| "interstitial" }` |
| hub → game | `SCORE_RESULT` | `{ saved, code, message, score?, best?, rank?, isNewBest? }` |
| hub → game | `AD_RESULT` | `{ requestId, shown, rewarded, reason? }` |
| game → hub | `STATE_SAVE` | `{ requestId, data }` – `data` là **chuỗi** JSON ≤ 65.536 ký tự |
| game → hub | `STATE_LOAD` | `{ requestId }` |
| hub → game | `STATE_RESULT` | Trả lời `STATE_SAVE`: `{ requestId, saved, code }` · trả lời `STATE_LOAD`: `{ requestId, data: string \| null }` |
| game → hub | `TRACK` | `{ events: [{ name, props? }] }` – tối đa 50 sự kiện / tin, không cần trả lời |
| game → hub | `SHARE` | `{ requestId, text?, score? }` – mở bảng chia sẻ của hub (23/11/2026) |
| game → hub | `INVITE` | `{ requestId, text? }` – mở bảng mời bạn (link có mã mời) |
| hub → game | `SHARE_RESULT` | `{ requestId, shared, method }` – khi người chơi đóng bảng |
| game → hub | `ROOM` | `{ requestId, op: "create" \| "join" \| "leave" \| "start" \| "move", body }` – phòng chơi theo lượt (26/11/2026) |
| hub → game | `ROOM_RESULT` | `{ requestId, ok, room?, code? }` |
| hub → game | `ROOM_UPDATE` | `{ room }` – phòng thay đổi (hub hỏi lại máy chủ mỗi ~1,5 giây) |
| hub → game | `PAUSE` / `RESUME` | `{}` |

## Trình tự

1. Game tải xong → gửi `READY`
2. Hub trả `INIT` (và gửi lại `INIT` mỗi khi người chơi đăng nhập hoặc đổi ngôn ngữ)
3. Người chơi bắt đầu ván → game gửi `GAME_START`
4. Hết ván → game gửi `GAME_OVER` → hub trả `SCORE_RESULT` (SDK có sẵn chờ tối đa 20 giây)
5. Lưu / đọc tiến trình bất kỳ lúc nào: `STATE_SAVE` / `STATE_LOAD` → `STATE_RESULT` cùng `requestId` (SDK có sẵn chờ 5 giây). Game trong khung không dùng được `localStorage` nên đây là cách lưu duy nhất – xem [Môi trường](/moi-truong#luu-du-lieu)

Nếu game không nằm trong khung (mở trực tiếp), hoặc sau 3 giây không nhận được `INIT`, SDK có sẵn coi như game chạy độc lập và trả về `standalone: true`. SDK tự viết nên làm tương tự.

## Phiên bản giao thức

Trường `v` là phiên bản giao thức, hiện là `1`. Phiên bản tăng khi có thay đổi không tương thích; hub tiếp tục hỗ trợ game dùng phiên bản cũ.
