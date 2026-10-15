# usage: python3 -I measure_parts.py <atlas.png> <rects.json> <pngdir> <manifest.json> <out.json>
# Per part, measured from alpha (>128) only: top/bottom edge centres, width profile, lateral offset of the cuff, colour (CIELAB of
# interior pixels) and pattern strength (luminance high-pass std). Original atlas parts measured the same way for comparison.
import sys,os,json
from PIL import Image,ImageFilter
import numpy as np
atlas=Image.open(sys.argv[1]).convert('RGBA');R=json.load(open(sys.argv[2]));pd=sys.argv[3];man=json.load(open(sys.argv[4]))
def lab(rgb):
    c=rgb/255.0;c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92);M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]]);xyz=c@M.T/np.array([0.95047,1,1.08883])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116);return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
def erode(m,k=4):
    e=m.copy()
    for _ in range(k):e=e&np.roll(e,1,0)&np.roll(e,-1,0)&np.roll(e,1,1)&np.roll(e,-1,1)
    return e
def measure(im):
    a=np.asarray(im.convert('RGBA')).astype(float);m=a[...,3]>128;H,W=m.shape;ys=np.where(m.any(1))[0];y0,y1=ys[0],ys[-1]
    rows=[np.where(m[y])[0] for y in range(H)]
    def centre(yr):xs=np.concatenate([rows[y] for y in yr if len(rows[y])]);return float(xs.mean())
    band=max(3,int((y1-y0)*.03))
    top=centre(range(y0,y0+band));bot=centre(range(y1-band+1,y1+1))
    prof=[(int(y),int(rows[y][0]),int(rows[y][-1])) for y in range(y0,y1+1,max(1,(y1-y0)//40)) if len(rows[y])]
    widths=[r[2]-r[1]+1 for r in prof];mid=[(r[1]+r[2])/2 for r in prof]
    e=erode(m,5);L=lab(a[...,:3][e]);lum=np.asarray(im.convert('RGBA').convert('L')).astype(float);hp=lum-np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float)
    return dict(size=[W,H],opaque_rows=[int(y0),int(y1)],length_px=int(y1-y0+1),top_centre_x=round(top,1),bottom_centre_x=round(bot,1),cuff_offset_px=round(bot-top,1),
        cuff_offset_rel=round((bot-top)/(y1-y0+1),3),width_top_px=int(np.median(widths[:3])),width_mid_px=int(np.median(widths[len(widths)//2-1:len(widths)//2+2])),width_bottom_px=int(np.median(widths[-3:])),
        width_max_px=int(max(widths)),centreline_max_dev_px=round(float(max(abs(np.array(mid)-np.linspace(top,bot,len(mid))))),1),
        centreline_dev_side=('screen-right' if (np.array(mid)-np.linspace(top,bot,len(mid)))[np.argmax(abs(np.array(mid)-np.linspace(top,bot,len(mid))))]>0 else 'screen-left'),
        lab_mean=[round(float(v),1) for v in L.mean(0)],lab_std=[round(float(v),1) for v in L.std(0)],pattern_hp_std=round(float(hp[e].std()),2),profile=prof)
out={'original':{},'v07b':{}}
for view in ('front','rear'):
    for n in ('Lthigh','Lshin','Rthigh','Rshin','pelvis','torso'):
        r=R[view][n];out['original'][f'{view}.{n}']=measure(atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])))
names={'NPC06_정면다리_깊이수정_v07b.png':('front_leg',['straight','knee30','knee60']),'NPC06_후면다리_경계검토_v07b.png':('rear_leg',['straight','knee30','knee60']),'NPC06_몸통회전_단추수정_v07b.png':('torso',['left_shoulder_fwd','right_shoulder_fwd'])}
for rec in man['records']:
    if rec['file'] not in names:continue
    kind,cols=names[rec['file']];im=Image.open(os.path.join(pd,rec['file'])).convert('RGBA')
    for q in rec['parts']:
        x,y,w,h=q['bbox_px'];rowname=(['L','R'] if 'leg' in kind else ['front','rear'])[q['row']]
        k=f"{kind}.{rowname}.{cols[q['column']]}";d=measure(im.crop((x,y,x+w,y+h)));d['sheet_bbox_xywh']=[x,y,w,h];d['sheet_row']=q['row'];d['sheet_col']=q['column'];out['v07b'][k]=d
json.dump(out,open(sys.argv[5],'w'),indent=1)
for grp in out:
    for k,d in out[grp].items():print(grp,k,'len',d['length_px'],'w top/mid/bot/max',d['width_top_px'],d['width_mid_px'],d['width_bottom_px'],d['width_max_px'],'cuffoff',d['cuff_offset_px'],d['cuff_offset_rel'],'cl dev',d['centreline_max_dev_px'],d['centreline_dev_side'],'Lab',d['lab_mean'],'hp',d['pattern_hp_std'])
