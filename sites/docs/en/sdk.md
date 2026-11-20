# Game Hub SDK

The SDK is a small JavaScript file that lets your game talk to the hub: receive the language and player info, and report the start and end of each run so scores get saved.

## Include the SDK

```html
<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script>
```

Use the **full URL** as above – your build is served from a different domain than the hub. The SDK creates a global `window.GameHub`.

### SDK versions {#phien-ban}

| URL | Use it when |
| --- | --- |
| `/sdk/v3/gamehub-sdk.js` | **Recommended.** Pinned to major v3: only bug fixes and additive features, never breaking changes |
| `/sdk/v2/…`, `/sdk/v1/…` | Older games that want to keep exactly the behaviour they were tested with (frozen, no updates) |
| `/sdk/gamehub-sdk.js` | Always the latest major – it will move to v4 when that ships. Only for experiments |

Breaking changes only ship in a **new major** (`/sdk/v4/`), with a migration guide in the [SDK changelog](/en/changelog). Games on `/sdk/v3/` are unaffected. `GameHub.version` tells you which version is running.

## Functions

| Function | When to call | Result |
| --- | --- | --- |
| `GameHub.init()` | Once, when the game has loaded | `Promise<{ locale, player, canSubmitScore, standalone }>` |
| `GameHub.gameStart()` | A new run starts – best called on the player's **first input** | The hub starts timing the run |
| `GameHub.gameOver(score, { leaderboard })` | The run ends | The hub submits the score to leaderboard `leaderboard` (default `"default"`) → `Promise<result>` (same as [`scoreResult`](#du-lieu-scoreresult)) |
| `GameHub.saveState(data)` | Save progress (levels, items, settings) | `Promise<{ saved, code }>` – see [Saving progress](#luu-tien-trinh) |
| `GameHub.loadState()` | When the game loads | `Promise<data \| null>` |
| `GameHub.track(name, props?)` | Record an event (level cleared, item bought, ad watched…) | Batched and sent after 5 seconds – see [Game events](#su-kien-game) |
| `GameHub.flush()` | Send pending events now | `Promise<{ sent }>` |
| `GameHub.showRewardedAd()` | The player chooses to watch an ad for a reward | `Promise<{ shown, rewarded, reason? }>` – **only reward when `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Between levels | `Promise<{ shown }>` |
| `GameHub.on(event, callback)` | Listen to the hub | See [Events](#su-kien) |

### The score sent by `gameOver(score)` {#diem-gui-len}

The SDK normalises the score before sending: `Math.max(0, Math.floor(Number(score) || 0))` – rounded down, negatives become 0. If `score` is **not a number** (`NaN`, `undefined`, `"abc"`…) the SDK logs a console warning and **submits 0** instead of failing – so `SCORE_INVALID` almost only appears when the score is outside the board's allowed range. Make sure your score variable is always a number.

### `gameOver()` result {#ket-qua-gameover}

Since **SDK v3**, `gameOver()` returns a `Promise` of the result in every mode (on the hub, in Playtest, opened directly, [outside the hub](/en/ngoai-hub)) and also emits `scoreResult`. The recommended way is to handle the **event** – it works with every hub version:

```js
GameHub.on("scoreResult", (r) => showResult(r.message, r.saved));
GameHub.gameOver(score);              // no need to await
// or: const r = await GameHub.gameOver(score);
```

No reply from the hub within 20 seconds → `{ saved: false, code: "TIMEOUT" }`. Opened directly (outside the hub) → `code: "STANDALONE"`.

### `init` data

```js
{
  protocolVersion: 1,
  standalone: false,      // true when the game is opened directly, not through the hub
  locale: "en",           // "vi" | "en"
  player: { displayName: "ha_pham" } | null,
  canSubmitScore: true,   // false = the player hasn't connected a wallet, scores won't be saved
  ads: { rewarded: false, interstitial: false } // which ads are available – false: hide "watch an ad" buttons
}
```

`init()` waits up to **3 seconds** for the hub; after that it returns `standalone: true`. The hub can still send `INIT` later (slow device, slow network) through the `init` event – so **always register `GameHub.on("init", …)`** with the same handler.

When `canSubmitScore` is `false`, show a small hint such as *"Connect your wallet on Game Hub to save your score"* – the game still plays normally.

## Events {#su-kien}

| Event | When |
| --- | --- |
| `init` | Sent again when the player connects a wallet or switches language while on the game page – update your text and the save hint |
| `scoreResult` | After `gameOver()`: the result of saving the score |
| `pause` / `resume` | The hub asks the game to pause / continue (for interstitial ads) |

### `scoreResult` data {#du-lieu-scoreresult}

```js
{
  saved: true,              // false = the score was NOT recorded
  code: null,               // when saved = false: an error code, see the Leaderboards page
  message: "New best: 1,696 points! You're rank #3",  // already in the player's language
  score: 1696, best: 1696, rank: 3, isNewBest: true    // only when saved = true; score is a NUMBER
}
```

::: tip Always show `message` to the player
Especially when `saved: false` – don't let players think their score was saved. Error codes are listed in [Leaderboards & anti-cheat](/en/bang-xep-hang#ma-loi).
:::

## Saving progress {#luu-tien-trinh}

On the hub the game runs in an isolated frame, so **`localStorage` / IndexedDB / cookies always fail** ([why](/en/moi-truong#luu-du-lieu)). Use these two SDK functions:

```js
// When the game loads
const save = (await GameHub.loadState()) ?? { level: 1, coins: 0, sound: true };

// When progress changes (level cleared, item bought, setting changed)
save.level = 2;
const r = await GameHub.saveState(save);   // { saved: true, code: null }
```

- `data` is any JSON value (object, array, number, string), up to **64KB** (UTF-8) after `JSON.stringify`. Each save **overwrites** the previous one.
- **Players with a connected wallet:** the hub stores it **per account** on the server (plus a copy in the browser) → it follows them to other devices and browsers. Progress made **before connecting a wallet** on that device is moved to the account on the first `loadState()` after connecting (if the account has no save for that game yet).
- **Guests (no wallet):** stored in the browser, one slot per game; clearing browser data removes it.
- If two devices save, the **last save wins** – merge in your game before calling `saveState()` if you need to.
- The **Playtest** page uses a separate slot per build, so it never overwrites real progress.
- [Outside the hub](/en/ngoai-hub) (standalone mode): players who called `login()` (wallet or guest) → stored **per account** like on the hub (`GET/POST /api/p1/state`); not logged in → the page's `localStorage`, moved to the account on the first `loadState()` after login.
- Opened directly (no hub, no `projectKey`): the page's `localStorage`.

| `code` when `saved: false` | Meaning |
| --- | --- |
| `STATE_TOO_LARGE` | Data > 64KB |
| `STATE_INVALID` | Can't be converted to JSON (e.g. circular references) |
| `STORAGE_UNAVAILABLE` | The browser blocks storage (strict private mode, quota full) |
| `SYNC_FAILED` | Comes with `saved: true`: saved in the browser but not yet on the server (offline) – the next save syncs |
| `TIMEOUT` | The hub didn't reply within 5 seconds |

## Game events (track) {#su-kien-game}

Count what players do in your game – no separate analytics library needed (Google Analytics, Amplitude… rely on cookies / localStorage and **don't work** inside the hub's isolated frame).

```js
GameHub.track("level_complete", { level: 3, mode: "normal" });
GameHub.track("revive_offer_shown");
GameHub.track("ad_rewarded");
```

- **Name:** letters, digits and `_ . : -`, up to 64 characters (e.g. `level_complete`, `shop:buy`). Invalid names → console warning, ignored.
- **props** (optional): up to 10 keys; values are strings (≤ 100 characters), numbers or `true`/`false`. Other types are dropped.
- The SDK batches events and sends them **after 5 seconds / every 20 events / when the page closes**; `GameHub.flush()` sends right away.
- See them on **Developer → your game → Game events**: totals per day (UTC), totals per name over 7 / 30 days, and the 50 most recent events with props to check your integration. Kept 95 days.
- Works on the hub and [outside the hub](/en/ngoai-hub). **Playtest** only shows them in the SDK log (not counted). Opened directly: printed to the console only.
- Don't put personal data (email, phone, wallet address) in props.
- Abuse limits: 200 distinct event names and 200,000 events per game per day.

## Ads

Game Hub **doesn't show ads yet** – the `init` data has `ads: { rewarded: false, interstitial: false }`, so **hide "watch an ad for a reward" buttons when `hub.ads.rewarded` is `false`** (don't offer something the player can't get). Calling them is still safe: `showRewardedAd()` returns `{ shown: false, rewarded: false }` and `showInterstitialAd()` returns `{ shown: false }`. Make sure the game plays normally without ads – for example, hide the "Watch an ad for a reward" button when `shown` is `false`.

If the hub doesn't reply (e.g. the game is embedded in another page), both ad functions wait up to **60 seconds** before returning `{ shown: false, rewarded: false, reason: "TIMEOUT" }` – don't lock the UI while waiting. Opened directly, they return immediately with `reason: "STANDALONE"`.

## Full example

```html
<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script>
<script>
  let score = 0;
  let playing = false;
  const note = document.getElementById("save-note");
  const result = document.getElementById("result");

  function applyHub(hub) {
    document.documentElement.lang = hub.locale;
    note.hidden = hub.standalone || hub.canSubmitScore;
  }

  GameHub.init().then(applyHub);
  GameHub.on("init", applyHub); // signed in / switched language mid-game
  GameHub.on("scoreResult", (r) => {
    result.textContent = r.message;
    result.className = r.saved ? "ok" : "error";
  });
  GameHub.on("pause", () => pauseGame());
  GameHub.on("resume", () => resumeGame()); // always handle pause / resume as a pair

  function onFirstInput() {
    if (!playing) {
      playing = true;
      score = 0;
      GameHub.gameStart();
    }
  }

  function onGameOver() {
    playing = false;
    GameHub.gameOver(score);
  }
</script>
```

## Test before submitting for review {#thu-truoc-khi-gui-duyet}

After uploading, click **Test play** on the version: the game runs exactly as on the hub (scores aren't saved) with an **SDK log** showing every message the game sends. The **SDK integration check** must show all 3 ✓ before review: the game calls `GameHub.init()`, calls `gameStart()` when a run starts, and calls `gameOver(score)` when it ends.
