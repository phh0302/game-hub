# Stress test & giới hạn

## Tự động (CI, mỗi pull request)

| File | Kiểm tra |
|---|---|
| `tests/unit/zip-stress.test.ts` | Zip bomb (1 file / chia nhỏ) bị chặn trước khi giải nén; khai man kích thước trong header → `ZIP_INVALID`; đúng 2.000 file nhận, 2.001 chặn; đường dẫn độc (`../`, `..\`, tuyệt đối, ổ đĩa, ký tự điều khiển); file rác / cụt / rỗng |
| `tests/e2e/99c-stress-limits.spec.ts` | `saveState` đúng 64KB nhận, hơn 1 byte chặn, tính theo byte UTF-8, > 256KB chặn ở middleware, dữ liệu cũ không hỏng; 20 lần lưu đồng thời không trộn dữ liệu; 10 lần nộp điểm đồng thời cùng lượt → chỉ 1 lần tính; `track` lô quá lớn bị cắt, body > 64KB → 413; góp ý > 5 lần/giờ → 429; 150 request song song → chỉ 200/429; events > 60 lô/phút → 429 có `Retry-After` |

Nguyên tắc chung: chạm biên thì trả **mã lỗi rõ ràng (4xx)**, không bao giờ 5xx, không rớt kết nối.

## Bắn tải bằng tay

```bash
npm run stress -- --url http://localhost:3000 --concurrency 20 --duration 30
npm run stress -- --url https://staging.example.com --rps 50 --duration 60 --paths /api/v1/games,/api/v1/status
```

- Chỉ gửi GET vào API đọc công khai; in số request, tỉ lệ mã trả về, độ trễ p50/p95/p99. Có 5xx hoặc lỗi mạng → thoát mã 1.
- Mặc định **từ chối production** (chỉ localhost, `*.test`, `staging.*`, `*.vercel.app`). Bắn vào production phải thêm `--i-know-this-is-prod`: sẽ đốt hạn mức, IP của bạn có thể bị chặn tạm (bỏ chặn ở stats.monlabs.fun) và Telegram báo bất thường.
- Kết quả 429 nhiều là bình thường – lớp chặn đang làm việc. Xem độ trễ theo route ở bảng **API chậm nhất** trên trang stats.

## Giới hạn hiện tại

| Thứ | Giới hạn |
|---|---|
| Body JSON / body tiến trình | 64KB / 256KB (middleware), tiến trình lưu tối đa 64KB (byte UTF-8) |
| Lưu tiến trình | 60 lần/phút/người |
| Mở lượt / nộp điểm | 30 / 20 lần/phút/người |
| `track` | 60 lô/phút/IP, 50 sự kiện/lô, 10 thuộc tính, chuỗi 100 ký tự; 200 tên & 200.000 sự kiện/game/ngày |
| Góp ý | 5 lần/giờ/IP |
| Bản build | .zip ≤ 50MB, giải nén ≤ 150MB, ≤ 2.000 file |
| Ảnh | ≤ 1MB, PNG/JPG/WebP |
