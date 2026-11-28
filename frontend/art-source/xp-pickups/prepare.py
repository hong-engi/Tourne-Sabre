"""ImageGen atlas -> Pixel Art Fixer -> 16-color RGBA sprites.
Usage: python3 prepare.py /path/to/pixel-art-fixer/python
"""
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.path.insert(0,sys.argv[1])
from pixelfixer.api import process
DEST=ROOT/'frontend/src/assets/pixel'
source=Image.open(HERE/'atlas-source.png').convert('RGBA')
w,h=source.size
metadata={}
for index,name in enumerate(['xp-chip','xp-gem','xp-cluster','xp-crown']):
    x=index%2; y=index//2
    cell=source.crop((x*w//2,y*h//2,(x+1)*w//2,(y+1)*h//2))
    # Work from the original cell, retaining the source's implicit grid.
    import io
    buffer=io.BytesIO();cell.save(buffer,format='PNG')
    result=process(buffer.getvalue(),mode='full')
    raw=Image.open(io.BytesIO(result.pop('png'))).convert('RGBA')
    raw.save(HERE/f'{name}-fixer.png')
    bbox=raw.getchannel('A').getbbox()
    if not bbox: raise ValueError(f'{name}: empty reconstruction')
    raw=raw.crop(bbox)
    # Exclude transparent RGB from palette selection; preserve the binary mask.
    visible=Image.new('RGB',(sum(a>0 for a in raw.getchannel('A').getdata()),1))
    visible.putdata([p[:3] for p in raw.getdata() if p[3]])
    palette=visible.quantize(colors=16,dither=Image.Dither.NONE)
    out=raw.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(raw.getchannel('A'));out.save(DEST/f'{name}.png')
    colors={p[:3] for p in out.getdata() if p[3]}
    assert len(colors)<=16 and set(out.getchannel('A').getdata())<={0,255}
    metadata[name]={**result,'native_size':list(out.size),'visible_colors':len(colors)}
    (HERE/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(name,json.dumps(metadata[name]),flush=True)

font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',16)
preview=Image.new('RGB',(960,350),'#111e24');draw=ImageDraw.Draw(preview)
for i,(name,label,xp,height) in enumerate([('xp-chip','CHIP','1-3 XP',14),('xp-gem','GEM','4-7 XP',22),('xp-cluster','CLUSTER','8-11 XP',30),('xp-crown','CROWN','12+ XP',40)]):
    im=Image.open(DEST/f'{name}.png').convert('RGBA')
    im=im.resize((round(im.width*height/im.height),height),Image.Resampling.NEAREST)
    im=im.resize((im.width*5,im.height*5),Image.Resampling.NEAREST)
    preview.paste(im,(i*240+(240-im.width)//2,225-im.height),im)
    draw.text((i*240+32,250),f'{i+1:02} {label}',font=font,fill='#e6c87f')
    draw.text((i*240+32,280),xp,font=font,fill='#a8c4b7')
preview.save(HERE/'preview.png')
