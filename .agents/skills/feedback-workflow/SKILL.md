---
name: feedback-workflow
description: >-
  Use this skill when the user says skill/augment feedback is ready, asks to
  apply entries from tools/feedback/feedback.json, or adds/modifies skills,
  spells, augments, or their feedback UI previews.
---

# Skill & Augment Feedback Workflow

Follow this procedure when applying user feedback or updating skills, spells, and augments in Tourne-Sabre. Read [LAB.md](../../../LAB.md) first for how the Lab (도감) is built and where its files live.

## 1. Read Feedback Without Modifying It

1. Read `tools/feedback/feedback.json` (`{id: {text, at}}`, older entries may also have `verdict`).
2. **Never delete or overwrite `tools/feedback/feedback.json` without asking the user.** Do not edit entries to mark them handled; report handled items to the user in your response instead.

## 2. Apply Changes

1. Update shared rules and definitions in `frontend/src/gameRules.js` and `frontend/src/skillBook.js` (plus `backend/src/game/skillEngine.js` / `progression.js` as needed).
2. If feedback asks to remove a skill or spell, also remove any augments and combos that depend on it.
3. When adding new skills or augments, write descriptions in **friendly Korean sentences** following the pattern: *what it does → numbers → when to use it*.
4. When adding `fx` fields or new abilities, keep the animated card preview in `frontend/src/codexPreview.js` (and `ORIGINAL` sketches in `frontend/src/codexCatalog.js` if applicable) in step. Both the Lab codex tabs and `tools/feedback` use them. If an effect only shows under a condition (low health, kills, a boss…), add it to `OVERRIDES` in `frontend/src/codexScenario.js` so the Lab training ground builds that situation.
5. Update `AUGMENT.md` to reflect rule/augment changes.

## 3. Verify & Rebuild Play Build

1. Run frontend tests: `CI=true npm test --prefix frontend -- --watchAll=false`
2. Run backend tests: `npm test --prefix backend`
3. Rebuild the `:3001` play build: `npm run build --prefix frontend`
4. To preview locally: the Lab codex tabs (`http://localhost:3000/?lab&tab=skill|spell|augment`, needs the backend) show each item live in the real engine, and `node tools/feedback/server.js` (`http://localhost:3002`) shows the card list only. Both save to the same `tools/feedback/feedback.json`.
