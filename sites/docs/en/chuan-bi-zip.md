# Prepare the .zip

Each game version is **one `.zip` file** containing the whole build. The hub checks the file as soon as you upload it; if it fails, the error names the offending file.

## Requirements

| Item | Limit |
| --- | --- |
| .zip size | Up to **50MB** |
| Unpacked size | Up to **150MB** (`.br` / `.gz` files counted after decompression) |
| Number of files | Up to **2000 files** |
| Entry file | `index.html` at the root of the .zip – or inside **exactly 1** wrapping folder (the hub strips that folder) |
| Version name | Letters, digits, dots, hyphens, underscores; up to 30 characters (e.g. `1.0.0`, `2024-12-beta`) |

## Allowed file extensions

Web files only. Anything else (`exe`, `php`, `sh`, …) is rejected.

| Kind | Extensions |
| --- | --- |
| Web | `html` `js` `mjs` `css` `json` `map` `txt` `xml` `csv` |
| Images | `png` `jpg` `gif` `webp` `avif` `svg` `ico` `bmp` |
| Audio / video | `mp3` `ogg` `wav` `m4a` `aac` `mp4` `webm` |
| Fonts | `woff` `woff2` `ttf` `otf` |
| Engines | `wasm` `data` `bin` `unityweb` `pck` `atlas` `fnt` `plist` `tmx` `tsx` `glb` `gltf` |
| Pre-compressed | `.br` / `.gz` versions of the above (e.g. `game.wasm.br`) |

OS junk files (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) are skipped automatically.

## Relative paths

Your build is served from storage, **not** from the root of a domain. Every asset path must be relative:

```html
<!-- Correct -->
<img src="./img/player.png" />
<script src="js/game.js"></script>

<!-- Wrong: points to the domain root and won't load -->
<img src="/img/player.png" />
```

The SDK file is the exception: use the **full URL** to the hub, `https://play.monlabs.fun/sdk/gamehub-sdk.js`.

## Unity WebGL

Compression Format **Brotli**, **Gzip** or **Disabled** all work. Pre-compressed files (e.g. `Build/game.wasm.br`) are **decompressed by the hub at upload** and served under their original names, so there's no server configuration and no need for *Decompression Fallback*.

Don't compress twice (e.g. `a.js.gz.br`) – the hub rejects it.

## No server of your own

The game runs entirely in the browser. To keep data between sessions use `localStorage` (wrapped in `try/catch`, see [Runtime environment](/en/moi-truong)); scores are saved through the [SDK](/en/sdk).

## Common upload errors

| Message | Fix |
| --- | --- |
| `index.html` not found | Put `index.html` at the root of the .zip, or zip exactly 1 folder containing it |
| Disallowed file | Remove that file from the build (usually source or installer files) |
| File too large / too many files | Compress images and audio; drop unused files; for Unity, enable a Compression Format |
| Corrupt `.br` / `.gz` file | Rebuild, or pick a different Compression Format |
