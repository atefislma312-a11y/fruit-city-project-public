from pathlib import Path
import zipfile,xml.etree.ElementTree as ET,hashlib,json
from PIL import Image
out=Path('outputs');root=ET.Element('image',w='1440',h='2560',name='Fruit Archives China 1968 review');stack=ET.SubElement(root,'stack')
files=[p for p in sorted(Path('work/template/layers').glob('*.png')) if not p.name.startswith(('06_','08_','10_'))]+[Path('work/editorial.png')]
with zipfile.ZipFile(out/'China-1968-layered.ora','w') as z:
 z.writestr('mimetype','image/openraster')
 for i,p in reversed(list(enumerate(files))):
  name=f'data/{i:02}.png';z.write(p,name);ET.SubElement(stack,'layer',{'name':p.stem,'src':name,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
 z.writestr('stack.xml',ET.tostring(root));z.write(out/'China-1968-review.png','mergedimage.png')
cup=Image.open('work/template/layers/12_CUP_LOCKED_BRAND.png').convert('RGBA');final=Image.open(out/'China-1968-review.png').convert('RGBA');box=(600,1620,880,1930)
a=cup.crop(box);b=final.crop(box);count=sum(1 for p,q in zip(a.getdata(),b.getdata()) if p[3]==255 and p!=q);print('Opaque logo-region changed pixels:',count);assert count==0
