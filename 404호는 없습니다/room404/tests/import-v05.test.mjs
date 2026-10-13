// scripts/import-v05-frames.py on a synthetic package (the real v05 sprites are not in hand): hashes are enforced, each
// frame keeps its own crop offset on the fixed 720x1280 canvas (no re-centring), nothing is mirrored, nothing is cut
// into equal cells, and a single altered frame stops the import.
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/import-v05-frames.py',import.meta.url));
const fixture=dir=>spawnSync('python3',['-I','-c',`
import sys,os,json,hashlib
from PIL import Image,ImageDraw
root=sys.argv[1];sums={}
for view,dx in (('front',0),('rear',3),('side',-3)):
    os.makedirs(f'{root}/NPC03/sprites/{view}',exist_ok=True)
    for i in range(48):
        im=Image.new('RGBA',(720,1280),(0,0,0,0));d=ImageDraw.Draw(im);x=200+i*dx;y=300+i*4
        d.rectangle([x,y,x+60,y+200],fill=(200,40,40,255));d.rectangle([x,y,x+10,y+10],fill=(40,200,40,255))
        p=f'{root}/NPC03/sprites/{view}/{i:04d}.png';im.save(p);sums[f'sprites/{view}/{i:04d}.png']=hashlib.sha256(open(p,'rb').read()).hexdigest()
json.dump(sums,open(f'{root}/NPC03/checksums_v05.json','w'))
`,dir],{encoding:'utf8'});
test('synthetic v05 package: verified, cropped per frame with offsets, packed in frame order',()=>{const dir=mkdtempSync(join(tmpdir(),'v05-')),out=join(dir,'out');
 assert.equal(fixture(dir).status,0);const r=spawnSync('python3',[script,'--source',dir,'--out',out,'--scale','1'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
 const a=JSON.parse(readFileSync(join(out,'NPC03','atlas.json')));assert.equal(a.frames,144);assert.deepEqual(a.clips.enter,{offset:0,frames:48,view:'front'});assert.deepEqual(a.clips.exit,{offset:48,frames:48,view:'rear'});assert.equal(a.qa_status,'REVISE');
 for(let i=0;i<48;i++){assert.deepEqual(a.rects[i].slice(2),[61,201,200+i*0,300+i*4],'front frame '+i+' keeps its own offset');assert.equal(a.rects[48+i][4],200+i*3);assert.equal(a.rects[96+i][4],200-i*3)}
 const px=spawnSync('python3',['-I','-c','import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGBA");r=list(map(int,sys.argv[2:]));print(im.getpixel((r[0]+2,r[1]+2)),im.getpixel((r[0]+r[2]-3,r[1]+2)))',join(out,'NPC03','atlas.webp'),...a.rects[5].slice(0,4).map(String)],{encoding:'utf8'}).stdout;
 assert.match(px,/^\(40, 200, 40, 255\) \(200, 40, 40, 255\)/,'green marker still top-left: not mirrored')});
test('one altered frame stops the import and names the file',()=>{const dir=mkdtempSync(join(tmpdir(),'v05-')),out=join(dir,'out');assert.equal(fixture(dir).status,0);
 const f=join(dir,'NPC03','sprites','rear','0007.png');writeFileSync(f,Buffer.concat([readFileSync(f),Buffer.from([0])]));
 const r=spawnSync('python3',[script,'--source',dir,'--out',out],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stdout,/STOPPED/);assert.match(r.stdout,/sprites\/rear\/0007\.png: sha256/);assert.ok(!existsSync(join(out,'NPC03','atlas.json')))});
