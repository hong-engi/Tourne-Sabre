# Localized cleanup: preserve the original 15x66 body coordinates and palette.
# Rows 0–26 contain the spear above the helmet; keep the source unchanged.
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[2]
image = Image.open(root / "src/assets/pixel/lancer.png").convert("RGBA")
for y in range(27):
    for x in range(image.width):
        image.putpixel((x, y), (0, 0, 0, 0))
image.save(root / "src/assets/pixel/lancer-body.png")
