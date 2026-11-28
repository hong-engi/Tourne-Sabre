# Skill and spell icons

Sixteen icons cover the selectable QWER combat skills and DF spells in `frontend/src/gameRules.js`. Artwork uses the repository's [ImageGen → Pixel Art Fixer → 16-color workflow](../../../PIXEL_ART_WORKFLOW.md).

## Artwork and meaning

| Ability ID | Icon silhouette | Accent |
| --- | --- | --- |
| `reverse` | Sword between opposing hooked arrows | Coral |
| `giant` | Broad sword with outward expansion arrows | Gold |
| `accel` | Sword with clockwise wind crescents | Cyan |
| `thrust` | Broad diagonal sword with straight trails and tip impact | Violet |
| `dash` | Lunging sword with diagonal slash | Orange |
| `twinBlade` | Broad crossed swords with compact gold guards and center accent | Rose |
| `turret` | Sword planted on a stone pedestal | Mint / slate |
| `boomerang` | Curved throwing blade with return arrow | Blue |
| `slam` | Downward sword striking cracked ground | Amber |
| `blink` | Teleport chevrons, rift, disappearing motes | Gold |
| `ghost` | Hooded specter with trailing wisps | Ice blue |
| `heal` | Heart with medical cross | Emerald |
| `ignite` | Burning blade | Orange / crimson |
| `barrier` | Kite shield with central star | Blue / gold |
| `exhaust` | Weighted boot beneath downward chevrons | Lavender |
| `smite` | Lightning bolt ending in impact star | Yellow |

## Reproduce

The built-in ImageGen tool generated each original independently with the exact prompt in `prompts.json`. `sources/` retains the original transparent PNGs; `fixer/` retains unquantized reconstructions. Fixer commit: `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`.

```sh
python3 frontend/art-source/skill-icons/prepare.py /path/to/pixel-art-fixer/python
```

Requires Fixer's Python dependencies (Pillow, NumPy, SciPy, OpenCV). Automatic detection produced overly fine grids (some trimmed icons exceeded 130px). The reviewed setting in `overrides.json` is `force_step=max(source_width, source_height)/48`, reconstructing each source on a common 48-cell grid. This is a deliberate HUD art target, not a claim about automatic grid detection. Initial automatic results are retained in `auto-fixer/` and `auto-detection.json`.

The script runs Fixer in full mode, checks binary alpha, derives a palette from visible pixels only, quantizes to at most 16 RGB colors without dithering, and trims transparent margins. It adds a transparent square frame without resizing the reconstructed pixels. `metadata.json` records dimensions, detection results, palette counts, and conversion options; `preview.png` includes 40px HUD samples. Use `--only thrust` to rebuild one icon. The initial thin horizontal thrust source/prompt are retained as `thrust-first-*`; the final version uses a broader diagonal composition for readability.

Final assets live in `frontend/src/assets/pixel/skills/`. `SkillIcon.js` maps ability IDs to PNGs so loadout reassignment keeps the correct artwork. `KeyQ/W/E/R` aliases support the default bar. The lobby selection and combat bar share these assets. Icons remain visible under cooldown numerals; readiness and active state retain separate labels, borders, and meters. Text and gameplay animation remain at display resolution.

## Consistent display outlines

`frontend/src/skillIconOutline.js` prepares the retained PNGs for their actual UI size. It removes the varying navy source strokes, fits the colored silhouette with nearest-neighbor sampling, and reconstructs one pixel of `#0b1220` ink with two pixels of transparent outer padding. Enclosed dark details and original transparent holes are preserved. Existing near-black ink shades are merged into the common ink color, keeping the visible palette within 16 colors.

`SkillIcon.js` observes its displayed width and caches each prepared image by source and size. A 32px lobby or compact HUD icon is prepared directly on a 32px grid; a 40px picker/HUD icon uses a 40px grid. Shrinking an already outlined image would make stroke widths uneven again. This preparation applies only to skill icons; game animation and text are unchanged. `preview.png` shows the retained Fixer PNGs before this display preparation.

## Twin-blade revision

The original broad crossed swords are the selected design. A slender ImageGen revision was rejected because its proportions did not fit the game's substantial weapon shapes. The runtime PNG, source, Fixer reconstruction, and generation prompt have been restored from `revisions/twin-blade-v1/`. The rejected version is retained in `revisions/twin-blade-v2-slender/` for history.

Preserve blade width, length, crossing angle, guards, and the established steel/rose/gold palette when refining this icon. Address bluntness with local tip-pixel cleanup; do not convert the design into rapiers. Rebuild only this icon with `prepare.py /path/to/pixel-art-fixer/python --only twinBlade`. It follows the same 48-cell Fixer reconstruction and maximum 16-color reduction, then normal UI preparation at 32px and 40px. `output/twin-blade-before-after.png` is a historical comparison of the original and rejected slender revision, not the current selection.
