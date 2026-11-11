# Chuẩn bị file .zip

Mỗi phiên bản game là **một file `.zip`** chứa toàn bộ bản build. Hub kiểm tra file ngay khi bạn upload; file không đạt sẽ báo lỗi kèm tên file gây lỗi.

## Yêu cầu

| Mục | Giới hạn |
| --- | --- |
| Dung lượng file .zip | Tối đa **50MB** |
| Dung lượng sau khi giải nén | Tối đa **150MB** (tính cả file `.br` / `.gz` sau khi giải nén) |
| Số file | Tối đa **2000 file** |
| File chạy đầu tiên | `index.html` ở gốc file .zip – hoặc trong **đúng 1 thư mục** bao ngoài (hub tự bỏ thư mục đó) |
| Tên phiên bản | Chữ, số, dấu chấm, gạch ngang, gạch dưới; tối đa 30 ký tự (vd `1.0.0`, `2024-12-beta`) |

## Đuôi file được phép

Chỉ file web. File khác (`exe`, `php`, `sh`, …) bị từ chối.

| Loại | Đuôi file |
| --- | --- |
| Web | `html` `js` `mjs` `css` `json` `map` `txt` `xml` `csv` |
| Ảnh | `png` `jpg` `gif` `webp` `avif` `svg` `ico` `bmp` |
| Âm thanh / video | `mp3` `ogg` `wav` `m4a` `aac` `mp4` `webm` |
| Font | `woff` `woff2` `ttf` `otf` |
| Engine | `wasm` `data` `bin` `unityweb` `pck` `atlas` `fnt` `plist` `tmx` `tsx` `glb` `gltf` |
| Nén sẵn | bản `.br` / `.gz` của các đuôi trên (vd `game.wasm.br`) |

File rác của hệ điều hành (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) được tự bỏ qua.

## Đường dẫn tương đối

Bản build được phục vụ từ kho lưu trữ, **không** nằm ở gốc tên miền. Mọi đường dẫn tài nguyên phải là đường dẫn tương đối:

```html
<!-- Đúng -->
<img src="./img/player.png" />
<script src="js/game.js"></script>

<!-- Sai: trỏ về gốc tên miền, sẽ không tải được -->
<img src="/img/player.png" />
```

Riêng file SDK dùng **đường dẫn đầy đủ** tới hub: `https://play.monlabs.fun/sdk/gamehub-sdk.js`.

## Unity WebGL

Compression Format **Brotli**, **Gzip** hay **Disabled** đều được. File nén sẵn (vd `Build/game.wasm.br`) được hub **giải nén lúc upload** và phục vụ đúng tên cũ, nên không cần cấu hình máy chủ và không cần bật *Decompression Fallback*.

Không nén hai lớp (vd `a.js.gz.br`) – hub sẽ từ chối.

## Không cần máy chủ riêng

Game chạy hoàn toàn trên trình duyệt. Muốn lưu dữ liệu giữa các lần chơi thì dùng `localStorage` (bọc `try/catch`, xem [Môi trường chạy game](/moi-truong)); điểm số lưu qua [SDK](/sdk).

## Lỗi thường gặp khi upload

| Thông báo | Cách sửa |
| --- | --- |
| Không tìm thấy `index.html` | Đặt `index.html` ở gốc file .zip, hoặc nén đúng 1 thư mục chứa nó |
| Có file không được phép | Xóa file đó khỏi bản build (thường là file nguồn, file cài đặt) |
| File quá lớn / quá nhiều file | Nén ảnh, âm thanh; bỏ file không dùng; với Unity bật Compression Format |
| File nén `.br` / `.gz` bị hỏng | Build lại, hoặc chọn Compression Format khác |
