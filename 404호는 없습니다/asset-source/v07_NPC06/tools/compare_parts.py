# usage: python3 -I compare_parts.py <atlas.png> <rects.json> <pngdir> <outdir>
# Side-by-side crops: original atlas parts vs v07b sheet parts, each scaled to the same display height (display only), on light/dark.
import sys,os,json
from PIL import Image,ImageDraw
import numpy as np
atlas=Image.open(sys.argv[1]).convert('RGBA');R=json.load(open(sys.argv[2]));pd=sys.argv[3];od=sys.argv[4];os.makedirs(od,exist_ok=True)
def crop(im,r):return im.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
def stack(parts):  # thigh over shin, as the renderer joins them (no overlap here, display only)
    w=max(p.width for p in parts);h=sum(p.height for p in parts);o=Image.new('RGBA',(w,h));y=0
    for p in parts:o.paste(p,((w-p.width)//2,y),p);y+=p.height
    return o
def sheet(img,file,bbox):
    x,y,w,h=bbox;return img.crop((x,y,x+w,y+h))
def row(items,H,bg):
    ims=[i.resize((max(1,round(i.width*H/i.height)),H),Image.LANCZOS) for i in items];W=sum(i.width for i in ims)+20*(len(ims)+1)
    o=Image.new('RGB',(W,H+40),bg);x=20
    for i in ims:o.paste(i,(x,20),i);x+=i.width+20
    return o
man=json.load(open(os.path.join(pd,'..','docs','NPC06_v07_asset_manifest.json')))
def parts(fn):
    r=[q for q in man['records'] if q['file']==fn][0];im=Image.open(os.path.join(pd,fn)).convert('RGBA');return [sheet(im,fn,q['bbox_px']) for q in sorted(r['parts'],key=lambda q:(q['row'],q['column']))]
fl=parts('NPC06_정면다리_깊이수정_v07b.png');rl=parts('NPC06_후면다리_경계검토_v07b.png');tp=parts('NPC06_몸통회전_단추수정_v07b.png')
for view,lp in (('front',fl),('rear',rl)):
    a=R[view];orig=[stack([crop(atlas,a['Lthigh']),crop(atlas,a['Lshin'])]),stack([crop(atlas,a['Rthigh']),crop(atlas,a['Rshin'])])]
    for bg,tag in (((236,232,224),'light'),((22,22,26),'dark')):
        # original two legs at 480 px, then v07 six at their own sheet scale relative to the tallest (straight) leg
        top=row(orig+[crop(atlas,a['pelvis'])],480,bg);
        H0=max(p.height for p in lp);sc=480/H0;ims=[p.resize((round(p.width*sc),round(p.height*sc)),Image.LANCZOS) for p in lp]
        W=sum(i.width for i in ims)+20*7;bot=Image.new('RGB',(W,520),bg);x=20
        for i in ims:bot.paste(i,(x,20),i);x+=i.width+20
        o=Image.new('RGB',(max(top.width,bot.width),top.height+bot.height),bg);o.paste(top,(0,0));o.paste(bot,(0,top.height));o.save(os.path.join(od,f'legs_{view}_{tag}.jpg'),quality=90)
for bg,tag in (((236,232,224),'light'),((22,22,26),'dark')):
    top=row([crop(atlas,R['front']['torso']),crop(atlas,R['rear']['torso'])],468,bg);bot=row(tp,468,bg)
    o=Image.new('RGB',(max(top.width,bot.width),top.height+bot.height),bg);o.paste(top,(0,0));o.paste(bot,(0,top.height));o.save(os.path.join(od,f'torso_{tag}.jpg'),quality=90)
