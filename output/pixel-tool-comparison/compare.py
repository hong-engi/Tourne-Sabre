"""Compare upstream converters without modifying runtime assets.
Usage: python3 compare.py /path/to/snapper-binary /path/to/pixel-art-fixer/python
Dependencies: Pillow, numpy, scipy, opencv-python (Fixer's requirements).
"""
import json, subprocess, sys, time
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, sys.argv[2])
from pixelfixer.api import process

for directory in ['input', 'snapper', 'fixer']:
    (HERE / directory).mkdir(exist_ok=True)
atlas = Image.open(ROOT / 'frontend/art-source/pixel/atlas-source.png').convert('RGBA')
w, h = atlas.size
for name, (x,y) in {'knight':(0,0), 'enemy':(1,0), 'sabre':(0,1), 'shard':(1,1)}.items():
    atlas.crop((x*w//2,y*h//2,(x+1)*w//2,(y+1)*h//2)).save(HERE / 'input' / f'{name}.png')
Image.open(ROOT / 'frontend/art-source/pixel/floor-source.png').save(HERE / 'input/floor.png')
records = []
for name in ['knight', 'enemy', 'sabre', 'shard', 'floor']:
    source = HERE / 'input' / f'{name}.png'
    for tool in ['snapper', 'fixer']:
        output = HERE / tool / f'{name}.png'
        start = time.perf_counter()
        if tool == 'snapper':
            result = subprocess.run([sys.argv[1], str(source), str(output), '16'], capture_output=True, text=True, check=True)
            metadata = {'log': result.stdout}
        else:
            result = process(source.read_bytes(), mode='full')
            output.write_bytes(result.pop('png'))
            metadata = result
        img = Image.open(output).convert('RGBA')
        alphas = {p[3] for p in img.getdata()}
        colors = {p[:3] for p in img.getdata() if p[3] > 0}
        record = dict(asset=name,tool=tool,input_size=Image.open(source).size,output_size=img.size,
                      seconds=round(time.perf_counter()-start,3),visible_rgb_colors=len(colors),
                      alpha_values=sorted(alphas),**metadata)
        records.append(record)
        (HERE / 'results.json').write_text(json.dumps(records, indent=2))
        print(json.dumps(record), flush=True)
