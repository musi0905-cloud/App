# usage: python3 -I annotate_parts.py <pngdir> <part_measure.json> <out.jpg> <kind: front_leg|rear_leg|torso>
# Each part on mid-grey with its alpha>128 outline, edge centres (top: blue, bottom: red), the top-to-bottom line and the centreline (yellow).
import sys,os,json
from PIL import Image,ImageDraw
import numpy as np
pd,mj,out,kind=sys.argv[1:5];M=json.load(open(mj))['v07b']
files={'front_leg':'NPC06_정면다리_깊이수정_v07b.png','rear_leg':'NPC06_후면다리_경계검토_v07b.png','torso':'NPC06_몸통회전_단추수정_v07b.png'}
im=Image.open(os.path.join(pd,files[kind])).convert('RGBA');keys=[k for k in M if k.startswith(kind+'.')]
tiles=[]
for k in sorted(keys,key=lambda k:(M[k]['sheet_row'],M[k]['sheet_col'])):
    d=M[k];x,y,w,h=d['sheet_bbox_xywh'];pad=20;c=im.crop((x-pad,y-pad,x+w+pad,y+h+pad));bg=Image.new('RGBA',c.size,(128,128,128,255));bg.alpha_composite(c);g=ImageDraw.Draw(bg)
    pr=d['profile'];g.line([(r[1]+pad,r[0]+pad) for r in pr],fill=(0,255,255),width=2);g.line([(r[2]+pad,r[0]+pad) for r in pr],fill=(0,255,255),width=2)
    g.line([((r[1]+r[2])/2+pad,r[0]+pad) for r in pr],fill=(255,230,0),width=2)
    y0,y1=d['opaque_rows'];g.line([(d['top_centre_x']+pad,y0+pad),(d['bottom_centre_x']+pad,y1+pad)],fill=(255,255,255),width=1)
    for (cx,cy,col) in ((d['top_centre_x'],y0,(0,90,255)),(d['bottom_centre_x'],y1,(255,40,40))):g.ellipse((cx+pad-7,cy+pad-7,cx+pad+7,cy+pad+7),fill=col)
    g.text((6,6),k.split('.',1)[1],fill=(255,255,255));tiles.append(bg)
cols=3 if 'leg' in kind else 2;rows=(len(tiles)+cols-1)//cols;tw=max(t.width for t in tiles);th=max(t.height for t in tiles)
o=Image.new('RGB',(tw*cols,th*rows),(90,90,90))
for i,t in enumerate(tiles):o.paste(t.convert('RGB'),((i%cols)*tw,(i//cols)*th))
o.save(out,quality=88)
