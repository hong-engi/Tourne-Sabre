# Frontend Guidelines

- Use ES module imports; match adjacent indentation (2 or 4 spaces).
- Keep `frontend/src/gameRules.js` (CommonJS) and `frontend/src/bodyPhysics.js` browser-safe and in sync with backend usage.
- Check both frontend (`frontend/src/object.js`) and backend implementations when changing shared game object fields or behavior.
- Place `*.test.js` beside source files (Jest + React Testing Library). Input tests must cover physical `KeyboardEvent.code` values with Korean characters.
- Check client URLs in `map.js`, `canvas.js`, and `setupProxy.js` if ports change.
- When adding a new enemy type, add it to `ENEMY_NAMES` and `ENEMY_SUMMARY` in `frontend/src/enemyNames.js` and verify it in `?lab` (`EnemyLab.js`).
