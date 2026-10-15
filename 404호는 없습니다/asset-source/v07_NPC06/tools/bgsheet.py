# usage: python3 -I bgsheet.py <png> <out.jpg> [bg02.webp]  — the sheet alpha-composited on checker/light/dark(/BG02), 2x2
import sys
from PIL import Image
import numpy as np
src=Image.open(sys.argv[1]).convert('RGBA');W,H=src.size
def checker(w,h,s=32):
    y,x=np.mgrid[0:h,0:w];c=((x//s+y//s)%2)*60+150;return Image.fromarray(np.dstack([c,c,c]).astype(np.uint8))
bgs=[checker(W,H),Image.new('RGB',(W,H),(236,232,224)),Image.new('RGB',(W,H),(22,22,26))]
if len(sys.argv)>3: bgs.append(Image.open(sys.argv[3]).convert('RGB').resize((W,H)))
else: bgs.append(Image.new('RGB',(W,H),(128,128,128)))
out=Image.new('RGB',(W,H))
tiles=[]
for b in bgs:
    t=b.copy();t.paste(src,(0,0),src);tiles.append(t.resize((W//2,H//2),Image.LANCZOS))
for i,t in enumerate(tiles): out.paste(t,((i%2)*W//2,(i//2)*H//2))
out.save(sys.argv[2],quality=88)
