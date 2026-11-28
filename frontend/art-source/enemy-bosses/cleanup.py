from pathlib import Path
from PIL import Image
import json
here=Path(__file__).resolve().parent
output=here.parents[1]/'src/assets/pixel'
log={}
for name in ['forge','maestro','rootcrown','stormray','centipede']:
    im=Image.open(here/f'{name}-quantized.png').convert('RGBA')
    seen=set();removed=[]
    for y in range(im.height):
        for x in range(im.width):
            if (x,y) in seen or not im.getpixel((x,y))[3]:continue
            stack=[(x,y)];seen.add((x,y));component=[]
            while stack:
                a,b=stack.pop();component.append((a,b))
                for dy in (-1,0,1):
                    for dx in (-1,0,1):
                        q=(a+dx,b+dy)
                        if 0<=q[0]<im.width and 0<=q[1]<im.height and q not in seen and im.getpixel(q)[3]:
                            seen.add(q);stack.append(q)
            if len(component)<=2:
                for q in component:
                    removed.append([*q,list(im.getpixel(q))]);im.putpixel(q,(0,0,0,0))
    # Add a one-pixel navy silhouette, preserving the reconstructed artwork.
    canvas=Image.new('RGBA',(im.width+4,im.height+4))
    for y in range(im.height):
        for x in range(im.width):
            if im.getpixel((x,y))[3]:
                for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):
                    if not (0<=x+dx<im.width and 0<=y+dy<im.height and im.getpixel((x+dx,y+dy))[3]):
                        canvas.putpixel((x+dx+2,y+dy+2),(16,24,35,255))
    canvas.paste(im,(2,2),im)
    assert len({p[:3] for p in canvas.getdata() if p[3]})<=16
    assert set(canvas.getchannel('A').getdata())<={0,255}
    canvas.save(output/f'{name}.png')
    log[name]={'removed':removed,'final_size':canvas.size,'visible_colors':len({p[:3] for p in canvas.getdata() if p[3]})}
(here/'cleanup-log.json').write_text(json.dumps(log,indent=2)+'\n')
print(log)
