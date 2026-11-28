"""Normalize dark outer-edge pixels while keeping the existing silhouettes and shading."""
import json
from collections import Counter
from PIL import Image
from prepare import ASSETS, HERE, NAVY

changes = {}
for name in ('shellback', 'lancer', 'flea', 'banner'):
    original = HERE / f'{name}-before-cleanup.png'
    path = ASSETS / f'{name}.png'
    if not original.exists():
        original.write_bytes(path.read_bytes())
    im = Image.open(original).convert('RGBA')
    source = im.copy()
    changes[name] = []
    for y in range(1, im.height - 1):
        for x in range(1, im.width - 1):
            pixel = source.getpixel((x, y))
            if not pixel[3] or max(pixel[:3]) > 40 or pixel == NAVY:
                continue
            if any(not source.getpixel((x + dx, y + dy))[3]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), NAVY)
                changes[name].append([x, y, list(pixel)])
    counts = Counter(pixel for pixel in im.getdata() if pixel[3])
    if len(counts) > 16:
        closest = min((pixel for pixel in counts if pixel != NAVY),
                      key=lambda pixel: sum((a - b) ** 2 for a, b in zip(pixel[:3], NAVY[:3])))
        for y in range(im.height):
            for x in range(im.width):
                if im.getpixel((x, y)) == closest:
                    im.putpixel((x, y), NAVY)
                    changes[name].append([x, y, list(closest)])
    assert len({pixel[:3] for pixel in im.getdata() if pixel[3]}) <= 16
    assert set(im.getchannel('A').getdata()) == {0, 255}
    im.save(path)
(HERE / 'existing-cleanup.json').write_text(json.dumps(changes, separators=(',', ':')) + '\n')
