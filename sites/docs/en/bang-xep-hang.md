# Leaderboards & anti-cheat

The game sends the score, but **the play time is measured by the server** – the game can't change it. Every game has a default leaderboard (`"default"`); admins can add more boards for the same game.

## How a run is counted

1. The game calls `gameStart()` → the hub opens **1 play session** on the server and starts the clock
2. The game calls `gameOver(score)` → the hub submits the score for that session; the server computes the play time since the session opened
3. The server checks the score against the leaderboard's rules (below), then saves or rejects it
4. The hub sends `scoreResult` back to the game and shows a notice to the player

Each session can submit a score **once**. A rejected run is over – it can't be resubmitted with the same session.

::: warning Call `gameStart()` on the first input
Not on page load. If a player opens the game and leaves it for a few minutes, the play time will be wrong and may exceed the limits.
:::

## Leaderboard rules

The admin sets these rules per game, based on how the game is actually played:

| Rule | Meaning | Example |
| --- | --- | --- |
| Minimum play time | Shorter runs are rejected | 2048: 5 seconds |
| Maximum session length | Sessions open too long expire | Default 6 hours |
| Allowed score range | Scores outside `minScore`–`maxScore` are rejected | Snake: at most 4,000 |
| Maximum scoring rate | Score ÷ seconds played above this is rejected | Neon Flap: 1.5 points/second |
| Order | "Higher is better" or "lower is better" | Memory: lower is better |

When submitting a game for review, put in the **release notes** the maximum achievable score and the fastest scoring rate of a skilled player, so the admin can set tight rules.

## Time-based games

For "fastest finish wins" games, send the completion time in **milliseconds**:

```js
const startedAt = performance.now();
GameHub.gameStart();
// … the player finishes …
GameHub.gameOver(Math.round(performance.now() - startedAt)); // e.g. 42700 = 42.7 seconds
```

The admin sets the board to "lower is better" with time display → the hub shows `0:42.7` instead of `42,700 points`. The server also rejects times **shorter** than what it measured by more than a few seconds, so fake times can't be sent.

## Events {#giai-dau}

Admins can open **time-limited events** for your game (e.g. "Lunar New Year Cup", Jan 20 – Feb 5) from the admin page. There are 2 kinds:

- **Events fed by the main board** (the usual kind): every valid score a player gets on the `default` board during the event also goes into the event board. **You don't need to change anything in your game.** Order, display and anti-cheat rules follow the main board.
- **Separate boards**: scores only go here when the game submits that board's key, e.g. `GameHub.gameOver(score, { leaderboard: "hard-mode" })`. Good for other modes (hard levels, daily challenges…). The admin will tell you the key.

On the game page, players can switch between the main board and events from 14 days before an event starts until 30 days after it ends. When a score enters an event, the hub also shows "Live event: rank #N".

## Players without a wallet

They can play normally, but scores aren't saved: `init` returns `canSubmitScore: false`, and `scoreResult` returns `saved: false` with code `NOT_SIGNED_IN`. If a player connects a wallet **mid-run**, that run still isn't saved (code `STARTED_BEFORE_LOGIN`) – the next run counts.

## Error codes {#ma-loi}

When `scoreResult.saved` is `false`, the `code` field gives the reason. `message` already contains an explanation in the player's language – the game just needs to show it. **Mode** column: *Hub* = the game runs inside Game Hub, *Standalone* = [outside the hub](/en/ngoai-hub) with a `projectKey`.

::: tip Don't branch on individual codes
Some situations have **different codes in the two modes** (e.g. not signed in). For one build to behave correctly in both, rely on `saved` and show `message`.
:::

| Code | Mode | Meaning |
| --- | --- | --- |
| `NOT_SIGNED_IN` | Hub | The player hasn't connected a wallet |
| `PLAYER_UNAUTHORIZED` | Standalone | No `login()` yet or the token expired (same situation as `NOT_SIGNED_IN`) |
| `STARTED_BEFORE_LOGIN` | Hub | The run started before the wallet was connected – the next run counts |
| `SESSION_NOT_STARTED` | Both | `gameOver()` without `gameStart()`, or opening the run failed. In standalone mode this is also the code for **signing in mid-run** |
| `PLAY_TOO_SHORT` | Both | The run was shorter than the minimum play time |
| `SCORE_TOO_FAST` | Both | Abnormally fast scoring |
| `SCORE_INVALID` | Both | Score outside the board's allowed range. (A non-numeric score does **not** cause this – the SDK turns it into 0, see [SDK](/en/sdk#diem-gui-len)) |
| `SESSION_ENDED` | Both | This run already submitted a score |
| `SESSION_EXPIRED` | Both | The run was open longer than the maximum |
| `SESSION_NOT_FOUND` | Both | The run doesn't exist / belongs to another player |
| `LEADERBOARD_NOT_FOUND` | Both | The board name in `gameOver(score, { leaderboard })` doesn't exist |
| `LEADERBOARD_CLOSED` | Both | The leaderboard (e.g. a time-limited event) is closed |
| `PLAYER_BANNED` | Both | The account is banned in this game |
| `SERVER_SCORING_ONLY` | Both | The game is set to "server submits scores only" ([Server API](/en/server-api)) – browser submissions are rejected |
| `QUOTA_PLAYERS` / `QUOTA_SCORES` | Standalone | The game hit its plan's monthly player / score limit |
| `RATE_LIMITED` | Both | Too many requests in a short time |
| `IP_BLOCKED` | Both | The IP flooded requests and is blocked for 15 minutes |
| `NETWORK` | Both | Couldn't reach the server |
| `TIMEOUT` | Hub | The SDK got no reply from the hub within 20 seconds |
| `STANDALONE` | – | The game file was opened directly, not through the hub – no score saved |
| `PREVIEW` | Hub | On the **Playtest** page – no score saved |
| `UNKNOWN` / `ERROR` | Hub / Standalone | Other errors |

Calling the Client API / Server API directly (without the SDK) adds `INVALID_API_KEY`, `ORIGIN_NOT_ALLOWED`, `PROJECT_DISABLED`, `INVALID_SECRET_KEY`, `VALIDATION_ERROR` – see [Outside Game Hub](/en/ngoai-hub) and [Server API](/en/server-api).
