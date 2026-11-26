# Sample projects

Three projects with the full SDK integrated (scores, saved progress, events, share / invite, rewarded ads, pause). Download with `degit` (just that folder, not the whole repo):

| Sample | Command | Includes |
|---|---|---|
| **Plain HTML** | `npx degit phh0302/game-hub/templates/html-basic my-game` | One HTML + one JS file, no build step |
| **Phaser 3 + Vite + TypeScript** | `npx degit phh0302/game-hub/templates/phaser-vite-ts my-game` | Typed `@monlabs/sdk`, integration in `src/hub.ts`, GitHub Actions workflow deploying on tags |
| **Unity WebGL** | `npx degit phh0302/game-hub/templates/unity-webgl my-kit` | `.jslib` + `MonlabsHub.cs` + a WebGL template that loads the SDK |

Source: [github.com/phh0302/game-hub/tree/main/templates](https://github.com/phh0302/game-hub/tree/main/templates). CI rebuilds the samples on every change, so they always match the latest SDK.

## Workflow

1. `npm run dev` (or `npx serve game`) → try it in the [Sandbox](/en/sdk#sandbox), no upload needed.
2. Set `game` in `monlabs.json` to your game's slug.
3. `npx @monlabs/cli login` then `npx @monlabs/cli deploy` ([details](/en/cli)).

## Secrets

The samples ship a `.gitignore` for `.env*`. No key is needed inside the hub. See the [secrets table](/en/cli#secrets): `pk_…` may be public, `sk_…` and `mlb_…` tokens may not – and **never put them in `VITE_*` variables** (they get embedded in the build).
