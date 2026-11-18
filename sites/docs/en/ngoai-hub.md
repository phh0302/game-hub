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
<script type="module">
  // Top-level await only works in type="module"; in a classic <script>, wrap it in an async function
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
// { saved, code, message, score, best, rank, isNewBest, tournaments } – here score is the saved NUMBER

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
| `GameHub.login()` / `GameHub.login({ guest: true })` | `Promise<player>` – the token is kept in the browser for next time. Calling `login()` (wallet) while playing as a guest links a new wallet to the guest account, or merges the guest's scores into the wallet's existing account – nothing is lost |
| `GameHub.logout()` | Revokes the token on the server immediately |
| `GameHub.me()` | `Promise<{ player, best } \| null>` |
| `GameHub.gameStart()` | Opens a run → `Promise<sessionId \| null>` (for games whose server submits scores, see [Server API](/en/server-api)) |
| `GameHub.gameOver(score, { leaderboard? })` | `Promise<{ saved, code, message, … }>` – also emits `scoreResult` |
| `GameHub.leaderboard({ board?, period?, limit? })` | Top players + your rank (`me`). Defaults: `board: "default"`, `period: "all"` (or `"week"`, `"day"`), `limit: 50` |
| `GameHub.leaderboards()` | Main board + visible [events](/en/bang-xep-hang#giai-dau) |
| `GameHub.saveState(data)` / `GameHub.loadState()` | Save / load progress (JSON ≤ 64KB) in your domain's `localStorage` – see [Saving progress](/en/sdk#luu-tien-trinh) |
| `GameHub.on("init", cb)` | Called when the player signs in / out |

Without `projectKey` the SDK runs in **hub mode** as before (game inside Game Hub). One build works in both places if you mind the differences:

| | Hub mode | Standalone (`projectKey`) |
| --- | --- | --- |
| Sign-in | Handled by the hub (its **Connect wallet** button) – the game doesn't call `login()` | The game calls `login()` |
| `gameStart()` | Returns nothing | `Promise<sessionId \| null>` |
| `gameOver()` | `Promise<result>` (SDK v3) + `scoreResult` event | `Promise<result>` + `scoreResult` event |
| Not signed in | `code: "NOT_SIGNED_IN"` | `code: "PLAYER_UNAUTHORIZED"` |
| Signed in mid-run | `code: "STARTED_BEFORE_LOGIN"` | `code: "SESSION_NOT_STARTED"` |
| The game's `localStorage` | **Not available** (sandboxed frame) – use `saveState()` | Available |

To behave the same in both: show results from `GameHub.on("scoreResult", r => …)` and rely on `r.saved` + `r.message` rather than checking specific codes. Full code list: [Leaderboards](/en/bang-xep-hang#ma-loi).

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

Client API error codes: `INVALID_API_KEY` (wrong / revoked key), `ORIGIN_NOT_ALLOWED` (domain not listed), `PROJECT_DISABLED` (game suspended), `PLAYER_UNAUTHORIZED` (signed out / token expired), `RATE_LIMITED`. In the `POST /scores` response `score` is an **object** (`score.value` holds the points) – see the [Server API](/en/server-api) example.
