"""Prepare the remaining expansion icons. Keeps originals and intermediate PNGs."""
import argparse
from collections import Counter
import io
import json
from pathlib import Path
import re
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEST = ROOT / 'frontend/src/assets/pixel/skills'
INK = (11, 18, 32, 255)
BATCHES = {
    'W': 'bloodPact mirrorShield swordWall thornCloak sanctuary timeShell fortress',
    'E': 'hookStep afterimage chainRush magnetLeap retreatGust beatWalk stormTrail',
    'R': 'bladeRain gravityWell phoenix execCircle timeGarden kingsMarch',
    'DF': 'markShot anchor warBanner twinGate bloodFuel freezeWave oath emberBloom lifeAnchor secondDawn',
}

def filename(name):
    return re.sub(r'[A-Z]', lambda c: '-' + c.group().lower(), name) + '.png'

def cleanup(image):
    """Recolor edge ink and discard detached single pixel noise, with a pixel log."""
    source = image.copy()
    changed = []
    for y in range(1, image.height - 1):
        for x in range(1, image.width - 1):
            old = source.getpixel((x, y))
            if not old[3]:
                continue
            neighborhood = [source.getpixel((x+dx,y+dy))
                            for dy in (-1,0,1) for dx in (-1,0,1) if dx or dy]
            visible = [c for c in neighborhood if c[3]]
            new = old
            if not visible:
                new = (0, 0, 0, 0)
            elif len(visible) < 8 and old[0] <= 28 and old[1] <= 30 and old[2] <= 64:
                new = INK
            elif len(visible) == 8:
                cluster, count = Counter(visible).most_common(1)[0]
                if count >= 7 and old not in visible and sum(abs(a-b) for a,b in zip(old,cluster)) <= 45:
                    new = cluster
            if old != new:
                image.putpixel((x, y), new)
                changed.append([x, y, list(old), list(new)])
    return changed

def make_icon(name, process):
    source_path = HERE / 'sources' / f'{name}.png'
    source = Image.open(source_path).convert('RGBA')
    step = max(source.size) / 48
    fixed = process(source_path.read_bytes(), mode='full', force_step=step)
    raw = Image.open(io.BytesIO(fixed['png'])).convert('RGBA')
    raw.save(HERE / 'fixer' / f'{name}.png')
    alpha = raw.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    raw.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f'{name}: no opaque pixels after Fixer')
    raw = raw.crop(bbox)
    pixels = [p[:3] for p in raw.getdata() if p[3]]
    palette_input = Image.new('RGB', (len(pixels), 1))
    palette_input.putdata(pixels)
    # Reserve one slot for the project's navy ink.
    palette = palette_input.quantize(colors=15, dither=Image.Dither.NONE)
    reduced = raw.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    reduced.putalpha(raw.getchannel('A'))
    side = max(reduced.size) + 2
    frame = Image.new('RGBA', (side, side))
    frame.paste(reduced, ((side-reduced.width)//2, (side-reduced.height)//2))
    frame.save(HERE / 'quantized' / f'{name}.png')
    edits = cleanup(frame)
    output = filename(name)
    colors = len({p[:3] for p in frame.getdata() if p[3]})
    box = frame.getbbox()
    assert colors <= 16 and set(frame.getchannel('A').getdata()) == {0, 255}
    assert min(box[0], box[1], side-box[2], side-box[3]) >= 1
    frame.save(DEST / output)
    return frame, {'source_size': list(source.size), 'native_size': list(frame.size),
                   'force_step': step, 'visible_colors': colors, 'file': output, 'edits': edits}

def preview(batch, frames):
    # Call the production JavaScript normalizer so the sheet matches the HUD.
    js = """
    const fs = require('node:fs');
    const vm = require('node:vm');
    const s = fs.readFileSync(process.argv[1], 'utf8').replace(/^export /gm, '');
    const normalize = vm.runInNewContext(s + '\\nnormalizeIconOutline;');
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(input.map(([data,w,h]) =>
      [32,40].map(size => Array.from(normalize(data,w,h,size).data)))));
    """
    raw = [[list(im.tobytes()), im.width, im.height] for _, im in frames]
    normalized = json.loads(subprocess.check_output(
        ['node', '-e', js, str(ROOT / 'frontend/src/skillIconOutline.js')],
        input=json.dumps(raw).encode()))
    sheet = Image.new('RGB', (600, ((len(frames)+4)//5)*135), '#172a32')
    draw = ImageDraw.Draw(sheet)
    for i, ((name, _), sizes) in enumerate(zip(frames, normalized)):
        x, y = i%5*120, i//5*135
        for j, (size, pixels) in enumerate(zip((32,40), sizes)):
            icon = Image.frombytes('RGBA', (size,size), bytes(pixels))
            bbox = icon.getbbox()
            assert bbox and min(bbox[0],bbox[1],size-bbox[2],size-bbox[3]) >= 2, name
            sheet.paste(icon, (x+12+j*44,y+16), icon)
        draw.text((x+8,y+71), name, fill='#dce8d7')
        draw.text((x+12,y+88), '32 / 40px', fill='#9cb6b1')
    sheet.save(HERE / f'remaining-{batch}-preview.png')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fixer_python')
    parser.add_argument('batch', choices=BATCHES)
    parser.add_argument('--only', nargs='+', help='Preview selected IDs in this batch without replacing its full review')
    args = parser.parse_args()
    sys.path.insert(0, args.fixer_python)
    from pixelfixer.api import process
    frames = []
    metadata = {}
    ids = BATCHES[args.batch].split()
    if args.only and set(args.only) - set(ids):
        parser.error('--only IDs must belong to the selected batch')
    for name in args.only or ids:
        frame, metadata[name] = make_icon(name, process)
        frames.append((name, frame))
        print(name, metadata[name]['native_size'], metadata[name]['visible_colors'], flush=True)
    label = args.batch + ('-sample' if args.only else '')
    preview(label, frames)
    (HERE / f'remaining-{label}-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
