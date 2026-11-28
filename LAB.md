# Lab (도감) Guide

Read this file before working on the Lab (도감) or acting on what the user wrote in it. The Lab is the in-game review page for enemies, skills, spells and augments. It shows every item with the real game code, and the user's memos are saved to files in the repository.

## Opening it

| Tab | URL (dev `:3000`, play build `:3001`) | Shows |
| --- | --- | --- |
| 몬스터 | `/?lab`, `&enemy=<type>` opens one | every enemy moving and attacking with the real server AI |
| 스킬 | `/?lab&tab=skill`, `&item=<id>` opens one | every skill |
| 주문 | `/?lab&tab=spell&item=<id>` | every spell |
| 증강 | `/?lab&tab=augment&item=<id>` | every augment, filterable by tier |

- Every tab needs the backend on `:8080` (`npm run watch --prefix backend`). The supervisor restarts it only once `GET /map/player` is empty. A restart wipes players.
- Header buttons switch tabs, and the tab is kept in the URL. In an opened item, ⌘+arrow keys move to the previous or next item, and Esc closes it.
- The older standalone page `node tools/feedback/server.js` → `http://localhost:3002` still works. It shows the same skill/spell/augment cards and saves to the same file, but it has no live arena.

## Files

| Area | Files |
| --- | --- |
| Page shell, 몬스터 tab | `frontend/src/EnemyLab.js`, `EnemyLab.css` (mounted from `index.js` when the URL has `?lab`) |
| Live arena (both kinds of tab) | `frontend/src/LabStage.js`: `LabStage`, `LabPortrait`, `makeLabPlayer(kit)`, `showLabHit` |
| 스킬/주문/증강 tabs | `frontend/src/CodexLab.js` (card list + training ground) |
| Card catalog | `frontend/src/codexCatalog.js`: `catalog(rules)`, `ORIGINAL` sketches for the 16 original abilities |
| Card preview animation | `frontend/src/codexPreview.js` (also loaded as a plain script by `tools/feedback/index.html`) |
| Trigger situations | `frontend/src/codexScenario.js`: `scenarioFor(item)`, `SITUATIONS`, `OVERRIDES` |
| Drawing | `drawLabScene` / `drawLabPortrait` in `frontend/src/mapdraw.js` (enemies, hazards, skill zones, walls, decoys, detached blades, level-up aura) |
| Enemy names | `frontend/src/enemyNames.js` (`ENEMY_NAMES`, `ENEMY_SUMMARY`, `BOSS_PATTERNS`) |
| Server sims | `backend/src/game/lab.js` (`EnemyLab`: `step`, `stepPlay`, `codexStep`, `codexReset`, notes and feedback stores) |
| Routes | `backend/src/routes/lab.js` |
| Tests | `frontend/src/EnemyLab.test.js`, `CodexLab.test.js`, `labScene.test.js`, `shared-modules.test.js`; `backend/src/game/lab.test.js` |

### Routes (`/lab/...`)

- Enemies: `GET /types`, `GET /state?types=a,b&attack=1&still=1`, `POST /step/:type` (directly controlled knight), `POST /reset/:type`, `GET /notes`, `PUT /notes/:type`.
- Codex: `POST /codex/:id/step` (body: knight pose, `poses`, `bursts`, `skillState`, `hp`, `setup`, `spellCasts`), `POST /codex/:id/reset`, `GET /feedback`, `PUT /feedback/:id`.
- In production (`NODE_ENV=production`), the note and feedback writes return 403.

## How the arenas work

- Each enemy type and each codex item runs in its own private `EnemyArena`, held at threat 1. These arenas never touch the real arena or the database, and idle ones are dropped after 60 s.
- The knight moves locally with the real client skill code (`skills.js`, `skillCasts.js`). Each poll sends sword poses and cast bursts, and the server's `skillEngine.js` owns damage, zones, statuses, heals and shields, exactly as in the game.
- **Codex training ground.** The knight carries the item in its kit: a skill sits on Q, a spell on D, and an augment comes with the skill it requires.
  - Dead pack members respawn after 0.9 s, so kill effects keep firing.
  - **자동 시전** presses the item's key at the nearest enemy every 350 ms. Keys that are still on cooldown do nothing.
  - Classic spells: heal and barrier are applied on the client. Ignite, exhaust and smite go to the server as `spellCasts`.

## Trigger situations (`codexScenario.js`)

Some effects only appear under a condition. `scenarioFor` builds that condition from the description text and from `OVERRIDES`, and the user can still flip each one in the side panel.

| Key | What the training ground does |
| --- | --- |
| `lowHp: ratio` | keeps the knight's health at that ratio (heals show, then it is clamped back) |
| `nearDeath` | starts at 6% health (causalKnot; 처음부터 resets its once-per-run use) |
| `enemyLowHp: ratio` | enemies spawn at that share of their health |
| `crowd` | a pack of 7 instead of 4 |
| `boss` | adds a `swordsaint` |
| `far` | every other enemy stands about 520 away |
| `frozen` | enemies stay where they spawn (training dummies) |
| `levelUp` | a level-up every 3 s (nova bursts with it) |
| `bigHit` | maximum health 60, so single hits are large |
| `spells: [...]` | puts these spells on the bar and auto-casts them |

**When adding or changing a skill, spell or augment:**
1. Open it in its tab and check that its effect shows.
2. If it needs a condition the description regex does not catch, add an `OVERRIDES` entry.
3. If it needs a condition that does not exist yet, add a new `SITUATIONS` key. Wire it through `setupFrom` in `CodexLab.js` and `cleanSetup`/`spawnPack` in `lab.js`.

## Card previews

- Cards draw a looping sketch from the item's `fx` / `move` / `blades` data in `skillBook.js`.
- The original 16 abilities use the `ORIGINAL` sketches instead. Exclusive augments show their required skill with the augment's patch applied.
- When adding fx fields or new abilities, keep `codexPreview.js` (and `ORIGINAL`, if needed) in step.
- `codexCatalog.js` and `codexPreview.js` are CommonJS shared with `tools/feedback`. Use no spread and no destructuring in them: Babel helpers break the production build, and `shared-modules.test.js` guards this.

## The user's memos

| Tab | Saved to | Shape |
| --- | --- | --- |
| 몬스터 | `ENEMY_NOTES.json` (repo root, `ENEMY_NOTES_FILE` overrides) | `{type: {text, status, updatedAt}}`, status `note` / `todo` / `done`; empty text removes the entry |
| 스킬/주문/증강 | `tools/feedback/feedback.json` (`SKILL_FEEDBACK_FILE` overrides) | `{id: {text, at}}`; an older entry's `verdict` is kept |

- **Enemy notes ready:** follow [.agents/skills/enemy-lab-workflow/SKILL.md](.agents/skills/enemy-lab-workflow/SKILL.md).
  - Apply every `todo` entry (and any `note` that clearly asks for a change) to `bestiary.js`/`enemies.js` and the art in `mapdraw.js`/`enemyArt.js`.
  - Update the tests and `ENEMIES.md`, then rebuild the :3001 play build.
  - Set only those entries to `done`, keeping the user's text.
  - `/lab-check` (또는 `$lab-check`) runs [.agents/skills/lab-check/SKILL.md](.agents/skills/lab-check/SKILL.md).
- **Skill feedback ready:** follow [.agents/skills/feedback-workflow/SKILL.md](.agents/skills/feedback-workflow/SKILL.md).
  - Apply each text. If it removes something, also remove the augments and combos that depend on it.
  - Update the tests and `AUGMENT.md`, then rebuild the :3001 play build.
- Never delete or rewrite the user's text in either file without asking. To record that feedback was handled, tell the user instead of editing their entries.
- **New enemy:** add it to `ENEMY_NAMES`/`ENEMY_SUMMARY` and `ENEMIES.md`. The 몬스터 tab lists every non-part type in `TYPES` automatically. Check it there before calling it done.
- **New skill, spell or augment:** it appears in its tab automatically. Describe it in friendly Korean (what it does → numbers → when to use it), and check its effect in the training ground.

## Verifying Lab changes

- Run `CI=true npm test --prefix frontend -- --watchAll=false` and `npm test --prefix backend`.
- Rebuild the play build: `NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend`. The user plays at :3001 (`python3 -m http.server 3001 --directory build`), so do not reload their game mid-run.
- A hidden or background browser pane throttles `requestAnimationFrame`, so screenshots of the arena can be stale or black. In that case, check the data instead, for example the `/lab/codex/:id/step` responses (`skillZones`, `attackHits`, `attack`).
