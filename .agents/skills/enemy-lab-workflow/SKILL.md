---
name: enemy-lab-workflow
description: >-
  Use this skill when the user says enemy notes are ready, asks to apply fixes
  from ENEMY_NOTES.json, or adds/modifies enemy types, AI, or enemy art.
---

# Enemy Lab & Bestiary Workflow

Follow this procedure when applying enemy fix notes or adding/updating enemies in Tourne-Sabre. Read [LAB.md](../../../LAB.md) first for how the Lab (도감) is built and where its files live.

## 1. Read Enemy Notes

1. Read `ENEMY_NOTES.json` at the repository root (`{type: {text, status, updatedAt}}`, where `status` is `note`, `todo`, or `done`).
2. Identify every `todo` entry and any `note` entry that clearly requests a change.
3. For `/lab-check` or an explicit completed-note cleanup request, follow `../lab-check/SKILL.md`: verify and remove previously completed entries, while keeping newly applied entries for review.
4. **Never delete or rewrite the user's `text` without authorization. An explicit cleanup request authorizes removal of verified completed entries.**

## 2. Apply Changes

1. Update enemy stats, behavior, and AI in `backend/src/game/bestiary.js` and `backend/src/game/enemies.js`.
2. Update enemy rendering/art in `frontend/src/mapdraw.js` and `frontend/src/enemyArt.js`.
3. When adding a new enemy type:
   - Add it to `ENEMY_NAMES` and `ENEMY_SUMMARY` in `frontend/src/enemyNames.js`.
   - Document it in `ENEMIES.md`.
   - Note that Enemy Lab (`http://localhost:3000/?lab` or `http://localhost:3001/?lab`, with `&enemy=<type>`) lists every non-part type from `TYPES` automatically.
4. Update `ENEMIES.md` for any behavior/stat changes.

## 3. Update Status, Tests, & Play Build

1. Update `ENEMY_NOTES.json` by setting **only** the applied entries' `status` to `"done"` while keeping the user's `text` untouched.
2. Run backend tests: `npm test --prefix backend` (note: use `ENEMY_NOTES_FILE` env override in tests rather than touching root `ENEMY_NOTES.json`).
3. Run frontend tests: `CI=true npm test --prefix frontend -- --watchAll=false`
4. Rebuild the `:3001` play build: `npm run build --prefix frontend`
5. Verify the enemy in Enemy Lab (`?lab`) with the backend running before calling it done.
