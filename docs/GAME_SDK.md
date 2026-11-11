# Game Hub SDK v1 – Hướng dẫn tích hợp game

> **Bản chính thức cho developer: https://docs.monlabs.fun** (mã nguồn ở `sites/docs`).
> Khi sửa hướng dẫn, sửa ở `sites/docs` trước; file này giữ làm ghi chú kỹ thuật nội bộ.

Tài liệu cho developer muốn đưa game HTML5 lên Game Hub.

## 1. Đăng game lên hub

1. Kết nối ví → menu góc phải → **Developer** → tạo studio
2. **Tạo game mới**: tên (Việt/Anh), mô tả, thể loại → vào trang game, upload **ảnh bìa** (PNG/JPG/WEBP ≤ 1MB, tỉ lệ 16:9)
3. **Upload phiên bản**: đặt tên phiên bản (vd `1.0.0`), chọn file `.zip` → hub kiểm tra + giải nén → phiên bản **Chờ duyệt**
4. Bấm **Chơi thử** để chạy bản build y như trên hub (điểm không lưu) và xem **nhật ký SDK** – kiểm tra đủ 3 dấu ✓
5. Admin chơi thử → **Duyệt** → game lên hub. Bị từ chối thì lý do hiện ngay dưới phiên bản – sửa rồi upload phiên bản mới

### Yêu cầu file `.zip`

- Tối đa **50MB**, sau khi giải nén tối đa **150MB** và **2000 file**
- Có `index.html` ở gốc – hoặc trong **đúng 1 thư mục** bao ngoài (hub tự bỏ thư mục đó)
- Mọi đường dẫn tài nguyên trong game là **đường dẫn tương đối** (`./img/a.png`, không dùng `/img/a.png`)
- Chỉ file web: `html js mjs css json map txt xml csv`, ảnh `png jpg gif webp avif svg ico bmp`,
  âm thanh/video `mp3 ogg wav m4a aac mp4 webm`, font `woff woff2 ttf otf`,
  engine `wasm data bin unityweb pck atlas fnt plist tmx tsx glb gltf`, và bản nén sẵn `.br` / `.gz` của các file trên. File khác (`exe`, `php`, `sh`…) bị từ chối
- **Unity WebGL**: Compression Format **Brotli**, **Gzip** hay **Disabled** đều được. File nén sẵn `.br` / `.gz`
  (vd `Build/game.wasm.br`) được hub **giải nén lúc upload** và phục vụ đúng tên cũ – không cần cấu hình server.
  Không cần bật *Decompression Fallback*. File bên trong phải thuộc danh sách đuôi được phép; không nén 2 lớp
- Giới hạn 150MB tính theo dung lượng **sau khi giải nén** cả file `.br` / `.gz`
- Không cần server riêng: game chạy hoàn toàn trên trình duyệt
- File rác (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) được tự bỏ qua

## 2. Môi trường chạy

Hub nhúng game trong `iframe` có `sandbox="allow-scripts allow-pointer-lock"`:

- Game **không đọc được** cookie, trang hay dữ liệu đăng nhập của hub
- `localStorage` / `sessionStorage` có thể bị chặn → luôn bọc `try/catch`
- Không mở popup, không điều hướng trang cha, không gửi form
- Mọi giao tiếp với hub đi qua SDK (`postMessage`)

## 3. Nhúng SDK

```html
<!-- Dùng ĐƯỜNG DẪN ĐẦY ĐỦ tới hub: bản build được phục vụ từ kho lưu trữ (domain khác hub) -->
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
<!-- Hub chạy trên máy (localhost): <script src="http://localhost:3000/sdk/gamehub-sdk.js"></script> -->
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
| `GameHub.on("scoreResult", cb)` | Sau `gameOver()` | Kết quả lưu điểm – **nên hiển thị `message` cho người chơi** (xem bên dưới) |
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

Dữ liệu `scoreResult`:

```js
{
  saved: true,              // false = điểm KHÔNG được ghi nhận
  code: null,               // khi saved = false: "PLAY_TOO_SHORT", "SCORE_TOO_FAST", "SCORE_INVALID",
                            // "NOT_SIGNED_IN", "STARTED_BEFORE_LOGIN", "SESSION_NOT_STARTED", ...
  message: "Kỷ lục mới: 1.696 điểm! Bạn đang hạng #3",  // đã dịch theo ngôn ngữ người chơi
  score: 1696, best: 1696, rank: 3, isNewBest: true      // chỉ có khi saved = true
}
```

> Luôn cho người chơi thấy `message`, đặc biệt khi `saved: false` – đừng để họ tưởng điểm đã được lưu.

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

Game mẫu đầy đủ (song ngữ, bàn phím + vuốt/chạm) trong `public/uploads/games/`:

| Game | Kiểu | Điểm |
|---|---|---|
| `2048/1.0.0` | DOM, lưới | điểm cộng dồn |
| `snake/1.0.0` | Canvas, vòng lặp theo nhịp | 10 điểm/mồi, xử lý `pause` |
| `neon-flap/1.0.0` | Canvas, vật lý bước cố định | số cột vượt qua, xử lý `pause`/`resume` |
| `memory/1.0.0` | DOM, lật thẻ | thời gian hoàn thành (ms), bảng "thấp là tốt" |

## 6. Quy tắc tính điểm

- Mỗi `gameStart()` → hub tạo 1 lượt chơi; mỗi lượt chơi chỉ nộp điểm **1 lần**
- Thời gian chơi tính từ `gameStart()` đến lúc hub nhận `gameOver()` – do **server** đo, game không sửa được
- Điểm bị từ chối nếu: chơi ngắn hơn thời gian tối thiểu, lượt chơi mở quá số giờ tối đa, ngoài khoảng điểm cho phép,
  hoặc **ghi điểm nhanh bất thường** (điểm ÷ số giây chơi > `maxScorePerSecond` của bảng xếp hạng)
- Ván bị từ chối là kết thúc luôn – không nộp lại được cùng lượt chơi
- Game nên gọi `gameStart()` ở **thao tác đầu tiên** của người chơi (không phải lúc tải trang) để thời gian tính đúng
- Bảng xếp hạng có thể sắp xếp "cao là tốt" hoặc "thấp là tốt" (vd: thời gian hoàn thành) – do admin cấu hình
- **Game tính theo thời gian**: gửi `GameHub.gameOver(soMiliGiay)` (vd 42700 = 42,7 giây). Admin đặt bảng xếp hạng
  `order: ASC` + `format: "duration_ms"` → hub hiện điểm dạng `0:42,7`; thêm `timedScoreSlackSeconds` để từ chối
  thời gian ngắn hơn thời gian server đo được (chống gửi thời gian giả). Ví dụ: game `memory`
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
| hub → game | `SCORE_RESULT` | `{ saved, code, message, score?, best?, rank?, isNewBest? }` |
| hub → game | `AD_RESULT` | `{ requestId, shown, rewarded, reason? }` |
| hub → game | `PAUSE` / `RESUME` | `{}` |

Phiên bản giao thức tăng khi có thay đổi không tương thích; hub tiếp tục hỗ trợ game dùng phiên bản cũ.
