# Lịch sử SDK

Mỗi **bản chính** có đường dẫn riêng (`/sdk/v1/`, `/sdk/v2/`, `/sdk/v3/`) – xem [Phiên bản SDK](/sdk#phien-ban). Trong cùng một bản chính chỉ có sửa lỗi và tính năng **thêm vào**; thay đổi phá vỡ tương thích luôn ra bản chính mới.

## v3 – 18/11/2026 {#v3}

`https://play.monlabs.fun/sdk/v3/gamehub-sdk.js`

- **Mới:** `GameHub.saveState(data)` / `GameHub.loadState()` – người chơi đã kết nối ví được lưu theo tài khoản (đồng bộ giữa thiết bị, từ 18/11/2026) – lưu tiến trình khi chạy trên hub, nơi `localStorage` / IndexedDB luôn lỗi ([Lưu tiến trình](/sdk#luu-tien-trinh)). Giao thức thêm tin `STATE_SAVE`, `STATE_LOAD`, `STATE_RESULT`.
- **Đổi:** chế độ hub, `gameOver()` trả về `Promise` kết quả (trước đây `undefined`) – giống chế độ độc lập; hub không trả lời sau 20 giây → `code: "TIMEOUT"`. Mở file trực tiếp → `code: "STANDALONE"` và phát `scoreResult`.
- **Đổi:** `gameOver(score)` với `score` không phải số → in cảnh báo trong console (vẫn nộp 0 như cũ).
- Hub: lỗi mạng khi nộp điểm trả `code: "NETWORK"` (trước đây `UNKNOWN`).
- 20/11/2026: chế độ độc lập – `saveState()` / `loadState()` lưu theo tài khoản khi người chơi đã `login()` (API `/api/p1/state`), chung dữ liệu với bản trên hub.

Chuyển từ v2: không bắt buộc sửa gì – code không dùng giá trị trả về của `gameOver()` chạy y như cũ. Game đang lưu bằng `localStorage` nên chuyển sang `saveState()`.

## v2 – 13/11/2026 {#v2}

`https://play.monlabs.fun/sdk/v2/gamehub-sdk.js`

- **Mới:** chế độ độc lập (Platform API) – `init({ projectKey })`, `login()`, `login({ guest: true })`, `logout()`, `me()`, `leaderboard()`, `leaderboards()`; `gameStart()` trả `sessionId`; `gameOver()` trả `Promise` kết quả ([Dùng ngoài Game Hub](/ngoai-hub)).
- Huy hiệu "Powered by Monlabs" ở gói Free; thông báo hạn mức (`QUOTA_*`) và chặn IP (`IP_BLOCKED`).
- Chế độ hub giữ nguyên như v1.

## v1 – 05/11/2026 {#v1}

`https://play.monlabs.fun/sdk/v1/gamehub-sdk.js`

- Chế độ hub: `init()`, `gameStart()`, `gameOver(score, { leaderboard })`, `showRewardedAd()`, `showInterstitialAd()`, sự kiện `init` / `scoreResult` / `pause` / `resume`.
