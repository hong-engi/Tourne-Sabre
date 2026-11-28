# Repository Guidelines

## Project Structure & Module Organization

Tourne-Sabre is a browser game with two independent npm packages:

- `frontend/src/`: React UI, canvas rendering (`canvas.js`, `mapdraw.js`), game updates (`frameUpdater.js`), and client-side game objects (`object.js`).
- `frontend/public/`: static HTML, icons, and manifest. Imported artwork such as `sword.png` lives in `frontend/src/`.
- `backend/src/app.js`: Express API, Socket.IO, and optional static `frontend/build/` serving on a single port (`process.env.PORT || 8080`). `routes/map.js` defines game endpoints, `models/` defines Mongoose schemas, and `db/` contains persistence helpers.
- `frontend/src/*.test.js` and `setupTests.js`: frontend input, skills, and UI tests.
- `backend/src/game/`: shared AI simulation, server loop, and Node.js combat tests.
- `tools/feedback/`: local skill/augment feedback page (see Feedback Workflow).
- [PIXEL_ART_WORKFLOW.md](PIXEL_ART_WORKFLOW.md): repository-root guide for pixel asset generation, Fixer conversion, 16-color reduction, and direct pixel cleanup. Read it before creating or modifying pixel artwork.
- [DEPLOY.md](DEPLOY.md): production deployment guide (single-port server, `Dockerfile`, `render.yaml`, MongoDB Atlas, and `MONGODB_URI` / `.env.local` handling).

Game objects exist in both packages; check both implementations when changing shared fields or behavior. `frontend/src/gameRules.js` is a browser-safe CommonJS rules module also consumed by the backend; keep progression definitions shared.

For pixel artwork, follow [PIXEL_ART_WORKFLOW.md](PIXEL_ART_WORKFLOW.md): ImageGen source → Pixel Art Fixer → at most 16 visible colors → direct pixel cleanup → in-game validation. Finish tips, outlines, gaps, and overlaps with localized pixel edits while preserving established proportions; do not regenerate the whole image for a few-pixel defect. Preserve edits separately from converter outputs. Keep UI text and animation at display resolution.

## Build, Test, and Development Commands

Run commands from the repository root:

- `cd frontend && npm ci`: install frontend dependencies from its lockfile; repeat in `backend` for server dependencies.
- `npm start --prefix frontend`: start the React development server at `http://localhost:3000`.
- `npm start --prefix backend`: start the unified API + Socket.IO server on `PORT` (default `8080`, also serves `frontend/build/` when present); requires MongoDB (`MONGODB_URI` or local `127.0.0.1:27017`).
- `npm run watch --prefix backend`: same server under `src/supervisor.js`, which restarts it after edits to `backend/src` or the shared `gameRules.js`/`bodyPhysics.js`, but only once `GET /map/player` is empty (a restart wipes players).
- `NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend`: create the production bundle in `frontend/build/` (`NODE_OPTIONS` needed on Node 18+ for `react-scripts 4`).
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

- `/lab-check` (또는 `$lab-check`) 요청은 [.agents/skills/lab-check/SKILL.md](.agents/skills/lab-check/SKILL.md)를 실행한다. 모든 Lab 메모를 확인·반영하고, 이전에 완료되어 구현까지 확인한 항목은 삭제한다. 이번에 반영한 항목은 원문을 유지한 `done` 상태로 남긴다.

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

Work directly on `main` by default for almost all tasks. Create a new branch only after receiving the user's explicit permission; do not create branches automatically for task isolation or routine workflows. If working on `main` is impractical, explain why and ask for permission before creating a branch.

History uses short, informal subjects such as `kill added`; no strict convention is established. Write descriptive subjects. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for UI changes.

## Configuration & Data Safety

Replace the hardcoded MongoDB connection with disposable local configuration before starting the backend: startup clears player/item collections and seeds items. Keep credentials out of commits (store personal `MONGODB_URI` only in gitignored `.env.local`; see [DEPLOY.md](DEPLOY.md)). Check client URL resolution in `apiConfig.js` and `setupProxy.js` when changing ports. Avoid incidental edits to tracked `backend/node_modules/` files.
