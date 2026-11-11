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
| `GameHub.gameOver(score, { leaderboard })` | The run ends | The hub submits the score (integer ≥ 0) to leaderboard `leaderboard` (default `"default"`) |
| `GameHub.showRewardedAd()` | The player chooses to watch an ad for a reward | `Promise<{ shown, rewarded, reason? }>` – **only reward when `rewarded === true`** |
| `GameHub.showInterstitialAd()` | Between levels | `Promise<{ shown }>` |
| `GameHub.on(event, callback)` | Listen to the hub | See [Events](#su-kien) |

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

### `scoreResult` data

```js
{
  saved: true,              // false = the score was NOT recorded
  code: null,               // when saved = false: an error code, see the Leaderboards page
  message: "New best: 1,696 points! You're rank #3",  // already in the player's language
  score: 1696, best: 1696, rank: 3, isNewBest: true    // only when saved = true
}
```

::: tip Always show `message` to the player
Especially when `saved: false` – don't let players think their score was saved. Error codes are listed in [Leaderboards & anti-cheat](/en/bang-xep-hang#ma-loi).
:::

## Ads

Game Hub **doesn't show ads yet**: `showRewardedAd()` returns `{ shown: false, rewarded: false }` and `showInterstitialAd()` returns `{ shown: false }`. Make sure the game plays normally without ads – for example, hide the "Watch an ad for a reward" button when `shown` is `false`.

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
