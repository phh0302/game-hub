# Studio & duyệt game

Mọi game trên Game Hub thuộc về một **studio**. Mỗi người chỉ ở **1 studio**; một studio có tối đa **20 thành viên**.

## Tạo studio

1. Vào [play.monlabs.fun](https://play.monlabs.fun), bấm **Kết nối ví** và ký thông điệp trong MetaMask (miễn phí, không tốn gas)
2. Menu góc phải → **Developer**
3. Đặt tên studio, đường dẫn (slug) và mô tả; tick đồng ý [Điều khoản cho người đăng game](/dieu-khoan) → **Tạo studio**

Khi điều khoản có phiên bản mới, trang Developer hiện thông báo; chủ studio bấm **Tôi đồng ý** thì studio mới tạo game và upload tiếp được.

## Thành viên

| Việc | Ai làm được |
| --- | --- |
| Thêm thành viên bằng **địa chỉ ví** | Chủ studio |
| Xóa thành viên | Chủ studio |
| Chuyển quyền chủ studio cho thành viên khác | Chủ studio |
| Rời studio | Thành viên (chủ studio phải chuyển quyền trước) |
| Tạo game, upload phiên bản, sửa thông tin game | Mọi thành viên |

Người được thêm phải **đăng nhập Game Hub bằng ví đó ít nhất 1 lần** và chưa thuộc studio nào.

## Tạo game

Ở trang Developer → **Tạo game mới**:

- **Đường dẫn (slug)**: phần cuối địa chỉ game, vd `play.monlabs.fun/games/ten-game` – không đổi được sau khi tạo
- **Tên và mô tả** tiếng Việt / tiếng Anh
- **Thể loại**: tối đa 5
- **Ảnh bìa**: PNG, JPG hoặc WEBP, tối đa **1MB**, tỉ lệ **16:9**

Game mới ở trạng thái **Nháp**, chưa ai thấy. Tên, mô tả, thể loại, ảnh bìa sửa được bất cứ lúc nào; luật chấm điểm và trạng thái game do admin quyết.

## Upload phiên bản

1. Trong trang game → **Upload phiên bản**: đặt tên phiên bản (vd `1.0.0`), chọn file `.zip` ([yêu cầu file](/chuan-bi-zip)), ghi chú thay đổi nếu có
2. Hub kiểm tra và giải nén → phiên bản ở trạng thái **Chờ duyệt**
3. Bấm **Chơi thử**: game chạy y như trên hub (điểm không lưu), kèm nhật ký SDK – kiểm tra đủ 3 dấu ✓ ([chi tiết](/sdk#thu-truoc-khi-gui-duyet))

Mỗi lần sửa game là một phiên bản mới; phiên bản cũ được giữ lại để quay lại khi cần.

## Duyệt và phát hành

Admin chơi thử từng phiên bản rồi:

- **Duyệt** → admin đặt phiên bản đó làm bản đang chạy và phát hành game; game xuất hiện ở trang chủ với bảng xếp hạng riêng
- **Từ chối** → lý do hiện ngay dưới phiên bản trong trang Developer; sửa rồi upload phiên bản mới

Trạng thái game:

| Trạng thái | Nghĩa |
| --- | --- |
| Nháp | Chưa upload phiên bản nào |
| Chờ duyệt | Đã có phiên bản, đang chờ admin |
| Đã phát hành | Hiển thị và chơi được |
| Bảo trì | Vẫn hiển thị nhưng tạm khóa chơi |
| Tạm khóa | Bị khóa do vi phạm (vd sau báo cáo của người chơi) |
| Lưu trữ | Ngừng hoạt động, dữ liệu vẫn giữ |

Người chơi có thể bấm **Báo cáo** dưới mỗi game (game lỗi, nội dung không phù hợp, vi phạm bản quyền, gian lận điểm); admin xử lý và có thể chuyển game sang Bảo trì hoặc Tạm khóa.
