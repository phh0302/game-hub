# Game Hub SDK

The SDK is a small JavaScript file that lets your game talk to the hub: receive the language and player info, and report the start and end of each run so scores get saved.

## Include the SDK

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
```

Use the **full URL** as above – your build is served from a different domain than the hub. The SDK creates a global `window.GameHub`.

## Functions

| Function | When to call | Result |
| --- | --- | --- |
| `GameHub.init()` | Once, when the game has loaded | `Promise<{ locale, player, canSubmitScore, standalone }>` |
| `GameHub.gameStart()` | A new run starts – best called on the player's **first input** | The hub starts timing the run |
| `GameHub.gameOver(score, { leaderboard })` | The run ends | The hub submits the score to leaderboard `leaderboard` (default `"default"`) → `Promise<result>` (same as [`scoreResult`](#du-lieu-scoreresult)) |
| `GameHub.saveState(data)` | Save progress (levels, items, settings) | `Promise<{ saved, code }>` – see [Saving progress](#luu-tien-trinh) |
| `GameHub.loadState()` | When the game loads | `Promise<data \| null>` |
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
  canSubmitScore: true    // false = the player hasn't connected a wallet, scores won't be saved
}
```

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

- `data` is any JSON value (object, array, number, string), up to **64KB** after `JSON.stringify`. Each save **overwrites** the previous one.
- The hub stores it **in the player's browser**, one slot per game – not synced across devices / accounts yet. Clearing browser data removes it.
- The **Playtest** page uses a separate slot per build, so it never overwrites real progress.
- Opened directly or [outside the hub](/en/ngoai-hub): stored in the page's `localStorage`.

| `code` when `saved: false` | Meaning |
| --- | --- |
| `STATE_TOO_LARGE` | Data > 64KB |
| `STATE_INVALID` | Can't be converted to JSON (e.g. circular references) |
| `STORAGE_UNAVAILABLE` | The browser blocks storage (strict private mode, quota full) |
| `TIMEOUT` | The hub didn't reply within 5 seconds |

## Ads

Game Hub **doesn't show ads yet**: `showRewardedAd()` returns `{ shown: false, rewarded: false }` and `showInterstitialAd()` returns `{ shown: false }`. Make sure the game plays normally without ads – for example, hide the "Watch an ad for a reward" button when `shown` is `false`.

If the hub doesn't reply (e.g. the game is embedded in another page), both ad functions wait up to **60 seconds** before returning `{ shown: false, rewarded: false, reason: "TIMEOUT" }` – don't lock the UI while waiting. Opened directly, they return immediately with `reason: "STANDALONE"`.

## Full example

```html
<script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
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
