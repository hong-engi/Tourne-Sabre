"""Localized pixel cleanup for crescent and decoy skill icons.
Restores crescent's antique gold guard from fixer output and cleans warm smudges on decoy's steel helmet.
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
OUTDIR = HERE.parents[1] / 'src/assets/pixel/skills'

def restore_gold_crescent():
    im = Image.open(HERE / 'quantized/crescent.png').convert('RGBA')
    fixer = Image.open(HERE / 'fixer/crescent.png').convert('RGBA')
    a = fixer.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    fixer.putalpha(a)
    fixer = fixer.crop(a.getbbox())
    side = max(fixer.size) + 2
    ox, oy = (side - fixer.width) // 2, (side - fixer.height) // 2
    restored = 0
    for y in range(fixer.height):
        for x in range(fixer.width):
            r, g, b, al = fixer.getpixel((x, y))
            if al and (r - b) > 45 and r > 120 and g > 80:
                if r > 210 and g > 170:
                    col = (242, 200, 92, 255)
                elif r > 165:
                    col = (206, 148, 52, 255)
                else:
                    col = (142, 92, 36, 255)
                im.putpixel((ox + x, oy + y), col)
                restored += 1
    # Merge closest non-gold colors if >16
    counts = {}
    for p in im.getdata():
        if p[3]: counts[p[:3]] = counts.get(p[:3], 0) + 1
    while len(counts) > 16:
        cols = [c for c in counts if c not in {(242,200,92),(206,148,52),(142,92,36)}]
        _, c1, c2 = min(((sum((a-b)**2 for a,b in zip(c1,c2)), c1, c2)
                         for i,c1 in enumerate(cols) for c2 in cols[i+1:]), key=lambda t:t[0])
        src_c, dst_c = (c1, c2) if counts[c1] < counts[c2] else (c2, c1)
        for y in range(im.height):
            for x in range(im.width):
                if im.getpixel((x,y))[:3] == src_c and im.getpixel((x,y))[3]:
                    im.putpixel((x,y), dst_c + (255,))
        counts[dst_c] += counts.pop(src_c)
    im.save(OUTDIR / 'crescent.png')
    uniq = len({p[:3] for p in im.getdata() if p[3]})
    assert uniq <= 16 and set(im.getchannel('A').getdata()) <= {0, 255}
    print(f'crescent: restored={restored} gold px, size={im.size}, colors={uniq}')

def clean_decoy():
    im = Image.open(HERE / 'quantized/decoy.png').convert('RGBA')
    # On the steel helmet (top region y < 17), replace warm straw-brown quantization leakage with mid steel
    steel_mid = (146, 152, 168, 255)
    steel_dark = (102, 108, 128, 255)
    fixed = 0
    for y in range(1, 16):
        for x in range(im.width):
            r, g, b, al = im.getpixel((x, y))
            if al and (r - b) > 30 and r > 80:
                im.putpixel((x, y), steel_mid if r > 140 else steel_dark)
                fixed += 1
    counts = {}
    for p in im.getdata():
        if p[3]: counts[p[:3]] = counts.get(p[:3], 0) + 1
    while len(counts) > 16:
        cols = list(counts)
        _, c1, c2 = min(((sum((a-b)**2 for a,b in zip(c1,c2)), c1, c2)
                         for i,c1 in enumerate(cols) for c2 in cols[i+1:]), key=lambda t:t[0])
        src_c, dst_c = (c1, c2) if counts[c1] < counts[c2] else (c2, c1)
        for y in range(im.height):
            for x in range(im.width):
                if im.getpixel((x,y))[:3] == src_c and im.getpixel((x,y))[3]:
                    im.putpixel((x,y), dst_c + (255,))
        counts[dst_c] += counts.pop(src_c)
    im.save(OUTDIR / 'decoy.png')
    uniq = len({p[:3] for p in im.getdata() if p[3]})
    assert uniq <= 16 and set(im.getchannel('A').getdata()) <= {0, 255}
    print(f'decoy: cleaned={fixed} helmet px, size={im.size}, colors={uniq}')

restore_gold_crescent()
clean_decoy()
