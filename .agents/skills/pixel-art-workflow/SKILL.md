---
name: pixel-art-workflow
description: >-
  Use this skill when creating, regenerating, converting, or editing pixel art
  assets (icons, enemies, pickups, tiles) in Tourne-Sabre.
---

# Pixel Art Asset Workflow

Always read [PIXEL_ART_WORKFLOW.md](../../../PIXEL_ART_WORKFLOW.md) at the repository root before creating or modifying pixel artwork.

## Pipeline Summary

1. **Reference & Target Size**:
   - Match existing game assets in silhouette, proportion, pixel density, outline, shading, and light direction.
   - Design icons for actual display size (**32px / 40px**); prioritize readability over zoomed-in detail.
2. **ImageGen Source**:
   - Use ImageGen only for new assets or full redesigns. Save the raw source and exact prompt in `frontend/art-source/<set>/`.
   - If the shape is mostly right and only a few pixels are off, **edit the existing asset directly** instead of regenerating.
3. **Pixel Art Fixer & 16-Color Reduction**:
   - Convert with `process(source_bytes, mode='full')` (or justified `force_step`, recorded in the set's README).
   - Reduce visible non-transparent RGB colors to **≤ 16**, disable dithering, and keep alpha binary (`0` or `255`).
   - Preserve Fixer outputs separately from manual pixel edits.
4. **Direct Localized Pixel Cleanup**:
   - Edit on the integer pixel grid (script or pixel editor) to sharpen tips, smooth diagonal stairs, thin doubled outlines, clean intersections, open tight gaps, and remove stray pixels while preserving established proportions.
5. **In-Game & Outline Validation**:
   - Inspect at 32px/40px and integer zoom.
   - Check `frontend/src/skillIconOutline.js` (`#0b1220` 1px outline + 2px transparent padding) does not overwrite manual tip/gap fixes.
   - Save final PNGs in `frontend/src/assets/pixel/` using lowercase-hyphenated names (`xp-crown.png`); link skill icons by skill ID.
   - Keep UI text and movement/rotation/effects at display resolution (do not pixelate the whole screen or change collision radii).
