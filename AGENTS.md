# Repository Guidelines

## Project Structure & Module Organization

Tourne-Sabre is a browser game with two independent npm packages:

- `frontend/src/`: React UI, canvas rendering (`canvas.js`, `mapdraw.js`), game updates (`frameUpdater.js`), and client-side game objects (`object.js`).
- `frontend/public/`: static HTML, icons, and manifest. Imported artwork such as `sword.png` lives in `frontend/src/`.
- `backend/src/app.js`: Express API and Socket.IO startup. `routes/map.js` defines game endpoints, `models/` defines Mongoose schemas, and `db/` contains persistence helpers.
- `frontend/src/*.test.js` and `setupTests.js`: frontend input, skills, and UI tests.
- `backend/src/game/`: shared AI simulation, server loop, and Node.js combat tests.

Game objects exist in both packages; check both implementations when changing shared fields or behavior. `frontend/src/gameRules.js` is a browser-safe CommonJS rules module also consumed by the backend; keep progression definitions shared.

For new pixel artwork, follow [PIXEL_ART_WORKFLOW.md](PIXEL_ART_WORKFLOW.md): generate source art with ImageGen, reconstruct with Pixel Art Fixer, then reduce each asset to at most 16 visible colors. Keep UI text and animation at display resolution.

## Build, Test, and Development Commands

Run commands from the repository root:

- `cd frontend && npm ci`: install frontend dependencies from its lockfile; repeat in `backend` for server dependencies.
- `npm start --prefix frontend`: start the React development server at `http://localhost:3000`.
- `npm start --prefix backend`: start the API on port `8080` and Socket.IO on `8081`; requires MongoDB configuration first.
- `npm run build --prefix frontend`: create the production bundle in `frontend/build/`.
- `npm test --prefix frontend`: run Jest in watch mode.
- `CI=true npm test --prefix frontend -- --watchAll=false`: run frontend tests once.

The backend has no build step. Run `npm test --prefix backend` for its Node.js AI/combat tests.

## Coding Style & Naming Conventions

Use JavaScript, ES module imports in the frontend, and CommonJS in the backend. Match adjacent code: indentation currently varies between two and four spaces. Use PascalCase for components/classes and camelCase for functions/variables; preserve existing API field names such as `sw_angle`. Keep changes focused. Frontend ESLint extends `react-app` and `react-app/jest`; no standalone formatter is configured.

## Testing Guidelines

Use Jest and React Testing Library, placing `*.test.js` files beside source files. No coverage threshold is configured. Input tests must cover physical `KeyboardEvent.code` values with Korean characters. Verify gameplay changes manually, including movement, combat, and disconnect cleanup, and record results.

## Commit & Pull Request Guidelines

History uses short, informal subjects such as `kill added`; no strict convention is established. Write descriptive subjects. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for UI changes.

## Configuration & Data Safety

Replace the hardcoded MongoDB connection with disposable local configuration before starting the backend: startup clears player/item collections and seeds items. Keep credentials out of commits. Check client URLs in `map.js`, `canvas.js`, and `setupProxy.js` when changing ports. Avoid incidental edits to tracked `backend/node_modules/` files.
