# Game Hub SDK v1 – Hướng dẫn tích hợp game

Tài liệu cho developer muốn đưa game HTML5 lên Game Hub.

## 1. Yêu cầu bản build

- Game HTML5 tĩnh (HTML/CSS/JS, ảnh, âm thanh…), file chạy chính là `index.html`
- Mọi đường dẫn tài nguyên trong game là **đường dẫn tương đối** (`./img/a.png`, không dùng `/img/a.png`)
- Không cần server riêng: game chạy hoàn toàn trên trình duyệt

## 2. Môi trường chạy

Hub nhúng game trong `iframe` có `sandbox="allow-scripts allow-pointer-lock"`:

- Game **không đọc được** cookie, trang hay dữ liệu đăng nhập của hub
- `localStorage` / `sessionStorage` có thể bị chặn → luôn bọc `try/catch`
- Không mở popup, không điều hướng trang cha, không gửi form
- Mọi giao tiếp với hub đi qua SDK (`postMessage`)

## 3. Nhúng SDK

```html
<script src="https://<domain-cua-hub>/sdk/gamehub-sdk.js"></script>
<!-- Khi chạy trên hub ở máy local: <script src="/sdk/gamehub-sdk.js"></script> -->
```

SDK tạo biến toàn cục `window.GameHub`.

## 4. API

| Hàm | Khi nào gọi | Kết quả |
|---|---|---|
| `GameHub.init()` | 1 lần khi game tải xong | `Promise<{ locale, player, canSubmitScore, standalone }>` |
| `GameHub.gameStart()` | Bắt đầu 1 ván mới (nên gọi ở thao tác đầu tiên của người chơi) | Hub bắt đầu tính giờ lượt chơi |
| `GameHub.gameOver(score, { leaderboard })` | Ván kết thúc | Hub nộp điểm (số nguyên ≥ 0) lên bảng xếp hạng `leaderboard` (mặc định `"default"`) |
| `GameHub.showRewardedAd()` | Người chơi chọn xem quảng cáo để nhận thưởng | `Promise<{ shown, rewarded, reason? }>` – **chỉ thưởng khi `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Giữa các màn | `Promise<{ shown }>` |
| `GameHub.on("init" \| "pause" \| "resume", cb)` | Lắng nghe hub | `init` được gửi lại khi người chơi đăng nhập hoặc đổi ngôn ngữ |

Dữ liệu `init`:

```js
{
  protocolVersion: 1,
  standalone: false,      // true khi mở game trực tiếp, không qua hub
  locale: "vi",           // "vi" | "en"
  player: { displayName: "ha_pham" } | null,
  canSubmitScore: true    // false = người chơi chưa kết nối ví, điểm sẽ không được lưu
}
```

> Hiện hub **chưa bật quảng cáo**: `showRewardedAd()` trả về `{ shown: false, rewarded: false }`. Hãy thiết kế để game vẫn chơi bình thường khi không có quảng cáo.

## 5. Ví dụ tối thiểu

```html
<script src="/sdk/gamehub-sdk.js"></script>
<script>
  let score = 0;
  let playing = false;

  GameHub.init().then((hub) => {
    document.documentElement.lang = hub.locale;
  });

  function onFirstInput() {
    if (!playing) {
      playing = true;
      GameHub.gameStart();
    }
  }

  function onGameOver() {
    playing = false;
    GameHub.gameOver(score);
  }
</script>
```

Game mẫu đầy đủ: `public/uploads/games/2048/1.0.0/` (2048, song ngữ, bàn phím + vuốt).

## 6. Quy tắc tính điểm

- Mỗi `gameStart()` → hub tạo 1 lượt chơi; mỗi lượt chơi chỉ nộp điểm **1 lần**
- Điểm bị từ chối nếu: chơi ngắn hơn thời gian tối thiểu, quá số giờ tối đa, vượt điểm tối đa của bảng xếp hạng
- Bảng xếp hạng có thể sắp xếp "cao là tốt" hoặc "thấp là tốt" (vd: thời gian hoàn thành) – do admin cấu hình
- Người chơi chưa kết nối ví vẫn chơi được, nhưng điểm không được lưu (`canSubmitScore: false`)

## 7. Giao thức (cho ai muốn tự viết SDK)

Mọi tin nhắn có dạng `{ source: "gamehub", v: 1, type, payload }`.

| Chiều | `type` | `payload` |
|---|---|---|
| game → hub | `READY` | `{ sdkVersion }` |
| hub → game | `INIT` | dữ liệu init ở trên |
| game → hub | `GAME_START` | `{}` |
| game → hub | `GAME_OVER` | `{ score, leaderboard }` |
| game → hub | `AD_REQUEST` | `{ requestId, kind: "rewarded" \| "interstitial" }` |
| hub → game | `AD_RESULT` | `{ requestId, shown, rewarded, reason? }` |
| hub → game | `PAUSE` / `RESUME` | `{}` |

Phiên bản giao thức tăng khi có thay đổi không tương thích; hub tiếp tục hỗ trợ game dùng phiên bản cũ.
