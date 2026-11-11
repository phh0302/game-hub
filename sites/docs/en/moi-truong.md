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

## localStorage may be blocked

Inside the isolated frame, `localStorage` / `sessionStorage` may throw. Always wrap them in `try/catch` and keep the game playable when saving fails:

```js
function load(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // can't save – keep playing normally
  }
}

function save(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
```

## Opening the game directly

Opening `index.html` directly (not through the hub) still works: the SDK switches to standalone mode, `init()` returns `standalone: true`, and scores aren't saved. Handy for testing on your machine before uploading.

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
