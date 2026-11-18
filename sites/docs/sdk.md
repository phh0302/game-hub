# Game Hub SDK

SDK là một file JavaScript nhỏ giúp game nói chuyện với hub: nhận ngôn ngữ và thông tin người chơi, báo đầu/cuối ván để lưu điểm.

## Nhúng SDK

```html
<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script>
```

Dùng **đường dẫn đầy đủ** như trên – bản build của bạn được phục vụ từ tên miền khác hub. SDK tạo biến toàn cục `window.GameHub`.

### Phiên bản SDK {#phien-ban}

| Đường dẫn | Dùng khi |
| --- | --- |
| `/sdk/v3/gamehub-sdk.js` | **Khuyên dùng.** Cố định bản chính v3: chỉ nhận sửa lỗi và tính năng thêm vào, không bao giờ có thay đổi phá vỡ |
| `/sdk/v2/…`, `/sdk/v1/…` | Game cũ muốn giữ đúng hành vi đã thử (bản đóng băng, không cập nhật) |
| `/sdk/gamehub-sdk.js` | Luôn là bản chính mới nhất – khi có v4 sẽ đổi theo. Chỉ nên dùng khi đang thử nghiệm |

Thay đổi phá vỡ tương thích chỉ ra ở **bản chính mới** (`/sdk/v4/`), kèm hướng dẫn chuyển trong [Lịch sử SDK](/changelog). Game đang chạy với `/sdk/v3/` không bị ảnh hưởng. `GameHub.version` cho biết bản đang chạy.

## Các hàm

| Hàm | Gọi khi nào | Kết quả |
| --- | --- | --- |
| `GameHub.init()` | 1 lần khi game tải xong | `Promise<{ locale, player, canSubmitScore, standalone }>` |
| `GameHub.gameStart()` | Bắt đầu 1 ván mới – nên gọi ở **thao tác đầu tiên** của người chơi | Hub bắt đầu tính giờ ván chơi |
| `GameHub.gameOver(score, { leaderboard })` | Ván kết thúc | Hub nộp điểm lên bảng `leaderboard` (mặc định `"default"`) → `Promise<kết quả>` (giống [`scoreResult`](#du-lieu-scoreresult)) |
| `GameHub.saveState(data)` | Lưu tiến trình (màn, vật phẩm, cài đặt) | `Promise<{ saved, code }>` – xem [Lưu tiến trình](#luu-tien-trinh) |
| `GameHub.loadState()` | Lúc tải game | `Promise<data \| null>` |
| `GameHub.showRewardedAd()` | Người chơi chọn xem quảng cáo để nhận thưởng | `Promise<{ shown, rewarded, reason? }>` – **chỉ thưởng khi `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Giữa các màn | `Promise<{ shown }>` |
| `GameHub.on(event, callback)` | Lắng nghe hub | Xem [Sự kiện](#su-kien) |

### Điểm gửi lên `gameOver(score)` {#diem-gui-len}

SDK chuẩn hóa điểm trước khi gửi: `Math.max(0, Math.floor(Number(score) || 0))` – làm tròn xuống, số âm thành 0. Nếu `score` **không phải số** (`NaN`, `undefined`, `"abc"`…) SDK in cảnh báo trong console và **nộp 0 điểm** chứ không báo lỗi – nên mã `SCORE_INVALID` gần như chỉ xuất hiện khi điểm vượt khoảng cho phép của bảng. Hãy chắc chắn biến điểm luôn là số.

### Kết quả `gameOver()` {#ket-qua-gameover}

Từ **SDK v3**, `gameOver()` trả về `Promise` kết quả ở mọi chế độ (trên hub, chơi thử, mở file trực tiếp, [ngoài hub](/ngoai-hub)) và đồng thời phát sự kiện `scoreResult`. Cách khuyên dùng là xử lý trong **sự kiện** – chạy được với mọi phiên bản hub:

```js
GameHub.on("scoreResult", (r) => showResult(r.message, r.saved));
GameHub.gameOver(score);              // không cần await
// hoặc: const r = await GameHub.gameOver(score);
```

Không nhận được trả lời của hub sau 20 giây → `{ saved: false, code: "TIMEOUT" }`. Mở file trực tiếp (không qua hub) → `code: "STANDALONE"`.

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

`init()` chờ hub tối đa **3 giây**; quá hạn thì trả `standalone: true`. Hub vẫn gửi `INIT` sau đó (máy chậm, mạng chậm) qua sự kiện `init` – vì vậy **luôn đăng ký `GameHub.on("init", …)`** với cùng hàm xử lý.

Khi `canSubmitScore` là `false`, nên hiện một dòng nhắc nhỏ kiểu *"Kết nối ví trên Game Hub để lưu điểm"* – game vẫn chơi bình thường.

## Sự kiện {#su-kien}

| Sự kiện | Khi nào |
| --- | --- |
| `init` | Gửi lại khi người chơi đăng nhập ví hoặc đổi ngôn ngữ trong lúc đang ở trang game – cập nhật chữ và dòng nhắc lưu điểm |
| `scoreResult` | Sau `gameOver()`: kết quả lưu điểm |
| `pause` / `resume` | Hub yêu cầu tạm dừng / chơi tiếp (dành cho quảng cáo xen giữa) |

### Dữ liệu `scoreResult` {#du-lieu-scoreresult}

```js
{
  saved: true,              // false = điểm KHÔNG được ghi nhận
  code: null,               // khi saved = false: mã lỗi, xem Bảng xếp hạng → Mã lỗi
  message: "Kỷ lục mới: 1.696 điểm! Bạn đang hạng #3",  // đã dịch theo ngôn ngữ người chơi
  score: 1696, best: 1696, rank: 3, isNewBest: true      // chỉ có khi saved = true; score là SỐ
}
```

::: tip Luôn hiện `message` cho người chơi
Đặc biệt khi `saved: false` – đừng để người chơi tưởng điểm đã được lưu. Danh sách mã lỗi ở [Bảng xếp hạng & chống gian lận](/bang-xep-hang#ma-loi).
:::

## Lưu tiến trình {#luu-tien-trinh}

Trên hub game chạy trong khung cách ly nên **`localStorage` / IndexedDB / cookie luôn lỗi** ([vì sao](/moi-truong#luu-du-lieu)). Dùng 2 hàm của SDK:

```js
// Lúc tải game
const save = (await GameHub.loadState()) ?? { level: 1, coins: 0, sound: true };

// Khi có tiến trình mới (qua màn, mua đồ, đổi cài đặt)
save.level = 2;
const r = await GameHub.saveState(save);   // { saved: true, code: null }
```

- `data` là giá trị JSON bất kỳ (object, mảng, số, chuỗi), tối đa **64KB** (UTF-8) sau khi `JSON.stringify`. Mỗi lần lưu **ghi đè** bản trước.
- **Người chơi đã kết nối ví:** hub lưu **theo tài khoản** trên máy chủ (kèm bản sao trong trình duyệt) → đổi máy, đổi trình duyệt vẫn còn. Tiến trình chơi lúc **chưa kết nối ví** trên máy đó được chuyển sang tài khoản ở lần `loadState()` đầu tiên sau khi kết nối (nếu tài khoản chưa có bản lưu của game).
- **Khách (chưa kết nối ví):** lưu trong trình duyệt, mỗi game 1 ô riêng; xóa dữ liệu trình duyệt là mất.
- Hai máy cùng lưu thì bản lưu **sau cùng thắng** – nếu cần, tự gộp dữ liệu trong game trước khi `saveState()`.
- Trang **Chơi thử** dùng ô riêng theo từng bản build, không đè tiến trình thật.
- Mở file trực tiếp hoặc [chạy ngoài hub](/ngoai-hub): lưu vào `localStorage` của trang.

| `code` khi `saved: false` | Nghĩa |
| --- | --- |
| `STATE_TOO_LARGE` | Dữ liệu > 64KB |
| `STATE_INVALID` | Không chuyển được sang JSON (vd có vòng lặp tham chiếu) |
| `STORAGE_UNAVAILABLE` | Trình duyệt chặn lưu trữ (chế độ ẩn danh nghiêm ngặt, hết dung lượng) |
| `SYNC_FAILED` | Đi kèm `saved: true`: đã lưu trong trình duyệt nhưng chưa lên được máy chủ (mất mạng) – lần lưu sau sẽ đồng bộ |
| `TIMEOUT` | Hub không trả lời trong 5 giây |

## Quảng cáo

Hiện Game Hub **chưa bật quảng cáo**: `showRewardedAd()` trả về `{ shown: false, rewarded: false }`, `showInterstitialAd()` trả về `{ shown: false }`. Hãy thiết kế để game vẫn chơi bình thường khi không có quảng cáo – ví dụ ẩn nút "Xem quảng cáo nhận thưởng" khi `shown` là `false`.

Nếu hub không trả lời (vd game được nhúng ở trang khác), hai hàm quảng cáo chờ tối đa **60 giây** rồi trả về `{ shown: false, rewarded: false, reason: "TIMEOUT" }` – đừng khóa giao diện trong lúc chờ. Mở file trực tiếp thì trả về ngay với `reason: "STANDALONE"`.

## Ví dụ đầy đủ

```html
<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script>
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
  GameHub.on("resume", () => resumeGame()); // luôn xử lý cặp pause / resume

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
