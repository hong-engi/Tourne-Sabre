"""ImageGen sources -> Pixel Art Fixer -> <=16 visible colors.

Run from the repository root:
python3 frontend/art-source/skill-icons/prepare.py /path/to/pixel-art-fixer/python
Original sources and intermediate Fixer reconstructions are kept for review.
"""
import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEST = ROOT / 'frontend/src/assets/pixel/skills'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('fixer_python')
parser.add_argument('--only', nargs='+', help='Convert only these ability IDs')
args = parser.parse_args()
sys.path.insert(0, args.fixer_python)
from pixelfixer.api import process

DEST.mkdir(parents=True, exist_ok=True)
(HERE / 'fixer').mkdir(exist_ok=True)
specs = json.loads((HERE / 'prompts.json').read_text())
overrides = json.loads((HERE / 'overrides.json').read_text())
metadata = json.loads((HERE / 'metadata.json').read_text()) if (HERE / 'metadata.json').exists() else {}
if args.only and set(args.only) - {s['id'] for s in specs}:
    parser.error('Unknown ability ID in --only')
for spec in specs:
    name = spec['id']
    if args.only and name not in args.only:
        continue
    source = HERE / 'sources' / f'{name}.png'
    result = process(source.read_bytes(), mode='full', **overrides.get(name, {}))
    raw = Image.open(io.BytesIO(result.pop('png'))).convert('RGBA')
    raw.save(HERE / 'fixer' / f'{name}.png')
    assert set(raw.getchannel('A').getdata()) <= {0, 255}, f'{name}: non-binary alpha'
    bbox = raw.getchannel('A').getbbox()
    if not bbox:
        raise ValueError(f'{name}: empty reconstruction')
    raw = raw.crop(bbox)
    pixels = [p[:3] for p in raw.getdata() if p[3]]
    visible = Image.new('RGB', (len(pixels), 1))
    visible.putdata(pixels)
    palette = visible.quantize(colors=16, dither=Image.Dither.NONE)
    image = raw.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    image.putalpha(raw.getchannel('A'))
    # Equal square frames preserve proportions and prevent layout shifts.
    # No reconstructed pixels are resized; only transparent padding is added.
    side = max(image.size) + 2
    frame = Image.new('RGBA', (side, side))
    frame.paste(image, ((side-image.width)//2, (side-image.height)//2))
    filename = name.replace('twinBlade', 'twin-blade') + '.png'
    frame.save(DEST / filename)
    colors = len({p[:3] for p in frame.getdata() if p[3]})
    assert colors <= 16
    metadata[name] = {**result, 'source_size': list(Image.open(source).size),
                      'content_size': list(image.size), 'native_size': list(frame.size),
                      'visible_colors': colors, 'alpha': sorted(set(frame.getchannel('A').getdata())),
                      'file': filename, 'options': overrides.get(name, {})}
    (HERE / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'{name}: {frame.size}, {colors} colors', flush=True)

try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
except OSError:
    font = ImageFont.load_default()
preview = Image.new('RGB', (864, 824), '#0e191f')
draw = ImageDraw.Draw(preview)
draw.text((24, 16), 'SKILL ICONS / FIXER + 16 COLORS', fill='#dce8d7', font=font)
for i, spec in enumerate(specs):
    if spec['id'] not in metadata:
        continue
    x, y = 16 + i % 4 * 208, 52 + i // 4 * 192
    draw.rounded_rectangle((x, y, x+196, y+178), radius=4, fill='#172a32', outline='#34515a')
    icon = Image.open(DEST / metadata[spec['id']]['file']).convert('RGBA')
    factor = max(1, 100 // max(icon.size))
    enlarged = icon.resize((icon.width*factor, icon.height*factor), Image.Resampling.NEAREST)
    preview.paste(enlarged, (x+(196-enlarged.width)//2, y+6+(100-enlarged.height)//2), enlarged)
    draw.text((x+12, y+116), spec['id'], fill='#dce8d7', font=font)
    small = icon.resize((40,40), Image.Resampling.NEAREST)
    preview.paste(small, (x+12, y+136), small)
    draw.text((x+62, y+148), '40px in HUD', fill='#9cb6b1', font=font)
preview.save(HERE / 'preview.png')
