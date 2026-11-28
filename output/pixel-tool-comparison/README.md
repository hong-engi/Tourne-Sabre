# Pixel conversion comparison

This experiment originally left runtime assets unchanged. After review, Fixer + 16 colors was selected and installed; the historical game assets are preserved in `baseline/`. This experiment starts from the saved high-resolution source images, not the already-downscaled game sprites.

## Pixel Snapper

- Source: https://github.com/Hugo-Dz/spritefusion-pixel-snapper
- Commit: `02f9315d73d3219274d17767b36d9a231a6b1f4b`
- Built locally with `cargo build --release --locked`.
- Test command: `spritefusion-pixel-snapper INPUT OUTPUT 16` (automatic grid).
- Fast conversions on this Mac: 0.03–0.48 seconds per asset, excluding build time.
- Enforces a small palette, but returns fractional alpha on sprites and can choose different grid scales for related characters.

## Pixel Art Fixer

- Source: https://github.com/Retro-Diffusion/pixel-art-fixer
- Commit: `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`
- Used the unmodified Python API: `pixelfixer.api.process(bytes, mode='full')`.
- This tests the open-source image-processing implementation, not the separate hosted neural engine.
- 1.26–6.07 seconds per asset here. Timing is not an algorithm benchmark: Snapper is compiled Rust; Fixer is Python.
- Sprite alpha is binary. Native output deliberately retains many original colors. `fixer-palette16/` is an additional Pillow palette reduction, not the tool's default output.
- Floor auto-detection produced an excessively fine grid for this game's intended low-resolution texture.

## Automatic output dimensions

Dimensions include transparent padding. The source atlas was split into four equal 627×627 cells without resize, trim, palette changes, or alpha cleanup before either converter. The floor input is 1254×1254.

| Asset | Current game | Snapper, 16 colors | Fixer, full/default color |
| --- | --- | --- | --- |
| Knight | 24×32 | 63×66 | 50×50 |
| Enemy | 26×32 | 76×76 | 51×51 |
| Sabre | 12×32 | 39×42 | 52×55 |
| Shard | 12×20 | 45×48 | 48×49 |
| Floor | 64×64 | 91×89 | 519×512 |

`comparison.png` shows current game assets, Snapper, Fixer, and Fixer with an extra 16-color reduction. Previews trim alpha >127 bounds and use integer nearest-neighbor enlargement where they fit. The 519×512 floor is a reduced nearest-neighbor preview, explicitly labeled. This is a visual comparison, not a ground-truth accuracy test; no true native original exists for these AI images.

## Floor override

The art brief requested a 64×64 tile. An additional diagnostic run uses `1254 / 64 = 19.59375` source pixels per cell for both converters:

- Snapper `--pixel-size 19.59375`: 68×71 output (its adaptive cuts still determine final dimensions).
- Fixer `force_step=19.59375`: 64×64 output.

See `floor-tuned.png` and `tuned-floor/results.json`. This is a manual target, not evidence of successful automatic detection or seamless tile edges.

## Reproduce

Clone both repositories at the commits above outside this repository. Build Snapper and install Fixer's Python requirements in your preferred environment. Then run from the repository root:

```sh
python3 output/pixel-tool-comparison/compare.py /path/to/spritefusion-pixel-snapper/target/release/spritefusion-pixel-snapper /path/to/pixel-art-fixer/python
python3 output/pixel-tool-comparison/render.py
python3 output/pixel-tool-comparison/tune_floor.py /path/to/spritefusion-pixel-snapper/target/release/spritefusion-pixel-snapper /path/to/pixel-art-fixer/python
```

The rendering scripts currently use the macOS Menlo font. Exact detections, palette/alpha statistics, and logs are in `results.json`; converter output PNGs are retained unchanged in `snapper/` and `fixer/`. No project dependencies or runtime code were changed for this experiment.

## Assessment

Both converters preserve source proportions and detail better than the existing forced tiny resize. For these characters, Fixer plus a small palette is a useful first candidate. Snapper offers faster, directly palette-limited output, but its knight/enemy scales differ. Neither automatic pipeline is sufficient for every asset: constrain floor resolution, unify character pixel scale, check alpha edges and tile seams, and inspect actual in-game sizing before replacing runtime assets.
