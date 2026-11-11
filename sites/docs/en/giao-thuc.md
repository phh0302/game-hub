# postMessage protocol

This page is for anyone who wants to **write their own SDK** – for example a plugin for Unity, Godot or a custom engine – instead of using `gamehub-sdk.js`. If your game is HTML/JavaScript, just use the [ready-made SDK](/en/sdk).

## Message format

The game and the hub talk through `window.postMessage`. Every message looks like:

```js
{ source: "gamehub", v: 1, type: "GAME_START", payload: {} }
```

- The game sends to the parent page: `window.parent.postMessage(message, "*")`
- The hub sends into the game frame; the game listens for `message` events on `window` and ignores messages without `source: "gamehub"`

## Message types

| Direction | `type` | `payload` |
| --- | --- | --- |
| game → hub | `READY` | `{ sdkVersion }` |
| hub → game | `INIT` | `{ protocolVersion, standalone, locale, player, canSubmitScore }` |
| game → hub | `GAME_START` | `{}` |
| game → hub | `GAME_OVER` | `{ score, leaderboard }` |
| game → hub | `AD_REQUEST` | `{ requestId, kind: "rewarded" \| "interstitial" }` |
| hub → game | `SCORE_RESULT` | `{ saved, code, message, score?, best?, rank?, isNewBest? }` |
| hub → game | `AD_RESULT` | `{ requestId, shown, rewarded, reason? }` |
| hub → game | `PAUSE` / `RESUME` | `{}` |

## Sequence

1. The game finishes loading → sends `READY`
2. The hub replies with `INIT` (and sends `INIT` again whenever the player signs in or switches language)
3. The player starts a run → the game sends `GAME_START`
4. The run ends → the game sends `GAME_OVER` → the hub replies with `SCORE_RESULT`

If the game isn't inside a frame (opened directly), or no `INIT` arrives within 3 seconds, the ready-made SDK treats the game as standalone and returns `standalone: true`. A custom SDK should do the same.

## Protocol version

The `v` field is the protocol version, currently `1`. It increases on incompatible changes; the hub keeps supporting games on older versions.
