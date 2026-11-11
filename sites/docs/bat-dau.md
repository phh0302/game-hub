# Bắt đầu

**Game Hub** ([play.monlabs.fun](https://play.monlabs.fun)) là cổng mini game của Monlabs. Người chơi vào chơi ngay trên trình duyệt, không cần cài đặt; khi muốn lưu điểm thì kết nối ví MetaMask – không mật khẩu, không email.

Bạn có game HTML5 (viết tay, Phaser, PixiJS, Construct, Godot, Unity WebGL…)? Bạn có thể tự đưa game lên Game Hub mà không cần máy chủ riêng.

## Bạn được gì

- **Người chơi sẵn có** và trang giới thiệu game riêng, có ảnh bìa, mô tả song ngữ Việt/Anh
- **Đăng nhập bằng ví** do hub lo – game không phải tự làm tài khoản
- **Bảng xếp hạng** hằng ngày / tuần / mọi thời điểm, có kiểm tra chống gian lận ở máy chủ
- **Ngôn ngữ người chơi** (vi / en) được hub gửi sang game
- Game chạy trên **điện thoại và máy tính**, trong cả trình duyệt của app MetaMask

## Đưa game lên trong 4 bước

1. **Tạo studio** – kết nối ví ở Game Hub → menu góc phải → **Developer** → đặt tên studio, đồng ý [điều khoản](/dieu-khoan). Xem [Studio & duyệt game](/studio).
2. **Nhúng SDK vào game** – thêm 1 thẻ `<script>` và gọi `GameHub.gameStart()` / `GameHub.gameOver(score)`. Xem [Game Hub SDK](/sdk).
3. **Nén game thành .zip và upload** – hub kiểm tra, giải nén, cho bạn **Chơi thử** ngay. Xem [Chuẩn bị file .zip](/chuan-bi-zip).
4. **Chờ duyệt** – admin chơi thử rồi duyệt; game xuất hiện ở trang chủ Game Hub với bảng xếp hạng riêng.

## Ví dụ nhanh

```html
<!doctype html>
<html>
  <body>
    <canvas id="game"></canvas>
    <script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
    <script>
      let score = 0;
      GameHub.init().then((hub) => {
        document.documentElement.lang = hub.locale; // "vi" hoặc "en"
      });

      function onFirstInput() {
        GameHub.gameStart(); // ván bắt đầu – hub bắt đầu tính giờ
      }

      function onGameOver() {
        GameHub.gameOver(score); // hub lưu điểm nếu người chơi đã kết nối ví
      }
    </script>
  </body>
</html>
```

## Game mẫu

Game Hub có 4 game mẫu dùng đúng SDK này, mã nguồn ở repo [phh0302/game-hub](https://github.com/phh0302/game-hub/tree/main/public/uploads/games):

| Game | Kiểu | Điểm |
| --- | --- | --- |
| [2048](https://play.monlabs.fun/games/2048) | DOM, lưới | điểm cộng dồn |
| [Rắn săn mồi](https://play.monlabs.fun/games/snake) | Canvas, vòng lặp theo nhịp | 10 điểm mỗi mồi, xử lý `pause` |
| [Neon Flap](https://play.monlabs.fun/games/neon-flap) | Canvas, vật lý bước cố định | số cột vượt qua, xử lý `pause` / `resume` |
| [Lật thẻ](https://play.monlabs.fun/games/memory) | DOM, lật thẻ | thời gian hoàn thành, bảng "thấp là tốt" |
