# Experience pickup progression

Built-in ImageGen produced `atlas-source.png` using the exact prompt in `prompt.txt`. Each of its four cells was reconstructed with Pixel Art Fixer (open-source Python implementation, full mode), reduced to at most 16 visible colors without dithering, then trimmed only at transparent margins. No forced low-resolution resize was used. Native sizes, detection results, and palette counts are recorded in `metadata.json`; unquantized reconstructions are retained as `*-fixer.png`.

| XP | Sprite | Native size | Display height |
| --- | --- | --- | --- |
| 1–3 | Amber chip (`xp-chip.png`) | 13×22 | 14 CSS px |
| 4–7 | Faceted gemstone (`xp-gem.png`) | 37×33 | 22 CSS px |
| 8–11 | Three-point cluster (`xp-cluster.png`) | 40×45 | 30 CSS px |
| 12+ | Crown cluster (`xp-crown.png`) | 57×49 | 40 CSS px |

Runtime PNGs are in `frontend/src/assets/pixel/`. Tier selection lives in `frontend/src/xpPickups.js`. Both the arena and lobby background use these tiers, and the HUD legend uses the gemstone. Experience amounts, spawning, and collision radii are unchanged. Width follows each sprite's native proportions. Bobbing uses item ID and elapsed time, independent of camera position; reduced motion disables bobbing. There is no full-screen pixelation pass.

Reproduce using the same Pixel Art Fixer checkout recorded in `../pixel/README.md` / the comparison records:

```sh
python3 frontend/art-source/xp-pickups/prepare.py /path/to/pixel-art-fixer/python
```

`preview.png` shows all four final sprites at their relative in-game sizes, magnified 5× with nearest-neighbor sampling.
