---
name: lab-check
description: Apply all Tourne-Sabre Enemy Lab feedback and clean up verified completed notes when the user requests /lab-check, $lab-check, or a Lab memo check.
---

# Lab check

Work in the Tourne-Sabre checkout containing `ENEMY_NOTES.json`. Read its `AGENTS.md` and `.agents/skills/enemy-lab-workflow/SKILL.md` for the implementation workflow.

Treat `/lab-check` as a request to complete the following work:

- Read every entry, including `note` and `done`. Check completed claims against code and relevant tests; a `done` label alone is not evidence.
- Apply every unfulfilled change request in `todo` or `note`, and finish any incomplete `done` request. Preserve unrelated working changes. For art changes follow the repository pixel art workflow.
- Update behavior regression tests and `ENEMIES.md`, run the repository verification workflow, rebuild the :3001 play build, and inspect affected enemies in Lab. Report any verification that could not be completed honestly.
- Delete entries that were already fully implemented and verified at the start of this run. This cleanup is authorized by the user's `/lab-check` convention. Keep newly applied entries with their original text and timestamp, setting only `status` to `done`, so the user can review them before a later cleanup.
- Preserve informational notes that request no change, unresolved requests, and entries edited by the user during the run. Re-read the file before writing and modify an entry only if its text, status and timestamp still match the version inspected.
- Report the applied enemies, removed completed entries, verification results and any remaining requests. Do not clear the file wholesale or touch `tools/feedback/feedback.json`; that belongs to the separate skill/augment feedback workflow.
