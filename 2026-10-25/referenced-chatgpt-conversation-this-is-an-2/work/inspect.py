from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
p=Path('work/template/layers'); sheet=Image.new('RGB',(1000,1100),'#ddd4c2'); d=ImageDraw.Draw(sheet)
for i,f in enumerate(sorted(p.glob('*.png'))):
 im=Image.open(f).convert('RGBA'); print(f.name, im.size, im.getbbox()); im.thumbnail((230,310)); x=(i%4)*250;y=(i//4)*275; sheet.paste(im,(x,y),im);d.text((x,y+253),f.name[:27],fill='black')
sheet.save('work/layers-review.jpg')
out=Image.new('RGBA',(1440,2560))
for f in sorted(p.glob('*.png')):out=Image.alpha_composite(out,Image.open(f).convert('RGBA'))
out.save('work/assembled.png')
