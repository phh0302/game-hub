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
| `GameHub.track(name, props?)` | Ghi 1 sự kiện (qua màn, mua đồ, xem quảng cáo…) | Gom lại gửi sau 5 giây – xem [Sự kiện game](#su-kien-game) |
| `GameHub.flush()` | Muốn gửi ngay các sự kiện đang chờ | `Promise<{ sent }>` |
| `GameHub.showRewardedAd()` | Người chơi chọn xem quảng cáo để nhận thưởng | `Promise<{ shown, rewarded, reason? }>` – **chỉ thưởng khi `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Giữa các màn | `Promise<{ shown }>` |
| `GameHub.share({ text?, score? })` | Người chơi bấm "Khoe điểm" / "Chia sẻ" | `Promise<{ shared, method, reason? }>` – xem [Chia sẻ & mời bạn](#chia-se) |
| `GameHub.invite({ text? })` | Người chơi bấm "Mời bạn" | `Promise<{ shared, method, reason? }>` |
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
  canSubmitScore: true,   // false = người chơi chưa kết nối ví, điểm sẽ không được lưu
  ads: { rewarded: false, interstitial: false }, // loại quảng cáo đang có – false thì ẩn nút "xem quảng cáo"
  social: { share: true, invite: true },        // có bảng chia sẻ / mời bạn không – false thì ẩn nút
  invites: { count: 3, viaGame: 1, invitedBy: "minh" } | null // bạn đã mời (tổng / qua game này), ai mời mình; null = chưa kết nối ví
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
- [Chạy ngoài hub](/ngoai-hub) (chế độ độc lập): người chơi đã `login()` (ví hoặc khách) → lưu **theo tài khoản** như trên hub (`GET/POST /api/p1/state`); chưa login → `localStorage` của trang, được chuyển lên tài khoản ở lần `loadState()` đầu tiên sau khi login.
- Mở file trực tiếp (không qua hub, không `projectKey`): `localStorage` của trang.

| `code` khi `saved: false` | Nghĩa |
| --- | --- |
| `STATE_TOO_LARGE` | Dữ liệu > 64KB |
| `STATE_INVALID` | Không chuyển được sang JSON (vd có vòng lặp tham chiếu) |
| `STORAGE_UNAVAILABLE` | Trình duyệt chặn lưu trữ (chế độ ẩn danh nghiêm ngặt, hết dung lượng) |
| `SYNC_FAILED` | Đi kèm `saved: true`: đã lưu trong trình duyệt nhưng chưa lên được máy chủ (mất mạng) – lần lưu sau sẽ đồng bộ |
| `TIMEOUT` | Hub không trả lời trong 5 giây |

## Sự kiện game (track) {#su-kien-game}

Đếm hành vi người chơi trong game – không cần thư viện analytics riêng (Google Analytics, Amplitude… dùng cookie / localStorage nên **không chạy được** trong khung cách ly của hub).

```js
GameHub.track("level_complete", { level: 3, mode: "normal" });
GameHub.track("revive_offer_shown");
GameHub.track("ad_rewarded");
```

- **Tên:** chữ, số và `_ . : -`, tối đa 64 ký tự (vd `level_complete`, `shop:buy`). Tên sai → cảnh báo trong console, bỏ qua.
- **props** (không bắt buộc): tối đa 10 khóa; giá trị chuỗi (≤ 100 ký tự), số hoặc `true`/`false`. Kiểu khác bị bỏ.
- SDK gom sự kiện và gửi **sau 5 giây / mỗi 20 sự kiện / khi rời trang**; `GameHub.flush()` gửi ngay.
- Xem ở trang **Developer → game → Sự kiện game**: tổng mỗi ngày (theo giờ UTC), tổng theo tên trong 7 / 30 ngày, 50 sự kiện gần nhất kèm props để kiểm tra tích hợp. Giữ 95 ngày.
- Chạy cả trên hub và [ngoài hub](/ngoai-hub). Trang **Chơi thử** chỉ hiện trong nhật ký SDK, không tính vào thống kê. Mở file trực tiếp: chỉ in ra console.
- Không gửi thông tin cá nhân (email, số điện thoại, địa chỉ ví) trong props.
- Giới hạn chống lạm dụng: 200 tên sự kiện khác nhau và 200.000 sự kiện mỗi game mỗi ngày.

## Chia sẻ & mời bạn {#chia-se}

Thêm 23/11/2026, có sẵn trong `/sdk/v3/`.

```js
// Màn hết ván: nút "Khoe điểm"
shareBtn.onclick = () => GameHub.share({ score: lastScore, text: `Mình được ${lastScore} điểm, vào thách đấu nào!` });
// Nút "Mời bạn"
inviteBtn.onclick = () => GameHub.invite();
// Ẩn nút khi không hỗ trợ (hub cũ / trình duyệt không chia sẻ được)
GameHub.on("init", (hub) => { shareBtn.hidden = !hub.social.share; inviteBtn.hidden = !hub.social.invite; });
```

- **Trên hub:** mở bảng chia sẻ của hub đè lên game (vẫn thấy khi toàn màn hình): copy link, Facebook, X, Telegram, và "Chia sẻ qua…" (Zalo, Messenger… trên điện thoại). Link là trang game kèm **mã mời** của người chơi (`?ref=…`); có `score` thì thêm `?score=` để ảnh xem trước hiện *"Mình đạt X điểm"*.
- **Mời bạn:** bạn bè **kết nối ví lần đầu** qua link (trong 30 ngày) được tính cho người mời. Số bạn đã mời có trong `init.invites` – game có thể tặng thưởng (ví dụ mời 3 bạn mở skin) và hiện *"Được {invitedBy} mời"* cho người mới.
- **Kết quả:** `{ shared: true, method: "copy" | "native" | "facebook" | "x" | "telegram" }` khi người chơi đã chia sẻ / copy; đóng bảng → `shared: false`. `reason: "UNSUPPORTED"` = hub cũ hoặc trình duyệt không hỗ trợ.
- **Ngoài hub** (mở file trực tiếp, [game trên domain riêng](/ngoai-hub)): dùng bảng chia sẻ của máy, không có thì copy link trang hiện tại; chưa tính lượt mời.
- Gọi từ **thao tác của người chơi** (bấm nút) – trình duyệt chặn chia sẻ / copy tự động. Chữ `text` tối đa 200 ký tự.

Giao thức: game gửi `SHARE { requestId, text?, score? }` / `INVITE { requestId, text? }`, hub trả `SHARE_RESULT { requestId, shared, method }` khi đóng bảng.

## Quảng cáo

Hiện Game Hub **chưa bật quảng cáo** – dữ liệu `init` có `ads: { rewarded: false, interstitial: false }`, nên **ẩn nút "xem quảng cáo nhận thưởng" khi `hub.ads.rewarded` là `false`** (đừng hiện lời mời rồi để người chơi bấm mà không có gì). Gọi thử vẫn an toàn: `showRewardedAd()` trả về `{ shown: false, rewarded: false }`, `showInterstitialAd()` trả về `{ shown: false }`. Hãy thiết kế để game vẫn chơi bình thường khi không có quảng cáo – ví dụ ẩn nút "Xem quảng cáo nhận thưởng" khi `shown` là `false`.

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
