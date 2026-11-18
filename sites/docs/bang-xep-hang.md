# Bảng xếp hạng & chống gian lận

Điểm do game gửi, nhưng **thời gian chơi do máy chủ đo** – game không sửa được. Mỗi game có một bảng xếp hạng mặc định (`"default"`); admin có thể tạo thêm bảng khác cho cùng game.

## Một ván chơi được tính thế nào

1. Game gọi `gameStart()` → hub mở **1 lượt chơi** trên máy chủ và bắt đầu tính giờ
2. Game gọi `gameOver(score)` → hub nộp điểm của lượt chơi đó; máy chủ tính thời gian chơi từ lúc mở lượt
3. Máy chủ kiểm tra điểm theo luật của bảng xếp hạng (bên dưới) rồi lưu hoặc từ chối
4. Hub gửi lại `scoreResult` cho game và hiện thông báo cho người chơi

Mỗi lượt chơi chỉ nộp điểm **1 lần**. Ván bị từ chối là kết thúc luôn – không nộp lại được cùng lượt.

::: warning Gọi `gameStart()` ở thao tác đầu tiên
Không gọi lúc tải trang. Nếu người chơi mở game rồi để đó vài phút, thời gian chơi sẽ bị tính sai và có thể vượt giới hạn.
:::

## Luật của bảng xếp hạng {#luat}

Admin đặt các luật này cho từng game, theo cách chơi thật của game:

| Luật | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| Thời gian chơi tối thiểu | Ván ngắn hơn bị từ chối | 2048: 5 giây |
| Thời gian lượt chơi tối đa | Lượt mở quá lâu bị hết hạn | Mặc định 6 giờ |
| Khoảng điểm cho phép | Điểm ngoài `minScore`–`maxScore` bị từ chối | Rắn săn mồi: tối đa 4.000 |
| Tốc độ ghi điểm tối đa | Điểm ÷ số giây chơi lớn hơn mức này bị từ chối | Neon Flap: 1,5 điểm/giây |
| Thứ tự | "Cao là tốt" hoặc "thấp là tốt" | Lật thẻ: thấp là tốt |

Khi gửi game duyệt, hãy ghi vào **ghi chú phiên bản** điểm tối đa có thể đạt và tốc độ ghi điểm nhanh nhất của người chơi giỏi, để admin đặt luật vừa khít.

**Xem luật của game bạn:** trang Developer → game → mục **Luật chấm điểm** (chỉ xem): thời gian chơi tối thiểu, lượt chơi dài tối đa, và từng bảng với khoảng điểm, tốc độ tối đa, thứ tự, thời gian mở. Luật đặt sai làm điểm thật bị từ chối (`SCORE_INVALID`, `SCORE_TOO_FAST`, `PLAY_TOO_SHORT`) – thấy không khớp thì báo admin.

## Game tính theo thời gian

Với game "ai xong nhanh nhất thắng", gửi **số mili-giây** hoàn thành:

```js
const startedAt = performance.now();
GameHub.gameStart();
// … người chơi hoàn thành …
GameHub.gameOver(Math.round(performance.now() - startedAt)); // vd 42700 = 42,7 giây
```

Admin đặt bảng ở chế độ "thấp là tốt" và hiển thị dạng thời gian → hub hiện `0:42,7` thay vì `42.700 điểm`. Máy chủ cũng từ chối thời gian **ngắn hơn** thời gian nó đo được quá vài giây, nên không gửi được thời gian giả.

## Giải đấu {#giai-dau}

Admin có thể mở **giải đấu có thời hạn** cho game của bạn (vd "Giải Tết 2027", từ 20/1 đến 5/2) trong trang quản trị. Có 2 loại:

- **Giải đấu nhận điểm từ bảng chính** (thường dùng): mọi điểm hợp lệ người chơi đạt ở bảng `default` trong thời gian giải sẽ tự vào bảng giải. **Bạn không phải sửa gì trong game.** Thứ tự, cách hiển thị và luật chống gian lận lấy theo bảng chính.
- **Bảng riêng**: điểm chỉ vào bảng này khi game gửi đúng mã bảng, vd `GameHub.gameOver(score, { leaderboard: "che-do-kho" })`. Hợp với chế độ chơi khác (màn khó, thử thách hằng ngày…). Admin sẽ báo bạn mã bảng.

Trên trang game, người chơi thấy nút chuyển giữa bảng chính và các giải từ 14 ngày trước khi giải bắt đầu đến 30 ngày sau khi kết thúc. Khi điểm vào giải, hub tự báo thêm "Giải đang diễn ra: hạng #N".

## Người chơi chưa kết nối ví

Vẫn chơi được bình thường, nhưng điểm không lưu: `init` trả về `canSubmitScore: false`, và `scoreResult` trả về `saved: false` với mã `NOT_SIGNED_IN`. Nếu người chơi kết nối ví **giữa ván**, ván đó vẫn không được lưu (mã `STARTED_BEFORE_LOGIN`) – ván sau mới được tính.

## Mã lỗi {#ma-loi}

Khi `scoreResult.saved` là `false`, trường `code` cho biết lý do. `message` đã có câu giải thích theo ngôn ngữ người chơi – game chỉ cần hiện ra. Cột **Chế độ**: *Hub* = game chạy trong Game Hub, *Độc lập* = [chạy ngoài hub](/ngoai-hub) bằng `projectKey`.

::: tip Đừng viết logic theo từng mã
Một số tình huống có **mã khác nhau ở hai chế độ** (vd chưa đăng nhập). Để một bản build chạy đúng ở cả hai nơi, chỉ cần dựa vào `saved` và hiện `message`.
:::

| Mã | Chế độ | Nghĩa |
| --- | --- | --- |
| `NOT_SIGNED_IN` | Hub | Người chơi chưa kết nối ví |
| `PLAYER_UNAUTHORIZED` | Độc lập | Chưa `login()` hoặc token hết hạn (cùng tình huống với `NOT_SIGNED_IN`) |
| `STARTED_BEFORE_LOGIN` | Hub | Ván bắt đầu trước khi kết nối ví – ván sau mới được tính |
| `SESSION_NOT_STARTED` | Cả hai | Gọi `gameOver()` mà chưa gọi `gameStart()`, hoặc mở lượt chơi thất bại. Ở chế độ độc lập cũng là mã khi **đăng nhập giữa ván** |
| `PLAY_TOO_SHORT` | Cả hai | Ván ngắn hơn thời gian tối thiểu |
| `SCORE_TOO_FAST` | Cả hai | Ghi điểm nhanh bất thường |
| `SCORE_INVALID` | Cả hai | Điểm ngoài khoảng cho phép của bảng. (Điểm không phải số **không** gây mã này – SDK tự đổi thành 0, xem [SDK](/sdk#diem-gui-len)) |
| `SESSION_ENDED` | Cả hai | Lượt chơi này đã nộp điểm rồi |
| `SESSION_EXPIRED` | Cả hai | Lượt chơi mở quá thời gian tối đa |
| `SESSION_NOT_FOUND` | Cả hai | Lượt chơi không tồn tại / không thuộc người chơi này |
| `LEADERBOARD_NOT_FOUND` | Cả hai | Tên bảng trong `gameOver(score, { leaderboard })` không tồn tại |
| `LEADERBOARD_CLOSED` | Cả hai | Bảng xếp hạng (vd giải đấu có thời hạn) đã đóng |
| `PLAYER_BANNED` | Cả hai | Tài khoản bị cấm trong game này |
| `SERVER_SCORING_ONLY` | Cả hai | Game đặt chế độ "chỉ máy chủ nộp điểm" ([Server API](/server-api)) – điểm từ trình duyệt bị từ chối |
| `QUOTA_PLAYERS` / `QUOTA_SCORES` | Độc lập | Game hết hạn mức người chơi / lần lưu điểm của tháng theo gói |
| `RATE_LIMITED` | Cả hai | Gửi quá nhiều yêu cầu trong thời gian ngắn |
| `IP_BLOCKED` | Cả hai | IP gửi dồn dập nên bị chặn tạm 15 phút |
| `NETWORK` | Cả hai | Không kết nối được máy chủ |
| `TIMEOUT` | Hub | SDK không nhận được trả lời của hub sau 20 giây |
| `STANDALONE` | – | Mở file game trực tiếp, không qua hub – không lưu điểm |
| `PREVIEW` | Hub | Đang ở trang **Chơi thử** – không lưu điểm |
| `UNKNOWN` / `ERROR` | Hub / Độc lập | Lỗi khác |

Mã lỗi khi gọi thẳng Client API / Server API (không qua SDK) có thêm `INVALID_API_KEY`, `ORIGIN_NOT_ALLOWED`, `PROJECT_DISABLED`, `INVALID_SECRET_KEY`, `VALIDATION_ERROR` – xem [Dùng ngoài Game Hub](/ngoai-hub) và [Server API](/server-api).
