# Server API & Webhook

Dành cho game **có máy chủ riêng** (backend). Máy chủ dùng **secret key** để nộp điểm đã kiểm tra, xuất / xóa điểm, cấm người chơi, tạo giải đấu và nhận **webhook** mỗi khi có điểm mới.

Tài liệu dạng OpenAPI (nhập vào Postman, Insomnia, hoặc sinh code): [play.monlabs.fun/openapi.json](https://play.monlabs.fun/openapi.json).

::: danger Secret key chỉ ở máy chủ
`sk_live_…` cho toàn quyền với dữ liệu game. **Không** đưa vào code chạy trên trình duyệt hay app. Lộ key → vào trang game **Thu hồi** ngay rồi tạo key mới. Mỗi game có tối đa 2 secret key đang dùng (để đổi key không gián đoạn).
:::

## Tạo secret key

Trang Developer → game → mục **Platform API** → **+ Tạo secret key** → sao chép key (chỉ hiện 1 lần). Gọi API với header:

```http
Authorization: Bearer sk_live_…
```

Kiểm tra nhanh:

```bash
curl https://play.monlabs.fun/api/s1/project -H "Authorization: Bearer $MONLABS_SECRET_KEY"
```

## Máy chủ xác nhận điểm

Mặc định trình duyệt nộp điểm qua SDK. Nếu game tự kiểm tra ván chơi ở máy chủ (vd chơi lại nước đi, kiểm tra replay), chọn **Nhận điểm từ: Chỉ máy chủ của game** ở mục Platform API. Khi đó điểm gửi từ trình duyệt bị từ chối với mã `SERVER_SCORING_ONLY`.

1. Game (trình duyệt) bắt đầu ván và lấy `sessionId` – máy chủ Monlabs bắt đầu tính giờ:

```js
const sessionId = await GameHub.gameStart();
// gửi sessionId + dữ liệu ván chơi tới máy chủ của bạn
```

2. Máy chủ của bạn kiểm tra ván chơi rồi nộp điểm:

```js
const res = await fetch("https://play.monlabs.fun/api/s1/scores", {
  method: "POST",
  headers: {
    authorization: `Bearer ${process.env.MONLABS_SECRET_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ sessionId, score, leaderboard: "default" }),
});
const result = await res.json(); // { score, isNewBest, best, rank, tournaments }
```

Luật chống gian lận của bảng xếp hạng (thời gian chơi tối thiểu, điểm tối đa, tốc độ ghi điểm) **vẫn áp dụng**; mỗi lượt chơi chỉ nộp được 1 lần.

## Các API

| Phương thức | Đường dẫn | Việc làm |
|---|---|---|
| GET | `/api/s1/project` | Thông tin project, chế độ nộp điểm, các bảng xếp hạng |
| POST | `/api/s1/scores` | Nộp điểm `{ sessionId, score, leaderboard? }` |
| GET | `/api/s1/scores?leaderboard=default&since=&cursor=&limit=100` | Xuất điểm cũ → mới, có `nextCursor` để lấy trang sau |
| DELETE | `/api/s1/scores/{id}?reason=` | Xóa điểm gian lận – xóa mọi điểm của cùng lượt chơi (cả điểm đã vào giải đấu) |
| GET | `/api/s1/players/{id}` | Người chơi: điểm cao nhất mỗi bảng, số lượt chơi, có bị cấm không |
| PUT | `/api/s1/players/{id}/ban` | Cấm trong game này `{ reason?, deleteScores? }` → không bắt đầu ván / nộp điểm được (`PLAYER_BANNED`) |
| DELETE | `/api/s1/players/{id}/ban` | Bỏ cấm |
| GET | `/api/s1/leaderboards` | Mọi bảng / giải đấu kèm số điểm, số người chơi |
| POST | `/api/s1/leaderboards` | Tạo giải đấu – xem dưới |

Lệnh cấm chỉ có hiệu lực trong game của bạn; tài khoản ở game khác không bị ảnh hưởng. Giới hạn: 600 request / phút cho mỗi game.

### Tạo giải đấu

```js
await fetch("https://play.monlabs.fun/api/s1/leaderboards", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({
    key: "tet-2027",
    names: { vi: "Giải Tết 2027", en: "Tet Cup 2027" },
    mirrorOf: "default", // tự nhận điểm của bảng default trong thời gian giải – không cần sửa game
    startsAt: "2027-02-01T00:00:00+07:00",
    endsAt: "2027-02-08T00:00:00+07:00",
  }),
});
```

## Webhook

Mục **Webhook** trên trang game: nhập URL `https://…` của máy chủ → **Lưu webhook** → sao chép **khóa ký** `whsec_…` (chỉ hiện 1 lần) → **Gửi thử**.

Mỗi khi có điểm mới, Monlabs gửi `POST` JSON:

```json
{
  "id": "cm…",
  "type": "score.submitted",
  "createdAt": "2026-11-14T08:00:00.000Z",
  "gameId": "cm…",
  "data": {
    "scoreId": "cm…", "sessionId": "cm…", "playerId": "cm…",
    "leaderboard": "default", "value": 1234, "durationSeconds": 95,
    "isNewBest": true, "tournaments": ["tet-2027"], "via": "client"
  }
}
```

- Trả mã **2xx trong 5 giây** để xác nhận. Lỗi / quá hạn → gửi lại sau 1 phút, 5 phút, 30 phút, 2 giờ, 12 giờ (tối đa 6 lần). Danh sách lần gửi và nút **Gửi lại** ở trang game.
- Một sự kiện có thể đến **hơn 1 lần** → dùng `id` để bỏ qua bản trùng.
- Header: `x-monlabs-event`, `x-monlabs-delivery` (= `id`), `x-monlabs-signature`.

### Kiểm tra chữ ký

`x-monlabs-signature: t=<unix giây>,v1=<hex>` với `v1 = HMAC-SHA256(khóa ký, t + "." + body)`. Luôn kiểm tra trên **body gốc** (chưa parse JSON) và từ chối nếu `t` lệch quá 5 phút:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMonlabs(secret, header, rawBody) {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1 ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

## Số liệu & nhật ký

Trang game có **Số liệu Platform API** (người chơi, lượt chơi, điểm đã lưu, điểm bị từ chối, lượt gọi API theo ngày, 7 / 30 / 90 ngày) và **Nhật ký Platform API** (tạo / thu hồi key, đổi domain, đổi cách nhận điểm, điểm bị từ chối / bị xóa, cấm người chơi, webhook lỗi).
