# Level-up feedback verification

Date: 2026-11-28 (Asia/Seoul)

## Automated checks

- Frontend: `CI=true npm test --prefix frontend -- --watchAll=false --runInBand` — 15 suites, 51 tests passed.
- Backend: `npm test --prefix backend` — 39 tests passed.
- Production: `NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend` — compiled successfully.
- `git diff --check` — passed.

The progression tests cover ordinary and milestone level-ups, XP without a level-up, the existing nova burst, delayed picker opening, and further XP not postponing an existing deadline.

## Manual gameplay

Chrome at `http://localhost:3000/`, with the already running local services and a dedicated `LevelFX-check` player:

- Confirmed the gold halo, rising light, and `LEVEL UP / Lv. 2` badge during real combat alongside kill/damage feedback.
- Confirmed the badge sits above the nickname and remains readable with twin blades, giant blade, and acceleration active.
- Confirmed arrow-key movement and Q/W/E/R/F skills, subsequent level gains, and return to normal rendering after the cue expires.
- Confirmed the level 3 augment picker opens, Escape closes it, and gameplay resumes. Card selection was not exercised: the running service left the picker at its existing loading state.
- Reloaded the test tab to end the session. A read-only player-list request confirmed that `LevelFX-check` no longer remained on the server.

Reduced-motion behavior was reviewed in code (stationary halo and badge, no column/particle travel or banner translation/scale); the operating system setting was not changed during this check.

## Revision: remove overhead badge

On 2026-11-28, removed the overhead panel, border, chevrons, and `LEVEL UP / Lv. N` text. The gold aura, rising light, and sparkles remain. Reduced motion now displays only the stationary halo.

- Production build — compiled successfully.
- Targeted `src/levelUpMenu.test.js` — all 5 tests passed.
- `git diff --check` — passed; no banner renderer or `LEVEL UP` label remains in the effect source.
- Manual Chrome run with `LevelAura-check`: arrow movement, Q/W/E/R combat, progression through levels 2 and 3, and selection of the offered 시간 왜곡 augmentation worked. Reloaded afterward and confirmed the test player was removed from the server.
