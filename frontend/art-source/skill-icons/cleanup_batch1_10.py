"""Localized pixel cleanup for Batch 1 (10 skill icons: crossScar..frostMail)."""
import re
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
OUTDIR = HERE.parents[1] / 'src/assets/pixel/skills'

NAMES = ['crossScar','needleRain','iaido','sawThrow','bloodSeal','horizon','parryStance','bladeVeil','ironStance','frostMail']

def to_kebab(s):
    return re.sub(r'([A-Z])', r'-\1', s).lower()

def remove_1px_specks(im):
    removed = []
    for y in range(im.height):
        for x in range(im.width):
            if not im.getpixel((x, y))[3]: continue
            has_nbr = any(
                0 <= x+dx < im.width and 0 <= y+dy < im.height and (dx or dy) and im.getpixel((x+dx, y+dy))[3]
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            )
            if not has_nbr:
                removed.append((x, y))
                im.putpixel((x, y), (0, 0, 0, 0))
    return removed

for name in NAMES:
    im = Image.open(HERE / 'quantized' / f'{name}.png').convert('RGBA')
    removed = remove_1px_specks(im)
    fname = to_kebab(name) + '.png'
    im.save(OUTDIR / fname)
    colors = len({p[:3] for p in im.getdata() if p[3]})
    alphas = sorted(set(im.getchannel('A').getdata()))
    assert colors <= 16 and set(alphas) <= {0, 255}
    print(f'{name:12s} -> {fname:18s} size={im.size} colors={colors:2d} removed_1px={removed}')
