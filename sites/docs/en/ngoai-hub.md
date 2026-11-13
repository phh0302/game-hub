# Outside Game Hub (Platform API)

Your game running on **its own website** can still use Monlabs infrastructure: MetaMask wallet sign-in, guest play, anti-cheat leaderboards and events. Leaderboards are shared with the Game Hub version of the game (if any).

Try the sample game: [play.monlabs.fun/demo/index.html](https://play.monlabs.fun/demo/index.html) (needs a project's `?key=`).

## Get started in 5 steps

1. Create a studio and a game on the [Developer page](https://play.monlabs.fun/developer) as usual ([Studio & review](/en/studio)). A game that only runs on your own domain doesn't need a build upload or review.
2. On the game page → **Platform API**, list your game's **domains**, one per line, like `https://mygame.io`. For local development add `http://localhost:5173` (http only works for localhost).
3. Click **Create key** → copy the **publishable key** `pk_live_…` (shown once).
4. Include the SDK and call `init` with the key:

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
<script>
  const hub = await GameHub.init({ projectKey: "pk_live_…" });
  // hub.player = null when signed out; hub.project.name, hub.project.leaderboards
</script>
```

5. Sign the player in, then play:

```js
await GameHub.login();                  // MetaMask – signs a message naming your game's domain
// or: await GameHub.login({ guest: true });     // guest play, no wallet needed

GameHub.gameStart();                    // run starts – the server starts timing
const result = await GameHub.gameOver(score);
// { saved, code, message, score, best, rank, isNewBest, tournaments }

const top = await GameHub.leaderboard({ period: "week", limit: 10 });
// { leaderboard, entries: [{ rank, displayName, score, … }], me }
```

::: tip The publishable key is public
It's fine to put it in your game's code: the key **only works on the domains you listed**. If it leaks, **Revoke** it on the game page and create a new one.
:::

## SDK functions in standalone mode

| Function | Result |
| --- | --- |
| `GameHub.init({ projectKey, apiBase?, locale? })` | `Promise<{ mode: "project", project, player, canSubmitScore, locale }>` |
| `GameHub.login()` / `GameHub.login({ guest: true })` | `Promise<player>` – the token is kept in the browser for next time |
| `GameHub.logout()` | Revokes the token on the server immediately |
| `GameHub.me()` | `Promise<{ player, best } \| null>` |
| `GameHub.gameStart()` | Opens a run |
| `GameHub.gameOver(score, { leaderboard? })` | `Promise<{ saved, code, message, … }>` – also emits `scoreResult` |
| `GameHub.leaderboard({ board?, period?, limit? })` | Top players + your rank (`me`) |
| `GameHub.leaderboards()` | Main board + visible [events](/en/bang-xep-hang#giai-dau) |
| `GameHub.on("init", cb)` | Called when the player signs in / out |

Without `projectKey` the SDK runs in **hub mode** as before (game inside Game Hub) – one build works in both places.

## Anti-cheat

Same as on the hub ([details](/en/bang-xep-hang)): the server measures the time from `gameStart()` to `gameOver()` and rejects runs that are too short, scores outside the limits and abnormal scoring speed; each run can be submitted once. The error code is in `result.code`, an explanation in the player's language in `result.message`.

## Client API (direct calls, without the SDK)

Every request goes to `https://play.monlabs.fun/api/p1/…` with header `x-gamehub-key: pk_live_…`; player requests add `Authorization: Bearer <token>`. Browsers must call from a listed domain (`Origin` header).

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/project` | Game name, leaderboards, sign-in options |
| POST | `/auth/nonce` | `{ address, chainId }` → `{ message }` for the wallet to sign |
| POST | `/auth/verify` | `{ message, signature }` → `{ token, player }` |
| POST | `/auth/guest` | → `{ token, player }` (up to 10 guest accounts / hour / IP) |
| POST | `/auth/logout` | Revokes the token |
| GET | `/me` | Player + best score on the main board |
| POST | `/sessions` | → `{ sessionId }` |
| POST | `/scores` | `{ sessionId, score, leaderboard? }` |
| GET | `/leaderboards` | Main board + events |
| GET | `/leaderboard?board=&period=&limit=` | Top players (+ `me` with a token) |

Client API error codes: `INVALID_API_KEY` (wrong / revoked key), `ORIGIN_NOT_ALLOWED` (domain not listed), `PROJECT_DISABLED` (game suspended), `PLAYER_UNAUTHORIZED` (signed out / token expired), `RATE_LIMITED`.
