# Dùng ngoài Game Hub (Platform API)

Game của bạn chạy trên **trang web riêng** vẫn dùng được hạ tầng của Monlabs: đăng nhập bằng ví MetaMask, chơi khách, bảng xếp hạng chống gian lận và giải đấu. Bảng xếp hạng dùng chung với bản game trên Game Hub (nếu có).

Xem thử game mẫu: [play.monlabs.fun/demo/index.html](https://play.monlabs.fun/demo/index.html) (cần `?key=` của một project).

## Bắt đầu trong 5 bước

1. Tạo studio và game trên [trang Developer](https://play.monlabs.fun/developer) như bình thường ([Studio & duyệt game](/studio)). Game không cần upload bản build hay chờ duyệt nếu chỉ chạy trên domain riêng.
2. Trong trang game → mục **Platform API**, khai báo **domain** của game, mỗi dòng 1 domain, dạng `https://mygame.io`. Khi phát triển trên máy, thêm `http://localhost:5173` (http chỉ dùng được cho localhost).
3. Bấm **Tạo key** → sao chép **publishable key** `pk_live_…` (chỉ hiện 1 lần).
4. Nhúng SDK và gọi `init` kèm key:

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
<script>
  const hub = await GameHub.init({ projectKey: "pk_live_…" });
  // hub.player = null nếu chưa đăng nhập; hub.project.name, hub.project.leaderboards
</script>
```

5. Cho người chơi đăng nhập rồi chơi:

```js
await GameHub.login();                  // ví MetaMask – ký thông điệp ghi đúng domain của game
// hoặc: await GameHub.login({ guest: true });   // chơi khách, không cần ví

GameHub.gameStart();                    // bắt đầu ván – máy chủ bắt đầu tính giờ
const result = await GameHub.gameOver(score);
// { saved, code, message, score, best, rank, isNewBest, tournaments }

const top = await GameHub.leaderboard({ period: "week", limit: 10 });
// { leaderboard, entries: [{ rank, displayName, score, … }], me }
```

::: tip Publishable key là công khai
Đặt thẳng trong mã game cũng được: key **chỉ hoạt động trên các domain bạn đã khai báo**. Bị lộ key thì vào trang game **Thu hồi** rồi tạo key mới.
:::

## Hàm của SDK ở chế độ độc lập

| Hàm | Kết quả |
| --- | --- |
| `GameHub.init({ projectKey, apiBase?, locale? })` | `Promise<{ mode: "project", project, player, canSubmitScore, locale }>` |
| `GameHub.login()` / `GameHub.login({ guest: true })` | `Promise<player>` – lưu token trong trình duyệt, lần sau tự đăng nhập |
| `GameHub.logout()` | Thu hồi token ngay trên máy chủ |
| `GameHub.me()` | `Promise<{ player, best } \| null>` |
| `GameHub.gameStart()` | Mở 1 lượt chơi |
| `GameHub.gameOver(score, { leaderboard? })` | `Promise<{ saved, code, message, … }>` – cũng phát sự kiện `scoreResult` |
| `GameHub.leaderboard({ board?, period?, limit? })` | Top người chơi + hạng của bạn (`me`) |
| `GameHub.leaderboards()` | Bảng chính + các [giải đấu](/bang-xep-hang#giai-dau) đang hiển thị |
| `GameHub.on("init", cb)` | Gọi lại khi người chơi đăng nhập / đăng xuất |

Không truyền `projectKey` thì SDK chạy **chế độ hub** như cũ (game nằm trong Game Hub) – một bản build dùng được cho cả hai nơi.

## Chống gian lận

Giống hệt khi chơi trên hub ([chi tiết](/bang-xep-hang)): máy chủ tự đo thời gian từ `gameStart()` đến `gameOver()`, từ chối ván quá ngắn, điểm ngoài ngưỡng, tốc độ ghi điểm bất thường; mỗi lượt nộp được 1 lần. Mã lỗi nằm trong `result.code`, câu giải thích theo ngôn ngữ người chơi nằm trong `result.message`.

## Client API (gọi thẳng, không dùng SDK)

Mọi request gửi tới `https://play.monlabs.fun/api/p1/…` kèm header `x-gamehub-key: pk_live_…`; request cần người chơi thêm `Authorization: Bearer <token>`. Trình duyệt phải gửi từ domain đã khai báo (header `Origin`).

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/project` | Tên game, bảng xếp hạng, cách đăng nhập |
| POST | `/auth/nonce` | `{ address, chainId }` → `{ message }` để ví ký |
| POST | `/auth/verify` | `{ message, signature }` → `{ token, player }` |
| POST | `/auth/guest` | → `{ token, player }` (tối đa 10 tài khoản khách / giờ / IP) |
| POST | `/auth/logout` | Thu hồi token |
| GET | `/me` | Người chơi + điểm tốt nhất ở bảng chính |
| POST | `/sessions` | → `{ sessionId }` |
| POST | `/scores` | `{ sessionId, score, leaderboard? }` |
| GET | `/leaderboards` | Bảng chính + giải đấu |
| GET | `/leaderboard?board=&period=&limit=` | Top người chơi (+ `me` nếu có token) |

Mã lỗi riêng của Client API: `INVALID_API_KEY` (key sai / đã thu hồi), `ORIGIN_NOT_ALLOWED` (domain chưa khai báo), `PROJECT_DISABLED` (game bị khóa), `PLAYER_UNAUTHORIZED` (chưa đăng nhập / token hết hạn), `RATE_LIMITED`.
