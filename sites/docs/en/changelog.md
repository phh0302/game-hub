# SDK changelog

Each **major version** has its own URL (`/sdk/v1/`, `/sdk/v2/`, `/sdk/v3/`) – see [SDK versions](/en/sdk#phien-ban). Within a major version there are only bug fixes and **additive** features; breaking changes always ship as a new major.

## v3 – 2026-11-18 {#v3}

`https://play.monlabs.fun/sdk/v3/gamehub-sdk.js`

- **New:** `GameHub.saveState(data)` / `GameHub.loadState()` – stored per account for players with a connected wallet (synced across devices, since 2026-11-18) – save progress on the hub, where `localStorage` / IndexedDB always fail ([Saving progress](/en/sdk#luu-tien-trinh)). The protocol adds `STATE_SAVE`, `STATE_LOAD`, `STATE_RESULT`.
- **Changed:** in hub mode `gameOver()` returns a `Promise` of the result (previously `undefined`) – same as standalone mode; no reply from the hub within 20 seconds → `code: "TIMEOUT"`. Opened directly → `code: "STANDALONE"` and `scoreResult` is emitted.
- **Changed:** `gameOver(score)` with a non-numeric `score` logs a console warning (still submits 0 as before).
- Hub: network errors while submitting return `code: "NETWORK"` (previously `UNKNOWN`).

Migrating from v2: nothing is required – code that ignores `gameOver()`'s return value behaves exactly as before. Games saving with `localStorage` should switch to `saveState()`.

## v2 – 2026-11-13 {#v2}

`https://play.monlabs.fun/sdk/v2/gamehub-sdk.js`

- **New:** standalone mode (Platform API) – `init({ projectKey })`, `login()`, `login({ guest: true })`, `logout()`, `me()`, `leaderboard()`, `leaderboards()`; `gameStart()` returns a `sessionId`; `gameOver()` returns a `Promise` of the result ([Outside Game Hub](/en/ngoai-hub)).
- "Powered by Monlabs" badge on the Free plan; quota (`QUOTA_*`) and IP block (`IP_BLOCKED`) messages.
- Hub mode unchanged from v1.

## v1 – 2026-11-05 {#v1}

`https://play.monlabs.fun/sdk/v1/gamehub-sdk.js`

- Hub mode: `init()`, `gameStart()`, `gameOver(score, { leaderboard })`, `showRewardedAd()`, `showInterstitialAd()`, events `init` / `scoreResult` / `pause` / `resume`.
