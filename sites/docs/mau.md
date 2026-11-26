# Project mẫu

3 project tích hợp sẵn đủ SDK (điểm, lưu tiến trình, sự kiện, chia sẻ / mời bạn, quảng cáo thưởng, tạm dừng). Tải về bằng `degit` (chỉ lấy đúng thư mục, không kéo cả repo):

| Mẫu | Lệnh | Gồm |
|---|---|---|
| **HTML thuần** | `npx degit phh0302/game-hub/templates/html-basic my-game` | 1 file HTML + 1 file JS, không cần build |
| **Phaser 3 + Vite + TypeScript** | `npx degit phh0302/game-hub/templates/phaser-vite-ts my-game` | `@monlabs/sdk` có kiểu, `src/hub.ts` gom tích hợp, workflow GitHub Actions tự deploy khi tạo tag |
| **Unity WebGL** | `npx degit phh0302/game-hub/templates/unity-webgl my-kit` | `.jslib` + `MonlabsHub.cs` + WebGL template đã nạp SDK |

Mã nguồn: [github.com/phh0302/game-hub/tree/main/templates](https://github.com/phh0302/game-hub/tree/main/templates). CI build lại các mẫu ở mỗi thay đổi nên luôn khớp SDK mới nhất.

## Quy trình

1. `npm run dev` (hoặc `npx serve game`) → thử trong [Sandbox](/sdk#sandbox), không cần upload.
2. Sửa `game` trong `monlabs.json` thành slug game của bạn.
3. `npx @monlabs/cli login` rồi `npx @monlabs/cli deploy` ([chi tiết](/cli)).

## Bí mật

Mẫu đã có `.gitignore` cho `.env*`. Trong hub không cần key nào. Xem [bảng giữ bí mật](/cli#bi-mat): `pk_…` được phép lộ, `sk_…` và token `mlb_…` thì không – và **đừng đặt chúng vào biến `VITE_*`** (bị nhúng vào bản build).
