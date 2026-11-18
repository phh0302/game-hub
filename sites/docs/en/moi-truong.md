# Runtime environment

The hub embeds your game in an **isolated frame** (an `iframe` with `sandbox="allow-scripts allow-pointer-lock"`) and serves the build from a different domain than the hub. This way a developer's game can't touch the player's account.

## What a game can do

- Run JavaScript, WebAssembly, WebGL, Canvas, Web Audio
- Lock the mouse pointer (pointer lock) for shooters and racing games
- Receive keyboard, mouse and touch input like any web page
- Talk to the hub through the [SDK](/en/sdk)

## What a game can't do

- Read the hub's cookies, pages or sign-in data
- Open popups, navigate the parent page, submit forms
- Call the hub's API directly – everything goes through the SDK (`postMessage`)
- Use `localStorage`, `IndexedDB` or cookies – save progress with [`saveState()`](#luu-du-lieu)

## No localStorage – save progress with the SDK {#luu-du-lieu}

The isolated frame has **no** `allow-same-origin`, so the game page's origin is `null`. On the hub this means:

- `localStorage`, `sessionStorage`, `indexedDB` and `document.cookie` **always throw** (`SecurityError`) – not "sometimes", every time.
- Unity: `PlayerPrefs` and the **Data Caching** option (both use IndexedDB) don't persist anything. Turn *Data Caching* off in Player Settings.

Use the SDK's **`GameHub.saveState(data)` / `GameHub.loadState()`** instead of localStorage: the hub stores JSON data (up to 64KB) in the player's browser, one slot per game. See [Saving progress](/en/sdk#luu-tien-trinh).

```js
const save = (await GameHub.loadState()) ?? { level: 1, coins: 0 };
// … after a level …
GameHub.saveState(save);
```

Any existing localStorage code must still be wrapped in `try/catch` so the game doesn't crash.

::: warning Test with "Playtest", not just by opening the file
Opening the build's `index.html` directly (outside the hub) is **not** isolated: localStorage works, so saving seems fine – then everything is lost on the hub. Always check on the **Playtest** page after uploading.
:::

## Loading the game's own files (CORS) {#cors}

Because the origin is `null`, every request to the game's own files is **cross-origin**:

- `fetch()` / `XMLHttpRequest` for JSON, audio, level files…
- `<script type="module">` (the default for Vite, Rollup, esbuild…) and dynamic `import()`
- Unity WebGL loading `.data`, `.wasm`, `.framework.js` with `fetch`

Game Hub's file storage sends `Access-Control-Allow-Origin: *` for every game file, so all of the above **works with no setup**. If you host files elsewhere (e.g. your own API), that server must also allow CORS for the `null` origin (usually `*`), and cookies won't work.

## Opening the game directly

Opening `index.html` directly (not through the hub) still works: the SDK switches to standalone mode, `init()` returns `standalone: true`, scores aren't saved (`gameOver()` returns `code: "STANDALONE"`) and `saveState()` uses the page's localStorage. Handy for quick local tests – but re-check on **Playtest**, because on the hub the game runs in the isolated frame ([differences](#luu-du-lieu)).

## Screen size

The game frame follows the page: it fits the content column on desktop, spans the full width on phones, and has a **Fullscreen** button. Design a layout that scales with the frame instead of fixed pixels.

## Pausing {#tam-dung}

When the player switches tabs or minimizes the browser, the game should stop its loop and music on its own:

```js
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
```

The SDK also has `pause` / `resume` events (see [SDK](/en/sdk#su-kien)) – listen for them now; the hub will use them for interstitial ads later.
