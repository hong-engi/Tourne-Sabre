# 검 포탑 본체 / Sword turret base

Corrected asset specification: strictly vertical orthographic top-down view,
stationary low circular/octagonal base only, with no sword or fixed weapon mount.
Navy/slate steel rim, concentric gold bearing ring and teal central core follow
the existing game's palette. The earlier sword-and-pedestal illustration is
preserved in `../sword-turret/` as an unused concept, not this runtime base.

## Mechanic checked in the repository

- `frontend/src/skills.js`: each turret retains its `x,y`, updates `t.angle`,
  and emits a `turret-*` blade pose with `sw_r:65` and the player's sword size.
- `frontend/src/mapdraw.js`: the turret body is drawn at its fixed center;
  `trailed` rotates the canvas by `-sw_angle` and `paintSabre` draws the existing
  sword at radius `me.r + c.sw_r`. The sword orbits the body independently.
- `backend/src/game/enemies.js`: anchored turret poses carry their own position
  and sword dimensions for combat. Artwork must not bake in a weapon pose.

`mapdraw.js` now draws this base centered in a 40 × 40 world-unit box using the
existing sprite preparation path, preserving its aspect ratio. It replaces the
old gold-outlined square and center dot. The base is stationary; the existing
separate `sabre` sprite, trail, orbit radius and combat geometry are unchanged.

## Reproduction

Built-in ImageGen edit uses the earlier illustration solely as a palette/style
reference. `prompt.txt` preserves the full revised prompt; `source.png` preserves
the new transparent generated source.

```sh
python3 frontend/art-source/sword-turret-base/prepare.py /path/to/pixel-art-fixer/python
```

Pixel Art Fixer commit: `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`.
The script processes original source bytes with `mode='full'`, preserves
`fixer.png`, reduces visible RGB colors to at most 16 without dithering, checks
binary alpha, and crops only fully transparent exterior margins. Final output:
`../../src/assets/pixel/sword-turret-base.png`. `metadata.json` records detected
grid, conversion settings, final dimensions, color count and alpha. `preview.png`
is an enlarged nearest-neighbor review copy; the final retains native pixels.

Automatic detection selected an overly fine ~7 px grid (182 × 179), leaving
noisy edge clusters. `auto-fixer.png` and `auto-metadata.json` preserve that run.
The source's repeated stair steps and ring blocks are approximately 14 px;
`force_step:14` reconstructs those clusters on a 90 × 89 grid without resizing
the source. The reviewed final is **74 × 72 pixels, 15 visible colors**, with
alpha values **0/255**. Overhead silhouette and absence of a baked-in weapon
were visually checked on the enlarged final.

Integration validation: all 11 frontend test suites (40 tests) pass; production
build passes with `NODE_OPTIONS=--openssl-legacy-provider` (required by the old
Webpack version on Node 24). No live gameplay session was run for this change;
in-game readability, movement, combat and disconnect cleanup remain unverified.
