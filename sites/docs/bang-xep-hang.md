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

## Luật của bảng xếp hạng

Admin đặt các luật này cho từng game, theo cách chơi thật của game:

| Luật | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| Thời gian chơi tối thiểu | Ván ngắn hơn bị từ chối | 2048: 5 giây |
| Thời gian lượt chơi tối đa | Lượt mở quá lâu bị hết hạn | Mặc định 6 giờ |
| Khoảng điểm cho phép | Điểm ngoài `minScore`–`maxScore` bị từ chối | Rắn săn mồi: tối đa 4.000 |
| Tốc độ ghi điểm tối đa | Điểm ÷ số giây chơi lớn hơn mức này bị từ chối | Neon Flap: 1,5 điểm/giây |
| Thứ tự | "Cao là tốt" hoặc "thấp là tốt" | Lật thẻ: thấp là tốt |

Khi gửi game duyệt, hãy ghi vào **ghi chú phiên bản** điểm tối đa có thể đạt và tốc độ ghi điểm nhanh nhất của người chơi giỏi, để admin đặt luật vừa khít.

## Game tính theo thời gian

Với game "ai xong nhanh nhất thắng", gửi **số mili-giây** hoàn thành:

```js
const startedAt = performance.now();
GameHub.gameStart();
// … người chơi hoàn thành …
GameHub.gameOver(Math.round(performance.now() - startedAt)); // vd 42700 = 42,7 giây
```

Admin đặt bảng ở chế độ "thấp là tốt" và hiển thị dạng thời gian → hub hiện `0:42,7` thay vì `42.700 điểm`. Máy chủ cũng từ chối thời gian **ngắn hơn** thời gian nó đo được quá vài giây, nên không gửi được thời gian giả.

## Người chơi chưa kết nối ví

Vẫn chơi được bình thường, nhưng điểm không lưu: `init` trả về `canSubmitScore: false`, và `scoreResult` trả về `saved: false` với mã `NOT_SIGNED_IN`. Nếu người chơi kết nối ví **giữa ván**, ván đó vẫn không được lưu (mã `STARTED_BEFORE_LOGIN`) – ván sau mới được tính.

## Mã lỗi {#ma-loi}

Khi `scoreResult.saved` là `false`, trường `code` cho biết lý do. `message` đã có câu giải thích theo ngôn ngữ người chơi – game chỉ cần hiện ra.

| Mã | Nghĩa |
| --- | --- |
| `NOT_SIGNED_IN` | Người chơi chưa kết nối ví |
| `STARTED_BEFORE_LOGIN` | Ván bắt đầu trước khi kết nối ví |
| `SESSION_NOT_STARTED` | Game gọi `gameOver()` mà chưa gọi `gameStart()` |
| `PLAY_TOO_SHORT` | Ván ngắn hơn thời gian tối thiểu |
| `SCORE_TOO_FAST` | Ghi điểm nhanh bất thường |
| `SCORE_INVALID` | Điểm không phải số nguyên ≥ 0, hoặc ngoài khoảng cho phép |
| `SESSION_ENDED` | Lượt chơi này đã nộp điểm rồi |
| `SESSION_EXPIRED` | Lượt chơi mở quá thời gian tối đa |
| `LEADERBOARD_NOT_FOUND` | Tên bảng xếp hạng trong `gameOver(score, { leaderboard })` không tồn tại |
| `LEADERBOARD_CLOSED` | Bảng xếp hạng (vd giải đấu có thời hạn) đã đóng |
