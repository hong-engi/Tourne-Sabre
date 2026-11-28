---
name: feedback-workflow
description: >-
  Use this skill when the user says skill/augment feedback is ready, asks to
  apply entries from tools/feedback/feedback.json, or adds/modifies skills,
  spells, augments, or their feedback UI previews.
---

# Skill & Augment Feedback Workflow

Follow this procedure when applying user feedback or updating skills, spells, and augments in Tourne-Sabre.

## 1. Read Feedback Without Modifying It

1. Read `tools/feedback/feedback.json` (`{id: {text, at}}`, older entries may also have `verdict`).
2. **Never delete or overwrite `tools/feedback/feedback.json` without asking the user.** Do not edit entries to mark them handled; report handled items to the user in your response instead.

## 2. Apply Changes

1. Update shared rules and definitions in `frontend/src/gameRules.js` and `frontend/src/skillBook.js` (plus `backend/src/game/skillEngine.js` / `progression.js` as needed).
2. If feedback asks to remove a skill or spell, also remove any augments and combos that depend on it.
3. When adding new skills or augments, write descriptions in **friendly Korean sentences** following the pattern: *what it does → numbers → when to use it*.
4. When adding `fx` fields or new abilities, keep the animated preview in `tools/feedback/index.html` (and `ORIGINAL` sketches in `tools/feedback/server.js` if applicable) in step.
5. Update `AUGMENT.md` to reflect rule/augment changes.

## 3. Verify & Rebuild Play Build

1. Run frontend tests: `CI=true npm test --prefix frontend -- --watchAll=false`
2. Run backend tests: `npm test --prefix backend`
3. Rebuild the `:3001` play build: `npm run build --prefix frontend`
4. To preview the feedback UI locally if needed: `node tools/feedback/server.js` (serves on `http://localhost:3002`, reads `frontend/src/gameRules.js` on every request).
