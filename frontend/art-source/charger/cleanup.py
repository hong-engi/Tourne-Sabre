from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
image = Image.open(here / 'quantized-before-cleanup.png').convert('RGBA')
# Remove a dark notch in the front hoof's highlight while retaining its outline.
assert image.getpixel((14, 0)) == (10, 9, 36, 255)
image.putpixel((14, 0), (220, 173, 114, 255))
# A transparent pixel border keeps edge pixels from being clipped by filtering.
padded = Image.new('RGBA', (image.width + 2, image.height + 2))
padded.paste(image, (1, 1))
padded.save(here.parents[1] / 'src/assets/pixel/charger.png')
