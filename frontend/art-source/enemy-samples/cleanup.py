"""Localized pixel cleanup for the 4 enemy sample sprites (stalker, hound, swordsaint, crab).
Preserves quantized inputs; writes final PNGs with 1px transparent margin to frontend/src/assets/pixel/.
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
OUTDIR = HERE.parents[1] / 'src/assets/pixel'

def remove_specks(im, max_size=2):
    seen = set(); removed = []
    for y in range(im.height):
        for x in range(im.width):
            if (x, y) in seen or not im.getpixel((x, y))[3]: continue
            todo = [(x, y)]; seen.add((x, y)); comp = []
            while todo:
                a, b = todo.pop(); comp.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (a + dx, b + dy)
                        if 0 <= q[0] < im.width and 0 <= q[1] < im.height and q not in seen and im.getpixel(q)[3]:
                            seen.add(q); todo.append(q)
            if len(comp) <= max_size:
                for q in comp:
                    removed.append(q); im.putpixel(q, (0, 0, 0, 0))
    return removed

for name in ['stalker', 'hound', 'swordsaint', 'crab']:
    im = Image.open(HERE / f'{name}-quantized.png').convert('RGBA')
    removed = remove_specks(im)
    # Restore hound's glowing red-orange nose and eyes lost during 16-color quantization
    if name == 'hound':
        fixer = Image.open(HERE / 'hound-fixer.png').convert('RGBA')
        a = fixer.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        fixer.putalpha(a)
        fixer = fixer.crop(a.getbbox())
        restored = 0
        for y in range(min(im.height, fixer.height)):
            for x in range(min(im.width, fixer.width)):
                r, g, b, al = fixer.getpixel((x, y))
                if al and (r - b) > 55 and r > 150:
                    im.putpixel((x, y), (255, 118, 82, 255) if r > 200 else (204, 68, 46, 255))
                    restored += 1
        # Keep <=16 colors by merging rarest near-duplicate grey if needed
        counts = {}
        for p in im.getdata():
            if p[3]: counts[p[:3]] = counts.get(p[:3], 0) + 1
        while len(counts) > 16:
            # Find closest pair among non-red-orange colors
            cols = [c for c in counts if not ((c[0]-c[2]) > 55 and c[0] > 150)]
            best = min(((sum((a-b)**2 for a,b in zip(c1,c2)), c1, c2)
                        for i,c1 in enumerate(cols) for c2 in cols[i+1:]), key=lambda t:t[0])
            _, c1, c2 = best
            src_c, dst_c = (c1, c2) if counts[c1] < counts[c2] else (c2, c1)
            for y in range(im.height):
                for x in range(im.width):
                    if im.getpixel((x,y))[:3] == src_c and im.getpixel((x,y))[3]:
                        im.putpixel((x,y), dst_c + (255,))
            counts[dst_c] += counts.pop(src_c)
        print(f'hound restored {restored} red-orange nose/eye pixels')
    padded = Image.new('RGBA', (im.width + 2, im.height + 2))
    padded.paste(im, (1, 1))
    padded.save(OUTDIR / f'{name}.png')
    uniq = len({p[:3] for p in padded.getdata() if p[3]})
    alphas = sorted(set(padded.getchannel('A').getdata()))
    assert uniq <= 16 and set(alphas) <= {0, 255}
    print(f'{name}: removed={len(removed)} size={padded.size} colors={uniq} alphas={alphas}')
