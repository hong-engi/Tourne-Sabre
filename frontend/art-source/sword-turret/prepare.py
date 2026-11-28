"""Rebuild the ImageGen sword turret using Pixel Art Fixer and 16 colors.

Usage: python3 frontend/art-source/sword-turret/prepare.py /path/to/pixel-art-fixer/python
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, sys.argv[1])
from pixelfixer.api import process

options = json.loads((HERE / 'settings.json').read_text())
source = HERE / 'source.png'
result = process(source.read_bytes(), mode='full', **options)
raw = Image.open(io.BytesIO(result.pop('png'))).convert('RGBA')
raw.save(HERE / 'fixer.png')
assert set(raw.getchannel('A').getdata()) <= {0, 255}
bbox = raw.getchannel('A').getbbox()
if not bbox:
    raise ValueError('Empty reconstruction')
raw = raw.crop(bbox)
pixels = [p[:3] for p in raw.getdata() if p[3]]
visible = Image.new('RGB', (len(pixels), 1))
visible.putdata(pixels)
palette = visible.quantize(colors=16, dither=Image.Dither.NONE)
final = raw.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
final.putalpha(raw.getchannel('A'))
dest = ROOT / 'frontend/src/assets/pixel/sword-turret.png'
dest.parent.mkdir(parents=True, exist_ok=True)
final.save(dest)
colors = len({p[:3] for p in final.getdata() if p[3]})
assert colors <= 16
assert set(final.getchannel('A').getdata()) <= {0, 255}
metadata = {
    **result,
    'source_size': list(Image.open(source).size),
    'options': options,
    'native_size': list(final.size),
    'visible_colors': colors,
    'alpha': sorted(set(final.getchannel('A').getdata())),
    'fixer_commit': 'ef376e57e1c272633ca2dbf5f29ec3fcf6596465',
    'file': str(dest.relative_to(ROOT)),
}
(HERE / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
# Only the review copy is enlarged; the runtime PNG retains every native pixel.
scale = max(1, 640 // max(final.size))
preview = final.resize((final.width * scale, final.height * scale), Image.Resampling.NEAREST)
preview.save(HERE / 'preview.png')
print(json.dumps(metadata, indent=2))
