from pathlib import Path
from PIL import Image
from collections import deque
here=Path(__file__).resolve().parent
outdir=here.parents[1]/'src/assets/pixel'
for name in ['shellback','lancer','flea','banner']:
    im=Image.open(here/f'{name}-quantized.png').convert('RGBA')
    # Remove detached specks of at most two pixels; retain all connected detail.
    seen=set(); removed=[]
    for y in range(im.height):
        for x in range(im.width):
            if (x,y) in seen or not im.getpixel((x,y))[3]: continue
            todo=[(x,y)];seen.add((x,y));component=[]
            while todo:
                a,b=todo.pop();component.append((a,b))
                for dx in (-1,0,1):
                    for dy in (-1,0,1):
                        q=(a+dx,b+dy)
                        if 0<=q[0]<im.width and 0<=q[1]<im.height and q not in seen and im.getpixel(q)[3]:
                            seen.add(q);todo.append(q)
            if len(component)<=2:
                for q in component:
                    removed.append((q,im.getpixel(q)));im.putpixel(q,(0,0,0,0))
    # Flea source faces left; other sprites face upward.
    if name=='flea': im=im.transpose(Image.Transpose.ROTATE_270)
    padded=Image.new('RGBA',(im.width+2,im.height+2));padded.paste(im,(1,1))
    padded.save(outdir/f'{name}.png')
    print(name,'removed',removed,'size',padded.size,'colors',len({p[:3] for p in padded.getdata() if p[3]}))
