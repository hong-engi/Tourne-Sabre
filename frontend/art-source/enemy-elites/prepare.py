import io, sys, json
from pathlib import Path
from PIL import Image
sys.path.insert(0, sys.argv[1])
from pixelfixer.api import process
here=Path(__file__).resolve().parent
metadata={}
for name in ['warden','gatekeeper','duelist','alchemist']:
    source=Image.open(here/f'{name}-source.png').convert('RGBA')
    alpha=source.getchannel('A').point(lambda a: 255 if a>=128 else 0)
    source.putalpha(alpha); source=source.crop(alpha.getbbox())
    data=io.BytesIO();source.save(data,format='PNG')
    step=max(source.size)/64
    result=process(data.getvalue(),mode='full',force_step=step)
    raw=Image.open(io.BytesIO(result['png'])).convert('RGBA');raw.save(here/f'{name}-fixer.png')
    alpha=raw.getchannel('A').point(lambda a:255 if a>=128 else 0)
    raw.putalpha(alpha);raw=raw.crop(alpha.getbbox())
    pixels=[c[:3] for c in raw.getdata() if c[3]]
    palette=Image.new('RGB',(len(pixels),1));palette.putdata(pixels)
    # Reserve one of the 16 visible colors for the specified outline.
    palette=palette.quantize(colors=15,dither=Image.Dither.NONE)
    out=raw.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(raw.getchannel('A'))
    out.save(here/f'{name}-quantized.png')
    metadata[name]={'source_crop':source.size,'force_step':step,'native_size':out.size}
(here/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(metadata)
