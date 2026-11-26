# npm, TypeScript & CLI

## SDK via npm {#npm}

```bash
npm i @monlabs/sdk
```

```ts
import { GameHub, type InitData } from "@monlabs/sdk";

const hub: InitData = await GameHub.init();
GameHub.gameStart();
const result = await GameHub.gameOver(score); // result.saved, result.best, result.rank…
await GameHub.saveState({ level });
```

- Same code as `<script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js">` – use either.
- TypeScript types for every function, `init` data, score / save / ad / share results.
- Safe to import during SSR (Next.js, Nuxt…): the SDK only runs on first use in the browser.
- Standalone mode (`init({ projectKey })`) calls `https://play.monlabs.fun` by default.

## Deploy builds from the terminal {#cli}

1. Studio → **Tokens for CLI / CI** → **Create token** (shown once).
2. Log in and deploy:

```bash
npx @monlabs/cli login
npm run build
npx @monlabs/cli deploy ./dist --game my-game --version 1.0.1 --notes "Bug fixes"
```

- Zips the build folder (skipping `node_modules`, `.git`, `.env*`, `*.map`), uploads it, creates a version **pending review** and prints the [automatic scan](/en/chuan-bi-zip#scan).
- No `version` → taken from `package.json`. `monlabs.json`: `{ "game": "my-game", "dir": "dist" }`.
- `monlabs games` – your studio's games · `monlabs sandbox http://localhost:5173` – [Sandbox](/en/sdk#sandbox) link.

### GitHub Actions

```yaml
name: deploy
on: { push: { tags: ["v*"] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - run: npx @monlabs/cli deploy ./dist --game my-game --version ${GITHUB_REF_NAME#v}
        env:
          MONLABS_TOKEN: ${{ secrets.MONLABS_TOKEN }}
```

## Keeping secrets {#secrets}

| Item | Safe to expose? | Where it lives |
|---|---|---|
| API key `pk_…` (standalone mode) | Yes – public, restricted by domain | Game code |
| Secret key `sk_…`, webhook secret | **No** | Your server's environment variables |
| CLI token `mlb_…` | **No** | `MONLABS_TOKEN` / GitHub Secrets – revoke it in the Studio if leaked |

CLI tokens only work with the Studio API (no account access, no admin pages, cannot create other tokens).
Add `.env*` to `.gitignore`; the sample projects already do.
