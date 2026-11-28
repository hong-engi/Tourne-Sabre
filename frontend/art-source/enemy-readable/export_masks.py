"""Export the four existing native masks without resampling their shapes."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageColor, ImageFilter

here = Path(__file__).resolve().parent
result = subprocess.check_output(['node', str(here / 'export-masks.cjs')])
for name, mask in json.loads(result).items():
    image = Image.new('RGBA', (mask['width'] + 4, mask['height'] + 4))
    for x, y, color in mask['pixels']:
        image.putpixel((x + 2, y + 2), ImageColor.getcolor(color, 'RGBA'))
    image.save(here / f'{name}-mask.png')
    outlined = Image.new('RGBA', image.size, '#101823')
    outlined.putalpha(image.getchannel('A').filter(ImageFilter.MaxFilter(3)))
    outlined.alpha_composite(image)
    assert len({p[:3] for p in outlined.getdata() if p[3]}) <= 16
    outlined.save(here.parents[1] / 'src/assets/pixel' / f'{name}.png')
