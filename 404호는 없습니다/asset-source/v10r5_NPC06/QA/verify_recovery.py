import json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
b=Path('art_v10/baseline');c=Path('art_v10/candidate_r5');a=json.loads((b/'frames.json').read_text());d=json.loads((c/'frames.json').read_text())
keys=['root_world','feet_world','root_px','head_px','legs_px','shoulders_px','feet_px','shadows','knee_flex_deg']
geometry=[i for i,(x,y) in enumerate(zip(a['frames']+a['pass'],d['frames']+d['pass'])) if any(x.get(k)!=y.get(k) for k in keys)]
rows=[]
for group in ['seq','pass']:
 for p in sorted((c/group).glob('*.png')):
  q=b/group/p.name;im=np.asarray(Image.open(p).convert('RGBA'));old=np.asarray(Image.open(q).convert('RGBA'))
  rows.append({'path':group+'/'+p.name,'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':[im.shape[1],im.shape[0]],'alpha_changed_pixels':int(np.count_nonzero(im[:,:,3]!=old[:,:,3])),'byte_identical':p.read_bytes()==q.read_bytes()})
r={'status':'REVISE','engine_applied':False,'rendered_frames':len(rows),'geometry_differences':geometry,'side_byte_identical':sum(x['byte_identical'] for x in rows if x['path'].startswith('pass/')),'alpha_changed_pixels':sum(x['alpha_changed_pixels'] for x in rows),'frames':rows}
Path('art_v10/review_r5').mkdir(exist_ok=True);Path('art_v10/review_r5/verification_v10r5.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print({k:v for k,v in r.items() if k!='frames'})
