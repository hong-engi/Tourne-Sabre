# Repository Guidelines

## Project Structure & Module Organization

Tourne-Sabre is a browser game with two independent npm packages:

- `frontend/src/`: React UI, canvas rendering (`canvas.js`, `mapdraw.js`), game updates (`frameUpdater.js`), and client-side game objects (`object.js`).
- `frontend/public/`: static HTML, icons, and manifest. Imported artwork such as `sword.png` lives in `frontend/src/`.
- `backend/src/app.js`: Express API and Socket.IO startup. `routes/map.js` defines game endpoints, `models/` defines Mongoose schemas, and `db/` contains persistence helpers.
- `frontend/src/*.test.js` and `setupTests.js`: frontend input, skills, and UI tests.
- `backend/src/game/`: shared AI simulation, server loop, and Node.js combat tests.
- `tools/feedback/`: local skill/augment feedback page (see Feedback Workflow).
- [PIXEL_ART_WORKFLOW.md](PIXEL_ART_WORKFLOW.md): repository-root guide for pixel asset generation, Fixer conversion, 16-color reduction, and direct pixel cleanup. Read it before creating or modifying pixel artwork.

Game objects exist in both packages; check both implementations when changing shared fields or behavior. `frontend/src/gameRules.js` is a browser-safe CommonJS rules module also consumed by the backend; keep progression definitions shared.

For pixel artwork, follow [PIXEL_ART_WORKFLOW.md](PIXEL_ART_WORKFLOW.md): ImageGen source → Pixel Art Fixer → at most 16 visible colors → direct pixel cleanup → in-game validation. Finish tips, outlines, gaps, and overlaps with localized pixel edits while preserving established proportions; do not regenerate the whole image for a few-pixel defect. Preserve edits separately from converter outputs. Keep UI text and animation at display resolution.

## Build, Test, and Development Commands

Run commands from the repository root:

- `cd frontend && npm ci`: install frontend dependencies from its lockfile; repeat in `backend` for server dependencies.
- `npm start --prefix frontend`: start the React development server at `http://localhost:3000`.
- `npm start --prefix backend`: start the API on port `8080` and Socket.IO on `8081`; requires MongoDB configuration first.
- `npm run watch --prefix backend`: same server under `src/supervisor.js`, which restarts it after edits to `backend/src` or the shared `gameRules.js`/`bodyPhysics.js`, but only once `GET /map/player` is empty (a restart wipes players).
- `npm run build --prefix frontend`: create the production bundle in `frontend/build/`.
- `npm test --prefix frontend`: run Jest in watch mode.
- `CI=true npm test --prefix frontend -- --watchAll=false`: run frontend tests once.

The backend has no build step. Run `npm test --prefix backend` for its Node.js AI/combat tests.

## Feedback Workflow

The user reviews skills, spells, and augments in a local web UI. Start it with `node tools/feedback/server.js` from the repository root, then open `http://localhost:3002`. It reads `frontend/src/gameRules.js` on every request, so the list always matches the current code. No rebuild or restart is needed after rule edits.

- Each card shows an animated effect preview on the left, drawn from the skill's `fx`/`move`/`blades` data in `skillBook.js` (the original 16 abilities use the `ORIGINAL` sketches in `server.js`; exclusive augments show their required skill with the augment patch applied). When adding fx fields or new abilities, keep the preview in `index.html` in step.
- Feedback is saved to `tools/feedback/feedback.json` as `{id: {text, at}}`, keyed by skill/spell/augment id (older entries may also carry a `verdict`).
- When the user says feedback is ready, read that file and apply each text; if it asks to remove something, also remove augments and combos that depend on it. Then update tests, `AUGMENT.md`, and the :3001 play build.
- Never delete or overwrite `feedback.json` without asking. To record that items were handled, tell the user instead of editing their entries.
- When adding new skills or augments, describe them in friendly Korean sentences (what it does → numbers → when to use it) so they read well in this UI and in game.

## Enemy Lab (bestiary and fix notes)

The user reviews enemies in an in-game page that shows each enemy moving and attacking with the real server AI. Open `http://localhost:3000/?lab` (dev) or `http://localhost:3001/?lab` (play build); `&enemy=<type>` opens one enemy's detail. It needs the backend running.

- Frontend: `frontend/src/EnemyLab.js`/`EnemyLab.css` (mounted from `index.js` when the URL has `?lab`), drawn with `drawLabScene` in `mapdraw.js`. Names and one-line roles come from `enemyNames.js`.
- Backend: `backend/src/game/lab.js` runs one private `EnemyArena` per type (a dummy player circles it at threat 1; it never touches the real arena or the database). Routes in `backend/src/routes/lab.js`: `GET /lab/types`, `GET /lab/state?types=a,b&attack=1&still=1`, `POST /lab/reset/:type`, `GET /lab/notes`, `PUT /lab/notes/:type`.
- Notes are saved to `ENEMY_NOTES.json` at the repository root as `{type: {text, status, updatedAt}}`, with status `note` (memo), `todo` (fix requested) or `done` (applied). Empty text removes the entry. `ENEMY_NOTES_FILE` overrides the path (use a temp file in tests).
- When the user says enemy notes are ready, read `ENEMY_NOTES.json` and apply every `todo` entry (and any `note` that clearly asks for a change) to `bestiary.js`/`enemies.js` and the art in `mapdraw.js`/`enemyArt.js`. Then update tests, `ENEMIES.md` and the :3001 play build, and set only those entries' `status` to `done`, keeping the user's text. Never delete or rewrite their text without asking.
- When adding a new enemy type, add it to `ENEMY_NAMES` and `ENEMY_SUMMARY` in `enemyNames.js` and to `ENEMIES.md`; the lab lists every non-part type from `TYPES` automatically. Check the new enemy in the lab before calling it done.

## Coding Style & Naming Conventions

Use JavaScript, ES module imports in the frontend, and CommonJS in the backend. Match adjacent code: indentation currently varies between two and four spaces. Use PascalCase for components/classes and camelCase for functions/variables; preserve existing API field names such as `sw_angle`. Keep changes focused. Frontend ESLint extends `react-app` and `react-app/jest`; no standalone formatter is configured.

## Testing Guidelines

Use Jest and React Testing Library, placing `*.test.js` files beside source files. No coverage threshold is configured. Input tests must cover physical `KeyboardEvent.code` values with Korean characters. Verify gameplay changes manually, including movement, combat, and disconnect cleanup, and record results.

## Commit & Pull Request Guidelines

History uses short, informal subjects such as `kill added`; no strict convention is established. Write descriptive subjects. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for UI changes.

## Configuration & Data Safety

Replace the hardcoded MongoDB connection with disposable local configuration before starting the backend: startup clears player/item collections and seeds items. Keep credentials out of commits. Check client URLs in `map.js`, `canvas.js`, and `setupProxy.js` when changing ports. Avoid incidental edits to tracked `backend/node_modules/` files.
