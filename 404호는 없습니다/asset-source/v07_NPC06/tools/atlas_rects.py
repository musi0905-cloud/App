# usage: python3 -I atlas_rects.py <atlas.png> <out.json>  — the renderer's part rects (render_v06.js loadArt: alpha>=32, 4-connected, >500 px, rows by centre y)
import sys,os,json
sys.dont_write_bytecode = True; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));import cc
from PIL import Image
import numpy as np
names=['head','torso','pelvis','Lupperarm','Lforearm','Lhand','Rupperarm','Rforearm','Rhand','Lthigh','Lshin','Lshoe','Rthigh','Rshin','Rshoe','prop']
a=np.asarray(Image.open(sys.argv[1]).convert('RGBA'));H,W=a.shape[:2]
comps=[]
for c in cc.label(a[...,3]>=32,4):
    if c['px']>500:
        ys=np.concatenate([np.full(b-x,y) for y,x,b in c['runs']]);xs=np.concatenate([np.arange(x,b) for y,x,b in c['runs']])
        comps.append(dict(cx=xs.mean(),cy=ys.mean(),x=c['bbox_xywh'][0],y=c['bbox_xywh'][1],w=c['bbox_xywh'][2],h=c['bbox_xywh'][3]))
out={}
for vi,view in enumerate(['front','side','rear']):
    r={}
    for n in range(16):
        row,col=n//4,n%4;items=sorted([c for c in comps if int(c['cy']/H*4)==row],key=lambda c:c['cx'])
        it=items[vi*4+col];r[names[n]]={k:int(it[k]) for k in 'xywh'}
    out[view]=r
json.dump(out,open(sys.argv[2],'w'),indent=1);print(json.dumps(out['front']))
