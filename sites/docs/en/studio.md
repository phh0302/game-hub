# Studio & review

Every game on Game Hub belongs to a **studio**. Each person is in **1 studio** at most; a studio has up to **20 members**.

## Create a studio

1. Go to [play.monlabs.fun](https://play.monlabs.fun), click **Connect wallet** and sign the message in MetaMask (free, no gas)
2. Top-right menu → **Developer**
3. Enter the studio name, URL (slug) and description; accept the [Developer terms](/en/dieu-khoan) → **Create studio**

When the terms get a new version, the Developer page shows a notice; once the studio owner clicks **I agree**, the studio can create games and upload again.

## Members

| Action | Who |
| --- | --- |
| Add a member by **wallet address** | Studio owner |
| Remove a member | Studio owner |
| Transfer ownership to another member | Studio owner |
| Leave the studio | Members (the owner must transfer ownership first) |
| Create games, upload versions, edit game info | Every member |

The person being added must have **signed in to Game Hub with that wallet at least once** and not be in another studio.

## Create a game

On the Developer page → **New game**:

- **URL (slug)**: the end of the game's address, e.g. `play.monlabs.fun/games/my-game` – can't be changed later
- **Name and description** in Vietnamese / English
- **Genres**: up to 5
- **Cover image**: PNG, JPG or WEBP, up to **1MB**, **16:9** ratio

A new game starts as a **Draft** that nobody else can see. Name, description, genres and cover can be edited any time; scoring rules and game status are up to the admin.

## Upload a version

1. On the game page → **Upload version**: name the version (e.g. `1.0.0`), pick the `.zip` ([file requirements](/en/chuan-bi-zip)), add release notes if any
2. The hub checks and unpacks it → the version is **Pending review**
3. Click **Test play**: the game runs exactly as on the hub (scores aren't saved), with an SDK log – make sure all 3 ✓ checks pass ([details](/en/sdk#thu-truoc-khi-gui-duyet))

Every change to the game is a new version; old versions are kept so you can roll back.

## Review and release

An admin test-plays each version and then:

- **Approves** the first version → it automatically becomes the **live version** and the game is **published**; it appears on the home page with its own leaderboard
- **Rejects** → the reason shows right under the version on the Developer page; fix it and upload a new version

While reviewing, the admin also sets the game's [scoring rules](/en/bang-xep-hang#luat). You can see the current rules on your game page → **Scoring rules** (read-only). Rules that don't match real play (e.g. good players exceed the maximum score) cause **real scores to be rejected** – tell the admin or mention it in the version notes.

## Updating a published game {#cap-nhat}

| Question | Answer |
| --- | --- |
| Does a new version need review again? | **Yes.** Every uploaded version starts as **Pending review** and is test-played by an admin first. |
| Does the old version keep running meanwhile? | **Yes.** The game stays **Published** and players keep playing the live version (labelled *live* in the version list). A rejected update doesn't affect it either. |
| Does the new version go live as soon as it's approved? | The admin clicks **Make live** to switch (usually right when approving). For updates this isn't automatic, so the admin can choose when to switch. |
| Can I roll back? | **Yes.** All approved versions are kept; the admin makes an older one live again – no re-upload needed. You can't roll back yourself yet – message the admin with the version name. |
| Are scores and leaderboards affected? | No. Scores belong to the game, not to a version. If you change how scoring works, ask the admin to adjust the rules. |
| Players mid-run when the version changes? | They keep playing the old version until they reload. Progress saved with [`saveState()`](/en/sdk#luu-tien-trinh) is kept – if you change the data format, make the new version read the old one. |

Tip: use increasing version names (`1.0.0` → `1.0.1` → `1.1.0`) and describe changes in the notes so the admin can review quickly.

Game statuses:

| Status | Meaning |
| --- | --- |
| Draft | No version uploaded yet |
| Pending review | A version is waiting for an admin |
| Published | Visible and playable |
| Maintenance | Still visible, but play is temporarily locked |
| Suspended | Locked for a violation (e.g. after player reports) |
| Archived | Retired, data kept |

Players can click **Report** under any game (broken game, inappropriate content, copyright, score cheating); the admin handles reports and may move the game to Maintenance or Suspended.
