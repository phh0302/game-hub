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
- Dùng `localStorage`, `IndexedDB`, cookie – lưu tiến trình bằng [`saveState()`](#luu-du-lieu)

## Không có localStorage – lưu tiến trình bằng SDK {#luu-du-lieu}

Khung cách ly **không có** `allow-same-origin`, nên trang game có origin là `null`. Hệ quả trên hub:

- `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` **luôn ném lỗi** (`SecurityError`) – không phải "thỉnh thoảng", mà là mọi lần.
- Unity: `PlayerPrefs` và tùy chọn **Data Caching** (cả hai dùng IndexedDB) không lưu được gì. Nên tắt *Data Caching* trong Player Settings.

Dùng **`GameHub.saveState(data)` / `GameHub.loadState()`** của SDK thay cho localStorage: hub lưu hộ dữ liệu JSON (tối đa 64KB) – theo tài khoản nếu người chơi đã kết nối ví (đồng bộ giữa các máy), trong trình duyệt nếu là khách. Xem [Lưu tiến trình](/sdk#luu-tien-trinh).

```js
const save = (await GameHub.loadState()) ?? { level: 1, coins: 0 };
// … khi qua màn …
GameHub.saveState(save);
```

Code đọc localStorage cũ vẫn phải bọc `try/catch` để game không bị dừng giữa chừng.

::: warning Thử bằng "Chơi thử", đừng chỉ mở file trực tiếp
Mở thẳng file `index.html` của bản build (không qua hub) thì game **không** bị cách ly: localStorage chạy bình thường, nên trông như lưu được – lên hub thì mất hết. Luôn kiểm tra ở trang **Chơi thử** sau khi upload.
:::

## Tải file của chính game (CORS) {#cors}

Vì origin là `null`, mọi request tới file của chính game đều tính là **cross-origin**:

- `fetch()` / `XMLHttpRequest` tới file JSON, âm thanh, level…
- `<script type="module">` (mặc định của Vite, Rollup, esbuild…) và `import()` động
- Unity WebGL tải `.data`, `.wasm`, `.framework.js` bằng `fetch`

Kho file của Game Hub trả header `Access-Control-Allow-Origin: *` cho mọi file game, nên các cách trên **chạy được, không cần cấu hình gì**. Nếu tự host file ở máy chủ khác (vd game gọi API riêng), máy chủ đó cũng phải trả CORS cho origin `null` (thường là `*`), và không dùng được cookie.

## Mở game trực tiếp

Mở thẳng file `index.html` (không qua hub) vẫn chạy được: SDK chuyển sang chế độ độc lập, `init()` trả về `standalone: true`, điểm không được lưu (`gameOver()` trả `code: "STANDALONE"`), `saveState()` dùng localStorage của trang. Tiện để thử nhanh trên máy – nhưng nhớ kiểm tra lại ở **Chơi thử** vì trên hub game chạy trong khung cách ly ([khác biệt](#luu-du-lieu)).

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
