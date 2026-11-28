"""Install the approved Pixel Art Fixer + 16-color results, without resampling sprites.
Run from any directory with Python/Pillow after generating output/pixel-tool-comparison.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
TEST = ROOT / 'output/pixel-tool-comparison'
DEST = ROOT / 'frontend/src/assets/pixel'
baseline = TEST / 'baseline'
baseline.mkdir(exist_ok=True)
metadata = {}
for name in ['knight', 'enemy', 'sabre', 'shard', 'floor']:
    target = DEST / f'{name}.png'
    if not (baseline / target.name).exists():
        (baseline / target.name).write_bytes(target.read_bytes())
    if name == 'floor':
        # The automatically detected 519x512 floor was unsuitable; use the
        # 64x64 reconstruction with the tested force_step=1254/64 override.
        original = Image.open(TEST / 'tuned-floor/fixer.png').convert('RGBA')
        alpha = original.getchannel('A')
        image = original.convert('RGB').quantize(colors=16, dither=Image.Dither.NONE).convert('RGBA')
        image.putalpha(alpha)
    else:
        image = Image.open(TEST / 'fixer-palette16' / target.name).convert('RGBA')
        # Trim only empty margins; retain every reconstructed pixel and its color.
        bbox = image.getchannel('A').getbbox()
        if bbox: image = image.crop(bbox)
    image.save(target)
    colors = {p[:3] for p in image.getdata() if p[3]}
    alpha = {p[3] for p in image.getdata()}
    assert len(colors) <= 16 and alpha <= {0, 255}
    metadata[name] = dict(size=list(image.size), visible_colors=len(colors), alpha=sorted(alpha))
# Center the approved sword on an opaque favicon without deforming it.
sword = Image.open(DEST / 'sabre.png').convert('RGBA')
factor = max(1, 56 // sword.height)
sword = sword.resize((sword.width*factor,sword.height*factor), Image.Resampling.NEAREST)
icon = Image.new('RGBA', (64,64), '#111e24')
icon.alpha_composite(sword, ((64-sword.width)//2,(64-sword.height)//2))
icon.save(ROOT / 'frontend/public/arena-pixel.png')
Path(__file__).with_name('fixer-assets.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
