import io, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0,sys.argv[1])
from pixelfixer.api import process
here=Path(__file__).resolve().parent
for name in ['shellback','lancer','flea','banner']:
    source=Image.open(here/f'{name}-source.png').convert('RGBA')
    alpha=source.getchannel('A').point(lambda a:255 if a>=128 else 0)
    source.putalpha(alpha)
    source=source.crop(alpha.getbbox())
    data=io.BytesIO();source.save(data,format='PNG')
    step=max(source.size)/64
    result=process(data.getvalue(),mode='full',force_step=step)
    raw=Image.open(io.BytesIO(result['png'])).convert('RGBA')
    raw.save(here/f'{name}-fixer.png')
    alpha=raw.getchannel('A').point(lambda a:255 if a>=128 else 0)
    raw.putalpha(alpha);raw=raw.crop(alpha.getbbox())
    colors=[p[:3] for p in raw.getdata() if p[3]]
    palette=Image.new('RGB',(len(colors),1));palette.putdata(colors)
    palette=palette.quantize(colors=16,dither=Image.Dither.NONE)
    out=raw.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(raw.getchannel('A'))
    out.save(here/f'{name}-quantized.png')
    print(name,source.size,'step',round(step,2),'native',out.size,'colors',len({p[:3] for p in out.getdata() if p[3]}))
