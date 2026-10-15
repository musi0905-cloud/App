# usage: python3 -I torso_cues.py <pngdir> <manifest> <atlas> <rects.json> <out.json>
# Yaw cues per torso cell, from pixels only: silhouette centre vs garment centre (front: the shirt band between the cardigan
# fronts, light low-chroma pixels; rear: the collar), visible front-panel widths left/right of it, shoulder and hem line tilt
# (first/last opaque row at 20%/80% of the width), and whether the two cells of a row are mirror images (mask IoU).
import sys,os,json
from PIL import Image
import numpy as np
pd,mf,af,rf,out=sys.argv[1:6];man=json.load(open(mf));R=json.load(open(rf))
rec=[r for r in man['records'] if r['file']=='NPC06_몸통회전_단추수정_v07b.png'][0];sheet=np.asarray(Image.open(os.path.join(pd,rec['file'])).convert('RGBA')).astype(float)
at=np.asarray(Image.open(af).convert('RGBA')).astype(float)
def cues(a,front):
    m=a[...,3]>128;H,W=m.shape;ys=np.where(m.any(1))[0];y0,y1=ys[0],ys[-1];h=y1-y0+1;r=a[...,0];g=a[...,1];b=a[...,2];mx=np.maximum(np.maximum(r,g),b);mn=np.minimum(np.minimum(r,g),b)
    light=m&(mx>200)&((mx-mn)<35)
    res={'height_px':int(h)}
    rows=[]
    for f in (.35,.5,.65,.8) if front else (.02,.05,.08):
        y=int(y0+f*h);xs=np.where(m[y])[0];sil=(xs[0]+xs[-1])/2;lx=np.where(light[max(0,y-3):y+4].any(0))[0]
        if len(lx)==0:continue
        # largest run of light columns = shirt band (front) / collar (rear)
        runs=np.split(lx,np.where(np.diff(lx)>3)[0]+1);band=max(runs,key=len);gc=(band[0]+band[-1])/2
        rows.append(dict(y_frac=f,sil_left=int(xs[0]),sil_right=int(xs[-1]),sil_centre=float(sil),garment_centre=float(gc),offset_px=round(float(gc-sil),1),offset_rel_halfwidth=round(float((gc-sil)/((xs[-1]-xs[0])/2)),3),
            panel_left_px=int(band[0]-xs[0]),panel_right_px=int(xs[-1]-band[-1])))
    res['rows']=rows;res['mean_offset_rel_halfwidth']=round(float(np.mean([q['offset_rel_halfwidth'] for q in rows])),3) if rows else None
    xa,xb=int(W*.2),int(W*.8);top=lambda x:int(np.where(m[:,x])[0][0]);bot=lambda x:int(np.where(m[:,x])[0][-1])
    res['shoulder_tilt_deg']=round(float(np.degrees(np.arctan2(top(xb)-top(xa),xb-xa))),2);res['hem_tilt_deg']=round(float(np.degrees(np.arctan2(bot(xb)-bot(xa),xb-xa))),2)
    res['silhouette_bulk_left_right']=[int(m[:,:W//2].sum()),int(m[:,W//2:].sum())]
    return res,m
out={}
cells={}
for q in rec['parts']:
    x,y,w,h=q['bbox_px'];a=sheet[y:y+h,x:x+w];key=('front' if q['row']==0 else 'rear')+'.'+('left_cell' if q['column']==0 else 'right_cell');c,m=cues(a,q['row']==0);out[key]=c;cells[key]=m
def iou(a,b):
    H=max(a.shape[0],b.shape[0]);W=max(a.shape[1],b.shape[1]);A=np.zeros((H,W),bool);B=A.copy();A[:a.shape[0],:a.shape[1]]=a;B[:b.shape[0],:b.shape[1]]=b;return float((A&B).sum()/(A|B).sum())
for v in ('front','rear'):
    L,Rm=cells[v+'.left_cell'],cells[v+'.right_cell'];out[v+'.pair']={'iou_same':round(iou(L,Rm),3),'iou_mirrored':round(iou(L,Rm[:,::-1]),3)}
for v in ('front','rear'):
    r=R[v]['torso'];c,_=cues(at[r['y']:r['y']+r['h'],r['x']:r['x']+r['w']],v=='front');out['original.'+v]=c
json.dump(out,open(out_path:=out and sys.argv[5],'w'),indent=1)
for k,v in out.items():
    if 'rows' in v:print(k,'offset/halfwidth',v['mean_offset_rel_halfwidth'],'panels',[(q['panel_left_px'],q['panel_right_px']) for q in v['rows']],'shoulder tilt',v['shoulder_tilt_deg'],'hem tilt',v['hem_tilt_deg'],'bulk L/R',v['silhouette_bulk_left_right'])
    else:print(k,v)
