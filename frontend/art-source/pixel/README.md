# Pixel art assets

Artwork originated with the built-in ImageGen tool and is now reconstructed with Pixel Art Fixer plus a maximum 16-color palette. Source images are retained here; runtime PNGs live in `frontend/src/assets/pixel/`.

| Runtime asset | Native size | Use |
| --- | --- | --- |
| `knight.png` | 32 × 42 | Local player and HUD portrait |
| `enemy.png` | 33 × 44 | Opponent |
| `sabre.png` | 18 × 50 | Orbiting weapon and UI emblem |
| `shard.png` | 18 × 34 | Experience collectible and legend |
| `floor.png` | 64 × 64 | Repeating slate arena floor |

`frontend/public/arena-pixel.png` is the sword favicon.

## Generation prompt set

- **Atlas:** A transparent square 2 × 2 sprite atlas: teal armored knight in the top-left cell, orange horned enemy knight in the top-right, upright steel broadsword with gold guard in the bottom-left, golden faceted crystal in the bottom-right. Authentic 16-bit pixel art, equivalent to 32 × 32 source sprites, centered objects, dark stepped outlines, limited navy/teal/mint/steel/amber/orange palette, upper-left lighting, no text, no scenery, no gradients or antialiasing.
- **Background extraction edit:** Remove white/gray backdrop, cell dividers and shadows. Preserve all four sprites, their positions, outlines, colors, and internal light pixels. Output actual transparency, including gaps between horns and legs.
- **Floor:** A seamless top-down slate flagstone tile, equivalent to a 64 × 64 pixel source, four large staggered stones, chipped edges and sparse moss. Restrict colors to dark navy, slate and desaturated green; low contrast; no characters, text, perspective, gradients, or vignette.

## Integration

Approved pipeline: high-resolution source → Pixel Art Fixer reconstruction → Pillow 16-color reduction (no dithering) → trim fully transparent margins. Runtime sprites retain every reconstructed pixel; no forced tiny resize or aspect-ratio stretch is applied. Transparency is binary. The floor uses the tested `force_step=1254/64` reconstruction because automatic detection produced an unsuitable 519×512 result; its final size is 64×64 with 16 colors.

Run `python3 frontend/art-source/pixel/prepare_fixer_assets.py` to install the preserved comparison outputs. `fixer-assets.json` records native dimensions, visible color counts, and alpha values. The original game assets are preserved under `output/pixel-tool-comparison/baseline/`; the comparison scripts continue to use that historical baseline.

`mapdraw.js` prepares each pixel sprite at display resolution with nearest-neighbor enlargement, then uses smooth transforms for movement and rotation. The world and all text render directly at device resolution; there is no full-screen pixelation pass. Weapon dimensions and orbit still use the original collision fields; sprite sizes do not alter game physics.

Verified: local entry, arrow-key movement, rotating sword, HUD icons, transparent edges, and browser error logs. Existing UI tests and production build pass.

Charger and stalker art extends the native canvas sprite masks in `frontend/src/enemyArt.js`; movement, rotation, text and effects still render at device resolution.

Experience pickups now use four value-based variants. See [`../xp-pickups/README.md`](../xp-pickups/README.md) for their ImageGen → Fixer → 16-color pipeline and source prompt. The original `shard.png` remains available as an archival asset.
