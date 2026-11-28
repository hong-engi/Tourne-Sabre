# Tourne / Sabre

React canvas arena with server-managed AI opponents. Commands below run from the repository root.

Pixel artwork follows the [ImageGen → Pixel Art Fixer → 16 colors → direct pixel cleanup workflow](../PIXEL_ART_WORKFLOW.md). Codex finishes blade tips, outlines, gaps, and overlaps with localized pixel edits before checking the actual game size. The guide covers source preservation, conversion commands, and integration. The [16 skill/spell icons](art-source/skill-icons/README.md) include retained sources, prompts, conversion metadata, and a HUD-size preview.

## Run locally

- `npm start --prefix backend`: API `8080`, Socket.IO `8081`.
- `BROWSER=none NODE_OPTIONS=--openssl-legacy-provider npm start --prefix frontend`: UI `3000`; the OpenSSL option supports the existing react-scripts 4 toolchain on newer Node versions.
- Backend MongoDB defaults to `mongodb://127.0.0.1:27017/tourne_sabre_local`; override with `MONGODB_URI`. Startup resets players/items, so use disposable data.

## Controls

| Input | Action | Duration | Cooldown |
| --- | --- | --- | --- |
| Arrow keys | Move (diagonals normalized) | Held | — |
| Q | Reverse sword rotation | Until next reversal | 0.9s |
| W | Larger blade, increased damage | 3s | 8s |
| E | 2.6× rotation speed | 2.4s | 7s |
| R | Thrust along the sword angle captured on R press, increased damage | 0.35s | 3.5s |

Skills can stack. The HUD uses mint/check marks for ready skills, gold with a shrinking duration bar while active, and dark blue with a large countdown while recharging. Q has a brief 0.3s cast indicator. Cooldown meters use augmentation-adjusted durations; twin thrust shows its remaining charges. Input uses physical `KeyboardEvent.code` (`KeyQ` etc.), including when Korean IME reports `ㅂ/ㅈ/ㄷ/ㄱ`. Text fields and browser shortcuts are excluded; held keys do not repeatedly cast skills. Losing focus clears movement. The old QWER database-clear shortcut has been removed.

## AI opponents

- **검투사:** approaches/orbits with a rotating blade.
- **돌격수:** locks a visible charge destination for 0.85s, charges toward it, then recovers for 1.1s. The lane ends at that fixed world destination and shrinks as the monster advances; travel is capped to avoid overshooting, including at arena edges.
- **추적자:** fast flanking movement and contact attacks.

The server spawns three archetypes near active players and replenishes enemies up to a population cap. Enemy health, movement, hit cooldowns, contact invulnerability, and kill results are resolved on the server. The client receives hit/XP results and displays feedback. The existing multiplayer movement and progression remain client-driven; this is not a fully authoritative competitive server.

## Levels and augmentations

Every level grants +10 maximum/current health and +1 base attack. Level thresholds use `50 × (level − 1)²` total XP. Body collision stays circular with a fixed radius of 25.

Levels 3, 6, 9, 12, 15, then every three levels grant one choice. Use the augmentation button beside the bottom XP bar to open the tree. The four trees (폭풍/거신/관통/불굴) contain 20 nodes, with prerequisites, base-node rank limits, and at most one ultimate per run. Ultimate choices begin with the fifth offer (level 15). The server validates and saves choices for the current run; a new run starts fresh.

The tree opens automatically when a new offer is earned. Movement/attacks stop while it is open; that player is protected and ignored by AI. When every living player is choosing, the AI room freezes. Close the tree to defer a choice. Escape closes it; keyboard focus stays inside the dialog.

`src/gameRules.js` contains pure rules consumed by both the React client and the backend. `backend/src/game/progression.js` persists choices, level health increases, pickup healing, shields, and one-use last stand. AI hit resolution applies tip damage, knockback, reversal charges, shockwaves, pull, and kill-based rewards. QWER timers apply length, speed, duration, cooldown, pursuit, and two-charge thrust effects.

## Rendering and feedback

The local player updates with display frames using time-based movement. Remote positions and sword angles interpolate through a 120ms snapshot buffer; extrapolation during jitter is capped at 100ms. The buffer is visual only. Player nicknames use plain text, without panels or quote-like borders; AI monsters have no nameplates. No body hitbox outlines are rendered. Collision geometry is unchanged by visual interpolation.

Confirmed hits emit sparks, a brief white flash, small visual recoil, and floating damage; kills, level-ups, shields, and shockwaves have distinct bursts. Camera shake is bounded to a few pixels. Reduced-motion settings disable shake, flashes, and particle motion. UI/text remain at display resolution.

Level-ups follow the local player with gold ground ripples, a rising light column and sparkles that fade out within 1.5 seconds. Rapid level gains refresh the single effect. Augment pickers wait 800ms so the cue remains visible before the overlay opens; the nova explosion keeps the same delay. Reduced motion uses a stationary halo. Augment acquisition and revival retain their separate feedback.

## Checks

- `CI=true npm test --prefix frontend -- --watchAll=false`
- `npm test --prefix backend`
- `NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend`

Manual verification: arrow movement, Q reversal, stacked W/E, forward R thrust, AI pursuit/charge warning, player damage, enemy kill XP, and death/re-entry. Korean physical-key behavior is covered by composing `KeyboardEvent` tests; OS IME switching is not automated.

Skill visuals: Q draws a direction-change arrow, W adds gold blade-edge light, E draws mint rotational streaks, and R uses a straight violet trail along the captured sword angle. Thrust freezes that angle throughout extension and retraction, then resumes normal rotation; its afterimages are linear rather than rotational. Reduced motion disables cast bursts and extra wind trails.

AI entities have no `name` fields in server snapshots, and the player-name renderer explicitly rejects AI entities. Charge-lane geometry uses the same server destination as movement; interpolation/extrapolation preserves that endpoint, and visual hit recoil does not shift the ground warning.
