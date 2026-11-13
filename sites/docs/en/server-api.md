# Server API & Webhooks

For games **with their own server** (backend). Your server uses a **secret key** to submit validated scores, export / delete scores, ban players, create tournaments and receive **webhooks** for every new score.

OpenAPI spec (import into Postman, Insomnia or a code generator): [play.monlabs.fun/openapi.json](https://play.monlabs.fun/openapi.json).

::: danger Keep the secret key on the server
`sk_live_…` has full access to your game's data. **Never** ship it in browser or app code. If it leaks, **Revoke** it on the game page right away and create a new one. Each game can have up to 2 active secret keys (for zero-downtime rotation).
:::

## Create a secret key

Developer page → your game → **Platform API** → **+ Create secret key** → copy it (shown once). Send it as:

```http
Authorization: Bearer sk_live_…
```

Quick check:

```bash
curl https://play.monlabs.fun/api/s1/project -H "Authorization: Bearer $MONLABS_SECRET_KEY"
```

## Server-confirmed scores

By default the browser submits scores through the SDK. If your server validates each run (replays, move checks…), set **Accept scores from: Only the game server** under Platform API. Scores sent from the browser are then rejected with `SERVER_SCORING_ONLY`.

1. The game (browser) starts a run and gets a `sessionId` – Monlabs starts the clock:

```js
const sessionId = await GameHub.gameStart();
// send sessionId + run data to your server
```

2. Your server validates the run and submits the score:

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

Leaderboard anti-cheat rules (minimum play time, max score, scoring speed) **still apply**; each play can be submitted once.

## Endpoints

| Method | Path | Does |
|---|---|---|
| GET | `/api/s1/project` | Project info, score source, leaderboards |
| POST | `/api/s1/scores` | Submit `{ sessionId, score, leaderboard? }` |
| GET | `/api/s1/scores?leaderboard=default&since=&cursor=&limit=100` | Export scores oldest → newest, `nextCursor` for the next page |
| DELETE | `/api/s1/scores/{id}?reason=` | Delete a cheated score – removes every score of that play (tournaments included) |
| GET | `/api/s1/players/{id}` | Player: best per board, plays, ban status |
| PUT | `/api/s1/players/{id}/ban` | Ban in this game `{ reason?, deleteScores? }` → can't start or submit (`PLAYER_BANNED`) |
| DELETE | `/api/s1/players/{id}/ban` | Unban |
| GET | `/api/s1/leaderboards` | All boards / tournaments with score and player counts |
| POST | `/api/s1/leaderboards` | Create a tournament – see below |

Bans only apply to your game; the account is unaffected elsewhere. Limit: 600 requests / minute per game.

### Create a tournament

```js
await fetch("https://play.monlabs.fun/api/s1/leaderboards", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({
    key: "tet-2027",
    names: { vi: "Giải Tết 2027", en: "Tet Cup 2027" },
    mirrorOf: "default", // takes scores from the default board during the event – no game change needed
    startsAt: "2027-02-01T00:00:00+07:00",
    endsAt: "2027-02-08T00:00:00+07:00",
  }),
});
```

## Webhooks

On the game page under **Webhook**: enter your server's `https://…` URL → **Save webhook** → copy the **signing secret** `whsec_…` (shown once) → **Send test**.

For every new score Monlabs sends a JSON `POST`:

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

- Reply **2xx within 5 seconds**. Errors / timeouts are retried after 1 min, 5 min, 30 min, 2 h, 12 h (up to 6 attempts). Deliveries and a **Retry** button are on the game page.
- An event may arrive **more than once** → use `id` to skip duplicates.
- Headers: `x-monlabs-event`, `x-monlabs-delivery` (= `id`), `x-monlabs-signature`.

### Verify the signature

`x-monlabs-signature: t=<unix seconds>,v1=<hex>` where `v1 = HMAC-SHA256(secret, t + "." + body)`. Always verify the **raw body** (before JSON parsing) and reject if `t` is more than 5 minutes off:

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

## Usage & log

The game page shows **Platform API usage** (players, plays, scores saved, scores rejected, API calls per day over 7 / 30 / 90 days) and the **Platform API log** (keys created / revoked, domain and score-source changes, rejected / deleted scores, bans, failed webhooks).
