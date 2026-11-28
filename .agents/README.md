# Tourne-Sabre Agent Customizations

Project-level Antigravity customizations derived from `AGENTS.md` and `PIXEL_ART_WORKFLOW.md`.

## Rules
- `AGENTS.md` (repo root): Main repository guidelines.
- `frontend/AGENTS.md`: Scoped frontend conventions, Jest/input testing, and Enemy Lab UI reminders.
- `backend/AGENTS.md`: Scoped backend conventions, Node tests, `supervisor.js` restart behavior, and MongoDB/data safety.

## Skills (`.agents/skills/`)
- `feedback-workflow`: Applying `tools/feedback/feedback.json`, updating `gameRules.js`/`skillBook.js`, Korean descriptions, `AUGMENT.md`, `index.html` previews, tests, and `:3001` build.
- `enemy-lab-workflow`: Applying `ENEMY_NOTES.json`, updating `bestiary.js`/`enemies.js`/`mapdraw.js`/`enemyArt.js`/`enemyNames.js`, `ENEMIES.md`, `?lab` verification, and tests.
- `pixel-art-workflow`: ImageGen → Pixel Art Fixer → ≤16 colors → localized pixel cleanup → `skillIconOutline.js` & display-size verification.
- `verify-and-build`: Running frontend Jest tests, backend Node tests, and building `frontend/build/` (`:3001`).

## Hooks (`.agents/hooks.json`)
- `tourne-sabre-safety-guard` (`PreToolUse` via `.agents/hooks/guard.mjs`):
  - Denies edits inside tracked `backend/node_modules/`.
  - Prompts before overwriting/deleting `tools/feedback/feedback.json` or overwriting `ENEMY_NOTES.json`.

## Sidecar Template (`.agents/sidecars/`)
Antigravity discovers sidecars from global config (`~/.gemini/config/sidecars/`), not from project `.agents/`. To run the local feedback UI (`http://localhost:3002`) as a managed sidecar:

1. Copy the template globally:
   ```sh
   mkdir -p ~/.gemini/config/sidecars/tourne-sabre-feedback
   cp .agents/sidecars/tourne-sabre-feedback/sidecar.json ~/.gemini/config/sidecars/tourne-sabre-feedback/sidecar.json
   ```
2. Enable it in `~/.gemini/config/config.json`:
   ```json
   {
     "sidecars": {
       "tourne-sabre-feedback": {
         "enabled": true
       }
     }
   }
   ```
