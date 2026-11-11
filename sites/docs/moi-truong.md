# Môi trường chạy game

Hub nhúng game trong một **khung cách ly** (`iframe` có `sandbox="allow-scripts allow-pointer-lock"`) và phục vụ bản build từ tên miền khác hub. Nhờ vậy game của developer không đụng được tới tài khoản người chơi.

## Game làm được

- Chạy JavaScript, WebAssembly, WebGL, Canvas, Web Audio
- Khóa con trỏ chuột (pointer lock) cho game bắn súng, đua xe
- Nhận bàn phím, chuột, cảm ứng như trang web bình thường
- Giao tiếp với hub qua [SDK](/sdk)

## Game không làm được

- Đọc cookie, trang hay dữ liệu đăng nhập của hub
- Mở cửa sổ popup, chuyển trang cha, gửi form
- Tự gọi API của hub – mọi thứ đi qua SDK (`postMessage`)

## localStorage có thể bị chặn

Trong khung cách ly, `localStorage` / `sessionStorage` có thể ném lỗi. Luôn bọc trong `try/catch` và cho game chạy được khi không lưu được:

```js
function load(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // không lưu được – chơi tiếp bình thường
  }
}

function save(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // bỏ qua
  }
}
```

## Mở game trực tiếp

Mở thẳng file `index.html` (không qua hub) vẫn chạy được: SDK chuyển sang chế độ độc lập, `init()` trả về `standalone: true`, điểm không được lưu. Tiện để thử game trên máy trước khi upload.

## Kích thước màn hình

Khung game co theo trang: vừa cột nội dung trên máy tính, toàn chiều ngang trên điện thoại, có nút **Toàn màn hình**. Hãy thiết kế giao diện co giãn theo kích thước khung thay vì cố định pixel.

## Tạm dừng {#tam-dung}

Khi người chơi chuyển tab hoặc thu nhỏ trình duyệt, game nên tự dừng vòng lặp và nhạc:

```js
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
```

SDK cũng có sự kiện `pause` / `resume` (xem [SDK](/sdk#su-kien)) – nên lắng nghe sẵn, hub sẽ dùng chúng cho quảng cáo xen giữa sau này.
