import sys,json,subprocess,time
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent
sys.path.insert(0,sys.argv[2])
from pixelfixer.api import process
step=1254/64
(HERE/'tuned-floor').mkdir(exist_ok=True)
source=HERE/'input/floor.png'
start=time.perf_counter()
r=subprocess.run([sys.argv[1],str(source),str(HERE/'tuned-floor/snapper.png'),'16','--pixel-size',str(step)],text=True,capture_output=True,check=True)
results={'step':step,'intent':'64x64 based on source art brief; diagnostic override, not measured ground truth','snapper':{'log':r.stdout,'seconds':round(time.perf_counter()-start,3)}}
r=process(source.read_bytes(),force_step=step)
(HERE/'tuned-floor/fixer.png').write_bytes(r.pop('png'))
results['fixer']=r
(HERE/'tuned-floor/results.json').write_text(json.dumps(results,indent=2))
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
canvas=Image.new('RGB',(850,400),'#0b141e');d=ImageDraw.Draw(canvas)
d.text((24,16),f'FLOOR - STEP OVERRIDE {step:.5f} SOURCE PIXELS',font=font,fill='#e6c87f')
for i,(label,path) in enumerate([('Current',HERE/'baseline/floor.png'),('Snapper 16',HERE/'tuned-floor/snapper.png'),('Fixer',HERE/'tuned-floor/fixer.png')]):
    im=Image.open(path).convert('RGBA');w,h=im.size
    d.text((24+i*280,54),f'{label} / {w}x{h}',font=font,fill='#e0e8d4')
    im=im.resize((w*3,h*3),Image.Resampling.NEAREST)
    canvas.paste(im,(24+i*280,90),im)
d.text((24,365),'Forced scale tests a known art target; it does not prove auto-detection accuracy.',font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',11),fill='#98b5ac')
canvas.save(HERE/'floor-tuned.png')
print(json.dumps(results,indent=2))
