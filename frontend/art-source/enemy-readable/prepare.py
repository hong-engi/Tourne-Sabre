"""Keep the Fixer reconstruction and build distinct runtime sprites at game scale."""
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parents[1] / 'src/assets/pixel'
NAVY = (16, 24, 35, 255)

def convert(batch, fixer_path):
    sys.path.insert(0, fixer_path)
    from pixelfixer.api import process
    for name, size in batch.items():
        source = source_path(name)
        im = Image.open(source).convert('RGBA')
        alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
        im.putalpha(alpha)
        im = im.crop(alpha.getbbox())
        stream = io.BytesIO()
        im.save(stream, format='PNG')
        step = max(im.size) / size
        fixed = process(stream.getvalue(), mode='full', force_step=step)
        (HERE / f'{name}-fixer.png').write_bytes(fixed['png'])
        print(name, 'force_step', round(step, 4))

def source_path(name):
    return next(p for p in [HERE / f'{name}-source.png',
                            HERE.parent / 'enemy-elites' / f'{name}-source.png',
                            HERE.parent / 'enemy-normal-a' / f'{name}-source.png'] if p.exists())

def finish(name, size, edits):
    im = Image.open(HERE / f'{name}-fixer.png').convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox())
    # Quantize at the logical drawing scale so small decoration merges into broad clusters.
    logical = 34 if size == 40 else (56 if name in {'warden', 'gatekeeper', 'duelist', 'alchemist'} else 46)
    scale = logical / max(im.size)
    im = im.resize(tuple(max(1, round(v * scale)) for v in im.size), Image.Resampling.BOX)
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    visible = [p[:3] for p, a in zip(im.getdata(), alpha.getdata()) if a]
    sample = Image.new('RGB', (len(visible), 1))
    sample.putdata(visible)
    palette = sample.quantize(colors=10 if size == 40 else 12, dither=Image.Dither.NONE)
    im = im.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    im.putalpha(alpha)
    im.save(HERE / f'{name}-quantized.png')
    for x, y, rgba in edits.get(name, []):
        im.putpixel((x, y), tuple(rgba))
    im = ImageOps.expand(im, border=2)
    alpha = im.getchannel('A')
    outline = Image.new('RGBA', im.size, NAVY)
    outline.putalpha(alpha.filter(ImageFilter.MaxFilter(3)))
    outline.alpha_composite(im)
    result = outline
    visible = {p[:3] for p in result.getdata() if p[3]}
    assert len(visible) <= 16 and set(result.getchannel('A').getdata()) == {0, 255}
    filename = 'balloon-part' if name == 'balloonPart' else name
    result.save(ASSETS / f'{filename}.png')

if __name__ == '__main__':
    batches = json.loads((HERE / 'batches.json').read_text())
    edits = json.loads((HERE / 'edits.json').read_text())
    names = {name: size for batch in batches if sys.argv[2] == batch['name']
             for name, size in batch['sprites'].items()}
    assert names
    if '--finish' not in sys.argv:
        convert(names, sys.argv[1])
    for name, size in names.items():
        finish(name, size, edits)
