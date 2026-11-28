# Backend Guidelines

- Use CommonJS (`require` / `module.exports`); match adjacent indentation.
- Run `npm test --prefix backend` (`node --test src/game/*.test.js src/*.test.js`) after changes to `backend/src/` or shared `frontend/src/gameRules.js` / `bodyPhysics.js`.
- Never incidentally edit tracked files in `backend/node_modules/`.
- Replace hardcoded MongoDB config with disposable local configuration before starting the server (startup clears player/item collections and seeds items); keep credentials out of commits.
- Note that `npm run watch --prefix backend` (`src/supervisor.js`) only restarts after edits once `GET /map/player` is empty, because a restart wipes active players.
