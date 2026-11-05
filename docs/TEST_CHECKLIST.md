# Checklist kiểm thử thủ công (Phase 8)

Dùng cho các luồng cần ví MetaMask thật – phần tự động chạy bằng `npm test`.
Chuẩn bị: 2 tài khoản MetaMask (A = admin trong `ADMIN_WALLETS`, B = người chơi thường), database đã seed.

Ghi kết quả: ✅ đạt · ❌ lỗi (ghi lại bước + ảnh chụp) · ⏭ bỏ qua

## 1. Đăng nhập ví (P0)

| # | Bước | Kết quả mong đợi | KQ |
|---|---|---|---|
| 1.1 | Trình duyệt KHÔNG có MetaMask → bấm "Kết nối ví" | Hiện thông báo không tìm thấy ví + nút "Cài MetaMask" + nút mở bằng app | |
| 1.2 | Có MetaMask → "Kết nối ví" → chấp nhận kết nối → **Ký** | Đăng nhập thành công, góc phải hiện địa chỉ ví rút gọn | |
| 1.3 | Bấm "Kết nối ví" → **Từ chối** ký trong MetaMask | Báo "Bạn đã từ chối yêu cầu", vẫn chưa đăng nhập | |
| 1.4 | Popup MetaMask đang mở, bấm "Kết nối ví" lần nữa | Báo MetaMask đang có yêu cầu chờ | |
| 1.5 | Đăng nhập ví A, đổi sang tài khoản B trong MetaMask | Hub tự đăng xuất | |
| 1.6 | Đăng nhập → tải lại trang (F5) | Vẫn đăng nhập (cookie 7 ngày) | |
| 1.7 | Đăng xuất | Menu về nút "Kết nối ví"; vào `/profile` bị chuyển về trang chủ + thông báo | |
| 1.8 | Nội dung thông điệp ký trong MetaMask | Có đúng domain `localhost:3000`, có dòng "will not trigger a blockchain transaction", **không** có phí gas | |

## 2. Chơi game & điểm (P0)

| # | Bước | Kết quả mong đợi | KQ |
|---|---|---|---|
| 2.1 | Chưa đăng nhập → mở 2048 → chơi đến hết hoặc bấm "Ván mới" | Chơi bình thường; hiện "Bạn đạt X điểm. Kết nối ví để lưu…" | |
| 2.2 | Đăng nhập ví B → chơi > 5 giây → bấm "Ván mới" | Thông báo "Kỷ lục mới…" + hạng; bảng xếp hạng bên cạnh cập nhật | |
| 2.3 | Chơi < 5 giây rồi bấm "Ván mới" | Báo "Ván chơi quá ngắn…", điểm không lên bảng | |
| 2.4 | Chơi ván thứ 2 điểm thấp hơn ván 1 | Báo "Đã lưu… Kỷ lục của bạn: (điểm ván 1)" | |
| 2.5 | Đăng nhập ngay khi đang chơi (chưa ván nào) | Dòng "Kết nối ví trên Game Hub…" trong game biến mất | |
| 2.6 | Đổi ngôn ngữ EN khi đang ở trang game | Chữ trong game đổi sang tiếng Anh | |
| 2.7 | Nút "Toàn màn hình" | Game hiện toàn màn hình, phím mũi tên vẫn chơi được | |
| 2.8 | Trên điện thoại (trình duyệt trong app MetaMask) | Vuốt để chơi được, giao diện không tràn ngang | |

## 3. Bảng xếp hạng & hồ sơ (P1)

| # | Bước | Kết quả mong đợi | KQ |
|---|---|---|---|
| 3.1 | Có điểm của A và B → xem `/games/2048/leaderboard` | Xếp đúng thứ tự điểm; dòng của mình được tô sáng | |
| 3.2 | Tab Hôm nay / Tuần / Tất cả | Chuyển được, không lỗi | |
| 3.3 | `/profile` → đặt tên `Ha_Pham` → Lưu | Lưu thành `ha_pham`; bảng xếp hạng hiện tên mới | |
| 3.4 | Ví khác đặt trùng tên `ha_pham` | Báo "Tên này đã có người dùng" | |
| 3.5 | Đặt tên `admin` hoặc ảnh `http://…` | Báo thông tin không hợp lệ | |
| 3.6 | Mục Thành tích + Lượt chơi gần đây | Đúng điểm cao nhất, số lượt chơi, thời gian | |

## 4. Quản trị (P1)

| # | Bước | Kết quả mong đợi | KQ |
|---|---|---|---|
| 4.1 | Ví B (không phải admin) vào `/admin` | Bị chuyển về trang chủ + "không có quyền" | |
| 4.2 | Ví A vào `/admin` | Thấy game 2048, phiên bản 1.0.0 "đang chạy" | |
| 4.3 | Đổi trạng thái 2048 sang "Bảo trì" | Trang game hiện "đang bảo trì", thẻ game có nhãn Bảo trì; đổi lại "Đã phát hành" | |
| 4.4 | Tạo game mới (slug `test-game`) | Tạo được ở trạng thái Nháp, KHÔNG hiện ở trang chủ | |
| 4.5 | Chuyển game nháp sang "Đã phát hành" khi chưa có phiên bản | Báo cần phiên bản đã duyệt | |
| 4.6 | Copy thư mục `public/uploads/games/2048/1.0.0` thành `.../test-game/1.0.0` → thêm phiên bản 1.0.0 → Duyệt → Đặt làm bản chạy → Đã phát hành | Game mới hiện ở trang chủ và chơi được | |
| 4.7 | Từ chối phiên bản đang chạy | Không có nút từ chối cho bản đang chạy | |

## 5. Bảo mật (P0)

| # | Bước | Kết quả mong đợi | KQ |
|---|---|---|---|
| 5.1 | Mở thẳng `http://localhost:3000/uploads/games/2048/1.0.0/index.html`, F12 → Console gõ `document.cookie` | Báo lỗi / chuỗi rỗng (game bị ép sandbox) | |
| 5.2 | Nộp lại cùng 1 lượt chơi 2 lần (DevTools → Network → Replay request `scores`) | Lần 2 báo 409 `SESSION_ENDED` | |
| 5.3 | Sửa điểm thành 99999999 khi replay request `scores` với lượt chơi mới | 400 `SCORE_INVALID` (vượt maxScore 4.000.000) | |
| 5.4 | Replay request `auth/verify` cũ (đã dùng) | 401 `NONCE_INVALID` | |
| 5.5 | F12 → Application → Cookies → `gh_session` | HttpOnly ✓, SameSite Lax ✓ (Secure ✓ khi chạy https) | |
| 5.6 | Gọi API ghi dữ liệu từ trang web khác (vd: Console ở trang google.com: `fetch("http://localhost:3000/api/v1/me",{method:"PATCH",body:"{}"})`) | Bị chặn: 403 `CROSS_SITE_REQUEST` hoặc lỗi CORS | |
| 5.7 | `npm run audit` | Không còn lỗ hổng mức high/critical ở thư viện chạy production | |
