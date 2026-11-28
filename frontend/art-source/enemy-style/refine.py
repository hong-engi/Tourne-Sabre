"""Refine existing pixel art without changing collision or animation."""
from collections import Counter
from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
DEST = HERE.parents[1] / 'src/assets/pixel'
NAVY = (16, 24, 35)
MASKS = {
    'bomber': ((217, 98, 58), '#a3422e', '#ef8952', '#ffc173'),
    'spitter': ((134, 201, 108), '#54864b', '#a6d278', '#ddedab'),
    'splitter': ((108, 196, 207), '#428b9b', '#9edbe1', '#cbf1ef'),
    'mite': ((108, 196, 207), '#428b9b', '#9edbe1', '#cbf1ef'),
}
BUSY = {
    'shellback': (43, 9),
    'shotbug': (44, 9),
    'skeleton': (46, 10),
}

def original(name):
    return Image.open(HERE / f'{name}-before.png').convert('RGBA')

def soften_mask_corners(im, factor):
    """Round only staircase corners at the finer grid, using existing colors."""
    out = im.resize((im.width * factor, im.height * factor), Image.Resampling.NEAREST)
    for y in range(1, im.height - 1):
        for x in range(1, im.width - 1):
            center = im.getpixel((x, y))
            for dx, dy in ((-1,-1),(-1,1),(1,-1),(1,1)):
                horizontal = im.getpixel((x+dx,y))
                vertical = im.getpixel((x,y+dy))
                if horizontal != vertical or bool(center[3]) == bool(horizontal[3]):
                    continue
                out.putpixel((x*factor+(factor-1 if dx>0 else 0),
                              y*factor+(factor-1 if dy>0 else 0)), horizontal)
    return out

def shade_mask(name):
    mid, bridge, light, glint = MASKS[name]
    base = original(name)
    factor = 2 if name == 'splitter' else 3
    im = soften_mask_corners(base, factor)
    # Use the old body pixels as a stencil. Eyes, crack, fuse and outline stay crisp.
    body = Image.new('L', im.size)
    body.putdata([255 if p[3] and p[:3] == mid else 0 for p in im.getdata()])
    x0, y0, x1, y1 = body.getbbox()
    w, h = x1 - x0, y1 - y0
    shading = Image.new('RGBA', im.size, mid + (255,))
    draw = ImageDraw.Draw(shading)
    draw.polygon([(x0,y0+h*.7),(x0+w*.35,y0+h*.85),(x1,y0+h*.58),(x1,y1),(x0,y1)], fill=bridge)
    draw.ellipse((x0+w*.04,y0+h*.04,x0+w*.68,y0+h*.64), fill=light)
    draw.line([(x0+w*.19,y0+h*.24),(x0+w*.3,y0+h*.14),(x0+w*.47,y0+h*.14)],fill=glint,width=max(1,w//12))
    im.paste(shading,(0,0),body)
    return im

def simplify(name):
    size, colors = BUSY[name]
    im = original(name)
    factor = size / max(im.size)
    im = im.resize(tuple(round(v * factor) for v in im.size), Image.Resampling.BOX)
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    pixels = [p[:3] for p in im.getdata() if p[3] >= 128]
    palette_source = Image.new('RGB', (len(pixels), 1))
    palette_source.putdata(pixels)
    palette = palette_source.quantize(colors=colors, dither=Image.Dither.NONE)
    rgb = im.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB')
    # Merge isolated interior flecks only. Preserve fine silhouette features.
    src = rgb.copy()
    for y in range(1, im.height - 1):
        for x in range(1, im.width - 1):
            neighbors = [(x+dx, y+dy) for dx,dy in ((-1,0),(1,0),(0,-1),(0,1))]
            if min(alpha.getpixel(q) for q in [(x,y), *neighbors]) != 255:
                continue
            counts = Counter(src.getpixel(q) for q in neighbors)
            color, count = counts.most_common(1)[0]
            if count >= 3 and src.getpixel((x,y)) not in counts:
                rgb.putpixel((x,y), color)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    out = out.crop(out.getbbox())
    padded = Image.new('RGBA', (out.width+4,out.height+4))
    padded.paste(out,(2,2))
    ink = Image.new('RGBA', padded.size, NAVY + (255,))
    ink.putalpha(padded.getchannel('A').filter(ImageFilter.MaxFilter(3)))
    ink.alpha_composite(padded)
    return ink

def clean_alchemist():
    im = original('alchemist')
    # Suppress the bright diffuse orbit ring while retaining flasks and vestment.
    green = {(110,196,60), (183,218,123)}
    src = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = src.getpixel((x,y))
            if a and (r,g,b) in green and ((x-27.5)/18)**2 + ((y-29.5)/23)**2 > 1:
                im.putpixel((x,y),(64,126,66,255) if g<200 else (104,162,83,255))
    return im

if __name__ == '__main__':
    report = {}
    for name in [*MASKS, *BUSY, 'alchemist']:
        im = shade_mask(name) if name in MASKS else simplify(name) if name in BUSY else clean_alchemist()
        rgb = {p[:3] for p in im.getdata() if p[3]}
        box = im.getbbox()
        assert len(rgb) <= 16 and NAVY in rgb
        assert set(im.getchannel('A').getdata()) == {0, 255}
        assert min(box[0],box[1],im.width-box[2],im.height-box[3]) >= 1
        im.save(DEST / f'{name}.png')
        report[name] = {'size': im.size, 'colors': len(rgb)}
    (HERE / 'final.json').write_text(json.dumps(report, indent=2)+'\n')
