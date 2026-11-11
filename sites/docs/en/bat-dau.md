# Getting started

**Game Hub** ([play.monlabs.fun](https://play.monlabs.fun)) is Monlabs' mini-game portal. Players play right in the browser with nothing to install; to save scores they connect a MetaMask wallet – no password, no email.

Have an HTML5 game (hand-written, Phaser, PixiJS, Construct, Godot, Unity WebGL…)? You can publish it on Game Hub yourself, without your own server.

## What you get

- **An existing player base** and a dedicated game page with cover image and Vietnamese/English description
- **Wallet sign-in** handled by the hub – your game doesn't need its own accounts
- **Leaderboards** for daily / weekly / all-time, with server-side anti-cheat checks
- **The player's language** (vi / en), sent to your game by the hub
- Your game runs on **phones and desktops**, including the MetaMask app's built-in browser

## Publish in 4 steps

1. **Create a studio** – connect your wallet on Game Hub → top-right menu → **Developer** → name your studio and accept the [terms](/en/dieu-khoan). See [Studio & review](/en/studio).
2. **Add the SDK to your game** – one `<script>` tag, then call `GameHub.gameStart()` / `GameHub.gameOver(score)`. See [Game Hub SDK](/en/sdk).
3. **Zip the game and upload it** – the hub checks and unpacks it, and you can **Test play** right away. See [Prepare the .zip](/en/chuan-bi-zip).
4. **Wait for review** – an admin plays it and approves; the game appears on the Game Hub home page with its own leaderboard.

## Quick example

```html
<!doctype html>
<html>
  <body>
    <canvas id="game"></canvas>
    <script src="https://play.monlabs.fun/sdk/gamehub-sdk.js"></script>
    <script>
      let score = 0;
      GameHub.init().then((hub) => {
        document.documentElement.lang = hub.locale; // "vi" or "en"
      });

      function onFirstInput() {
        GameHub.gameStart(); // the run starts – the hub starts timing
      }

      function onGameOver() {
        GameHub.gameOver(score); // the hub saves the score if the player has connected a wallet
      }
    </script>
  </body>
</html>
```

## Sample games

Game Hub ships 4 sample games built on this exact SDK; source code is in the [phh0302/game-hub](https://github.com/phh0302/game-hub/tree/main/public/uploads/games) repo:

| Game | Style | Score |
| --- | --- | --- |
| [2048](https://play.monlabs.fun/games/2048) | DOM, grid | cumulative points |
| [Snake](https://play.monlabs.fun/games/snake) | Canvas, tick-based loop | 10 points per food, handles `pause` |
| [Neon Flap](https://play.monlabs.fun/games/neon-flap) | Canvas, fixed-step physics | pipes passed, handles `pause` / `resume` |
| [Memory](https://play.monlabs.fun/games/memory) | DOM, card flipping | completion time, "lower is better" board |
