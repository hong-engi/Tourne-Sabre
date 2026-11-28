from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
fontpath='/System/Library/Fonts/Menlo.ttc'
font=ImageFont.truetype(fontpath,13)
small=ImageFont.truetype(fontpath,11)
large=ImageFont.truetype(fontpath,23)
for name in ['knight','enemy','sabre','shard','floor']:
    im=Image.open(HERE/'fixer'/f'{name}.png').convert('RGBA')
    alpha=im.getchannel('A')
    out=im.convert('RGB').quantize(colors=16,dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(alpha)
    (HERE/'fixer-palette16').mkdir(exist_ok=True)
    out.save(HERE/'fixer-palette16'/f'{name}.png')

W,H=1180,1650
sheet=Image.new('RGB',(W,H),'#0b141e');d=ImageDraw.Draw(sheet)
d.text((28,22),'TOURNE / SABRE - PIXEL CONVERSION TEST',font=large,fill='#e0e8d4')
d.text((28,58),'Same high-resolution input per tool. Auto grid detection; game assets unchanged.',font=font,fill='#98b5ac')
columns=[('CURRENT GAME','current'),('PIXEL SNAPPER / 16','snapper'),('PIXEL ART FIXER','fixer'),('FIXER + PALETTE 16','fixer-palette16')]
for col,(title,_) in enumerate(columns):
    d.text((125+col*260,100),title,font=font,fill='#edcd83')
for row,name in enumerate(['knight','enemy','sabre','shard','floor']):
    y=130+row*300
    d.text((18,y+12),name.upper(),font=font,fill='#a2ccbd')
    for col,(_,tool) in enumerate(columns):
        x=115+col*260
        d.rectangle((x,y,x+248,y+278),fill='#16242c',outline='#324a4b')
        path=HERE/'baseline'/f'{name}.png' if tool=='current' else HERE/tool/f'{name}.png'
        im=Image.open(path).convert('RGBA');native=im.size
        bbox=im.getchannel('A').point(lambda v:255 if v>127 else 0).getbbox()
        if bbox: im=im.crop(bbox)
        ratio=min(214/im.width,208/im.height)
        scale=math.floor(ratio) if ratio>=1 else ratio
        display=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
        sheet.paste(display,(x+(248-display.width)//2,y+14+(208-display.height)//2),display)
        colors=len({p[:3] for p in Image.open(path).convert('RGBA').getdata() if p[3]>127})
        d.text((x+12,y+236),f'{native[0]}x{native[1]}  |  {colors} colors',font=font,fill='#d6dfcc')
        caption=f'{scale:g}x integer preview' if ratio>=1 else 'NN fit preview (output > panel)'
        d.text((x+12,y+258),caption,font=small,fill='#8ca8a2')
d.text((28,1625),'Palette16 is a separate post-process; raw converter outputs are preserved in their folders.',font=small,fill='#8ca8a2')
sheet.save(HERE/'comparison.png')
