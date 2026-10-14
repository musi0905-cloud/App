// v05 walk-frame originals and their QA (v0.17.0), checked here independently of the Python scripts: every frame's bytes
// against both the transfer manifest and the package checksums, the PNG header (720x1280, 8-bit RGBA), the QA atlases
// mapping each frame back onto its own alpha box (no re-centring), and the frame review staying consistent with its rule
// and with what walk_clips.json and the engine see.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {clipUsable} from '../dist/stage.js';
const project=fileURLToPath(new URL('../../',import.meta.url)),P=(...p)=>join(project,...p),J=(...p)=>JSON.parse(readFileSync(P(...p)));
const NPCS=['NPC02','NPC03','NPC04','NPC05','NPC06','NPC07','NPC08','NPC09','NPC10'],VIEWS=['front','side','rear'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=J('asset-source','v05_frames','TRANSFER_MANIFEST.json'),listed=new Map(manifest.packages.flatMap(p=>p.files.map(f=>[f.path,f.sha256])));
const walk=J('room404','dist','data','walk_clips.json'),QA=['asset-source','v05_QA','frame_qa'];
test('1,296 original frames: both SHA-256 records match, PNG 720x1280 8-bit RGBA, nothing extra, config and rig linked',()=>{
 assert.equal(manifest.packages.length,93);assert.ok(manifest.packages.every(p=>p.size<=manifest.max_zip_bytes),'independent ZIPs under the size cap');let n=0;
 for(const npc of NPCS){const sums=J('asset-source','v05_QA','code',npc,'checksums_v05.json');
  for(const view of VIEWS){const dir=P('asset-source','v05_frames',npc,'sprites',view);assert.deepEqual(readdirSync(dir).sort(),Array.from({length:48},(_,i)=>String(i).padStart(4,'0')+'.png'),npc+' '+view);
   for(let i=0;i<48;i++){const rel=`sprites/${view}/${String(i).padStart(4,'0')}.png`,b=readFileSync(join(dir,rel.split('/')[2])),h=sha(b);
    assert.equal(h,sums[rel],npc+'/'+rel+' vs checksums_v05.json');assert.equal(h,listed.get(npc+'/'+rel),npc+'/'+rel+' vs TRANSFER_MANIFEST.json');
    assert.equal(b.toString('latin1',12,16),'IHDR');assert.equal(b.readUInt32BE(16),720);assert.equal(b.readUInt32BE(20),1280);assert.equal(b[24],8,'8-bit');assert.equal(b[25],6,'RGBA colour type');n++}}
  const cfg=J('asset-source','v05_frames',npc,'config.json');assert.equal(cfg.id,npc);const rig=cfg.rig_path||'walk_rig_scene_retimed_v01.json';
  assert.ok(existsSync(P('asset-source','v05_frames',npc,rig)),npc+' rig '+rig);assert.equal(walk.npcs[npc].rig,rig,'walk_clips uses the same rig')}
 assert.equal(n,1296);const r=J('asset-source','v05_frames','V05_VERIFY_REPORT.json');assert.equal(r.totals.frames_ok,1296);assert.deepEqual(r.totals.npc_fail,[]);
 assert.equal(J('asset-source','v05_frames','V05_IMPORT_RESULT.json').quality,'REVISE','transfer verified is not quality PASS')});
test('QA atlases: 144 frames in clip order, every rect maps back onto its own alpha box, hashes follow the originals',()=>{
 for(const npc of NPCS){const a=J('asset-source','v05_QA','frames',npc,'atlas.json'),sums=J('asset-source','v05_QA','code',npc,'checksums_v05.json');
  assert.equal(a.frames,144);assert.deepEqual(a.canvas,[720,1280]);assert.equal(a.qa_status,'REVISE');
  const order=[['enter','front'],['exit','rear'],['pass','side']];
  for(const [clip,view] of order){const c=a.clips[clip];assert.equal(c.view,view);assert.equal(c.frames,48);
   for(let i=0;i<48;i++){const k=c.offset+i,[,,sw,sh,dx,dy]=a.rects[k],[x0,y0,x1,y1]=a.boxes[k];
    assert.deepEqual([dx,dy],[x0,y0],`${npc} ${view} ${i}: drawn at its own offset`);assert.ok(Math.abs(dx+sw/a.scale-x1)<=2&&Math.abs(dy+sh/a.scale-y1)<=2,`${npc} ${view} ${i}: size maps back`);
    assert.equal(a.sha256[k],sums[`sprites/${view}/${String(i).padStart(4,'0')}.png`])}}}});
test('frame review: statuses follow the rule, nothing is PASS by default, NPC06 sequence BLOCKED, walk_clips and engine agree',()=>{
 const s=J(...QA,'review_summary_v05.json'),req=J(...QA,'production_requests_v05.json').requests;
 for(const npc of NPCS)for(const [view,v] of Object.entries(s.npcs[npc])){
  if(v.status==='PASS'){assert.deepEqual(v.issues,[],npc+' '+view);assert.ok(Object.values(v.criteria).every(c=>c==='PASS'),npc+' '+view)}
  else assert.ok(v.issues.length>0,npc+' '+view+' '+v.status+' must name its issues');
  for(const i of v.issues)assert.ok(req.some(r=>r.npc===npc&&r.view===view&&r.issue===i),'production request for '+npc+' '+view+' '+i);
  const w=walk.npcs[npc];assert.equal(view==='sequence'?w.review.sequence:w.review.views[view],v.status);assert.equal(w.qa_status,'REVISE');assert.equal(w.engine_applied,false)}
 assert.equal(s.npcs.NPC06.sequence.status,'BLOCKED');assert.ok(s.npcs.NPC06.sequence.issues.includes('PATH_GAP'));
 for(const r of req){for(const k of ['npc','view','frames','problem','evidence','fix'])assert.ok(r[k],r.id+' '+k);for(const f of r.evidence.split(', ').map(x=>x.replace(/ .*$/,'')))assert.ok(existsSync(P('asset-source','v05_QA',f)),r.id+' evidence '+f)}
 for(const npc of NPCS)assert.equal(clipUsable(walk.npcs[npc]),false,npc+' stays on the static idle in the game')});
test('NPC06 seam reproduced on the frames: 0.533 m at the root, 0.437 m from the lowest silhouette row, +28 % head width',()=>{
 const c=walk.npcs.NPC06.checks;assert.equal(c.enter_exit_gap_m,.533);assert.equal(c.seam_measured.depth_from_lowest_row_m,.437);assert.equal(c.seam_measured.lowest_row_px,150);assert.ok(c.seam_measured.head_width_change>.25);
 for(const npc of NPCS.filter(n=>n!=='NPC06'))assert.ok(walk.npcs[npc].checks.enter_exit_gap_m<.15&&walk.npcs[npc].checks.seam_measured.head_width_change<.15,npc)});
