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

- **Duyệt** bản đầu tiên → phiên bản đó tự thành **bản đang chạy** và game **tự phát hành**; game xuất hiện ở trang chủ với bảng xếp hạng riêng
- **Từ chối** → lý do hiện ngay dưới phiên bản trong trang Developer; sửa rồi upload phiên bản mới

Khi duyệt, admin cũng đặt [luật chấm điểm](/bang-xep-hang#luat) cho game. Bạn xem luật hiện tại ở trang game → mục **Luật chấm điểm** (chỉ xem). Luật không khớp cách chơi thật (vd người chơi giỏi vượt điểm tối đa) sẽ làm **điểm thật bị từ chối** – hãy báo admin hoặc ghi vào ghi chú phiên bản.

## Cập nhật game đã phát hành {#cap-nhat}

| Câu hỏi | Trả lời |
| --- | --- |
| Bản mới có phải duyệt lại không? | **Có.** Mỗi phiên bản upload lên đều ở trạng thái **Chờ duyệt** và được admin chơi thử trước. |
| Trong lúc chờ duyệt, bản cũ có chạy không? | **Có.** Game vẫn **Đã phát hành**, người chơi vẫn chơi bản đang chạy (nhãn *đang chạy* trong danh sách phiên bản). Bản mới bị từ chối cũng không ảnh hưởng bản cũ. |
| Duyệt xong thì bản mới chạy ngay chứ? | Chưa tự động – để bạn chọn thời điểm. Bản cập nhật đã duyệt có nút **Đặt làm bản chạy** trong danh sách phiên bản: bạn tự bấm (admin cũng có thể bấm hộ). |
| Rollback được không? | **Được, tự làm.** Mọi phiên bản đã duyệt đều được giữ lại; bấm **Đặt làm bản chạy** ở bản cũ là quay lại ngay, không cần upload lại hay chờ admin. Người chơi nhận bản đó khi tải lại trang. (Game bị **Tạm khóa** / **Lưu trữ** thì không đổi được.) |
| Điểm và bảng xếp hạng có bị ảnh hưởng? | Không. Điểm gắn với game, không gắn với phiên bản. Đổi cách tính điểm thì báo admin để chỉnh luật cho khớp. |
| Người chơi đang chơi dở lúc đổi bản? | Ván đang chơi tiếp tục ở bản cũ đến khi tải lại trang. Tiến trình lưu bằng [`saveState()`](/sdk#luu-tien-trinh) được giữ – nếu đổi cấu trúc dữ liệu, hãy để bản mới đọc được dữ liệu của bản cũ. |

Mọi việc liên quan tới game – upload, admin duyệt / từ chối, đổi bản chạy (ai đổi, từ bản nào), đổi trạng thái, đổi luật, điểm bị từ chối – đều ghi ở mục **Nhật ký hoạt động** trong trang game.

Mẹo: đặt tên phiên bản tăng dần (`1.0.0` → `1.0.1` → `1.1.0`) và ghi rõ thay đổi trong ghi chú để admin duyệt nhanh.

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
