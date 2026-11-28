---
name: verify-and-build
description: >-
  Use this skill when running the full test suite, rebuilding the production
  play build (:3001), or verifying backend/frontend changes before finishing.
---

# Verify & Play Build Workflow

Run all commands from the repository root (`/Users/stonegi/git/tourne-sabre`).

## 1. Automated Tests

1. **Frontend (Jest + React Testing Library)**:
   ```sh
   CI=true npm test --prefix frontend -- --watchAll=false
   ```
   - Ensure input tests cover physical `KeyboardEvent.code` values with Korean characters when touching input handling.
2. **Backend (Node.js test runner)**:
   ```sh
   npm test --prefix backend
   ```

## 2. Production Play Build (`:3001`)

```sh
npm run build --prefix frontend
```

## 3. Server & Manual Gameplay Checks

- If running `npm run watch --prefix backend` (`src/supervisor.js`), remember it restarts only once `GET /map/player` is empty (a restart wipes active players).
- Before starting the backend, ensure MongoDB uses a disposable local configuration (startup clears player/item collections and seeds items).
- For gameplay changes, verify movement, combat, and disconnect cleanup manually and record the results.
