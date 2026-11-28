# 검 포탑 / Sword turret

Built-in ImageGen illustration of the `turret` ability: a stationary octagonal
slate-and-steel base, gold rotating collar, teal pivot, and mounted silver sword.
The palette follows the existing teal knight and gold-hilt sword assets.

- `source.png`: original transparent ImageGen output, 1312 × 1199.
- `prompt.txt`: exact generation prompt.
- `settings.json`: Pixel Art Fixer options (automatic detection, no overrides).
- `fixer.png`: preserved reconstruction before palette reduction.
- `metadata.json`: detected grid, dimensions, palette and alpha validation.
- `preview.png`: nearest-neighbor 6× review copy, with transparency preserved.
- `prepare.py`: reproducible conversion script.
- Final: `../../src/assets/pixel/sword-turret.png`, 102 × 96, 16 visible colors.

Rebuild from the repository root:

```sh
python3 frontend/art-source/sword-turret/prepare.py /path/to/pixel-art-fixer/python
```

Pixel Art Fixer commit: `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`.
`process(source_bytes, mode='full')` detected a 108 × 99 grid. No source resize
or forced grid was used. Palette reduction excludes transparent pixels and uses
no dithering. Only fully transparent exterior margins are cropped; reconstructed
pixels and proportions are retained. The final alpha contains only 0 and 255.

Validation: enlarged final silhouette reviewed; sword, mount and pedestal remain
distinct. Dimensions, visible RGB count and binary alpha verified by the script.
This request creates artwork only; the game renderer and combat behavior were
not changed, and in-game movement/combat checks do not apply to this asset file.
