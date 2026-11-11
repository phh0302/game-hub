# Game Hub SDK

SDK là một file JavaScript nhỏ giúp game nói chuyện với hub: nhận ngôn ngữ và thông tin người chơi, báo đầu/cuối ván để lưu điểm.

## Nhúng SDK

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
```

Dùng **đường dẫn đầy đủ** như trên – bản build của bạn được phục vụ từ tên miền khác hub. SDK tạo biến toàn cục `window.GameHub`.

## Các hàm

| Hàm | Gọi khi nào | Kết quả |
| --- | --- | --- |
| `GameHub.init()` | 1 lần khi game tải xong | `Promise<{ locale, player, canSubmitScore, standalone }>` |
| `GameHub.gameStart()` | Bắt đầu 1 ván mới – nên gọi ở **thao tác đầu tiên** của người chơi | Hub bắt đầu tính giờ ván chơi |
| `GameHub.gameOver(score, { leaderboard })` | Ván kết thúc | Hub nộp điểm (số nguyên ≥ 0) lên bảng xếp hạng `leaderboard` (mặc định `"default"`) |
| `GameHub.showRewardedAd()` | Người chơi chọn xem quảng cáo để nhận thưởng | `Promise<{ shown, rewarded, reason? }>` – **chỉ thưởng khi `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Giữa các màn | `Promise<{ shown }>` |
| `GameHub.on(event, callback)` | Lắng nghe hub | Xem [Sự kiện](#su-kien) |

### Dữ liệu `init`

```js
{
  protocolVersion: 1,
  standalone: false,      // true khi mở game trực tiếp, không qua hub
  locale: "vi",           // "vi" | "en"
  player: { displayName: "ha_pham" } | null,
  canSubmitScore: true    // false = người chơi chưa kết nối ví, điểm sẽ không được lưu
}
```

Khi `canSubmitScore` là `false`, nên hiện một dòng nhắc nhỏ kiểu *"Kết nối ví trên Game Hub để lưu điểm"* – game vẫn chơi bình thường.

## Sự kiện {#su-kien}

| Sự kiện | Khi nào |
| --- | --- |
| `init` | Gửi lại khi người chơi đăng nhập ví hoặc đổi ngôn ngữ trong lúc đang ở trang game – cập nhật chữ và dòng nhắc lưu điểm |
| `scoreResult` | Sau `gameOver()`: kết quả lưu điểm |
| `pause` / `resume` | Hub yêu cầu tạm dừng / chơi tiếp (dành cho quảng cáo xen giữa) |

### Dữ liệu `scoreResult`

```js
{
  saved: true,              // false = điểm KHÔNG được ghi nhận
  code: null,               // khi saved = false: mã lỗi, xem trang Bảng xếp hạng
  message: "Kỷ lục mới: 1.696 điểm! Bạn đang hạng #3",  // đã dịch theo ngôn ngữ người chơi
  score: 1696, best: 1696, rank: 3, isNewBest: true      // chỉ có khi saved = true
}
```

::: tip Luôn hiện `message` cho người chơi
Đặc biệt khi `saved: false` – đừng để người chơi tưởng điểm đã được lưu. Danh sách mã lỗi ở [Bảng xếp hạng & chống gian lận](/bang-xep-hang#ma-loi).
:::

## Quảng cáo

Hiện Game Hub **chưa bật quảng cáo**: `showRewardedAd()` trả về `{ shown: false, rewarded: false }`, `showInterstitialAd()` trả về `{ shown: false }`. Hãy thiết kế để game vẫn chơi bình thường khi không có quảng cáo – ví dụ ẩn nút "Xem quảng cáo nhận thưởng" khi `shown` là `false`.

## Ví dụ đầy đủ

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
<script>
  let score = 0;
  let playing = false;
  const note = document.getElementById("save-note");
  const result = document.getElementById("result");

  function applyHub(hub) {
    document.documentElement.lang = hub.locale;
    note.hidden = hub.standalone || hub.canSubmitScore;
  }

  GameHub.init().then(applyHub);
  GameHub.on("init", applyHub); // đăng nhập / đổi ngôn ngữ giữa chừng
  GameHub.on("scoreResult", (r) => {
    result.textContent = r.message;
    result.className = r.saved ? "ok" : "error";
  });
  GameHub.on("pause", () => pauseGame());

  function onFirstInput() {
    if (!playing) {
      playing = true;
      score = 0;
      GameHub.gameStart();
    }
  }

  function onGameOver() {
    playing = false;
    GameHub.gameOver(score);
  }
</script>
```

## Thử trước khi gửi duyệt {#thu-truoc-khi-gui-duyet}

Sau khi upload, bấm **Chơi thử** ở trang phiên bản: game chạy y như trên hub (điểm không lưu) và có **nhật ký SDK** hiện từng tin nhắn game gửi. Mục **Kiểm tra tích hợp SDK** phải đủ 3 dấu ✓ trước khi chờ duyệt: game gọi `GameHub.init()`, gọi `gameStart()` khi bắt đầu ván, gọi `gameOver(score)` khi hết ván.
