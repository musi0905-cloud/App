// v0.19.0: gate-visitor pictures (figures.js), the NPC06 v10r5 user exception, the runtime clip pages and the sequence
// state machine (walk.js createSequence). The browser side (real playback, swap, CCTV identity, fallbacks) is
// tests/npc06-flow.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,statSync} from 'node:fs';import {createHash} from 'node:crypto';
import {figureFor,cctvPlan,exceptionAllows,sha256js,USER_EXCEPTIONS} from '../dist/figures.js';
import {createSequence,SEQ_STATES} from '../dist/walk.js';
import {clipUsable} from '../dist/stage.js';
import {lookFor} from '../dist/replay.js';
const P=p=>new URL('../../'+p,import.meta.url),D=p=>new URL('../dist/'+p,import.meta.url);
const J=u=>JSON.parse(readFileSync(u,'utf8')),sha=u=>createHash('sha256').update(readFileSync(u)).digest('hex');
const data=n=>J(D('data/'+n+'.json'));
const figs=data('visitor_figures'),chars=data('character_assets'),visitors=data('visitors'),scenarios=data('scenarios'),walk=data('walk_clips');
const clip=J(D('assets/clips/NPC06_v10r5/clip.json')),side=J(D('assets/clips/side/side.json')),rec=figs.intercom_clips.NPC06;
const V=Object.fromEntries(visitors.map(v=>[v.id,v])),S=Object.fromEntries(scenarios.map(s=>[s.id,s]));
const caseFig=(vid,aid)=>{const o=V[vid],raw=S[aid],v={...o,baseRole:o.role,role:raw.role};return figureFor(v,raw,chars,figs,lookFor(v))};

test('every reachable case: the game rule (figures.js) gives exactly the recorded picture; intercom and CCTV share it',()=>{
 assert.equal(figs.cases.length,100);for(const r of figs.cases){const f=caseFig(r.visitor,r.anomaly);assert.equal(f.kind,r.kind,r.visitor+' '+r.anomaly);
  assert.equal(f.kind==='role'?f.npc:f.id,r.figure,r.visitor);assert.deepEqual(f.plan.needs,r.needs,r.visitor);assert.deepEqual(f.plan.missing,r.missing,r.visitor);
  if(r.intercom==='seq:NPC06_v10r5')assert.equal(f.intercom?.revision,'v10r5');else assert.equal(f.intercom??null,null,r.visitor+' no clip')}
 assert.equal(figs.summary.role_cases,figs.cases.filter(r=>r.kind==='role').length);assert.deepEqual(figs.summary.npc06_sequence_cases.map(x=>x.slice(0,4)),['V051','V052','V057','V060'])});
test('a role figure only where every CCTV scene can be drawn with that same person; otherwise the legacy look in both screens',()=>{
 for(const r of figs.cases){const sc=S[r.anomaly].scenes;
  if(r.kind==='role'){for(const s of sc){assert.ok(['wait','pan','cross'].includes(s.action),r.anomaly+' '+s.action);assert.notEqual(s.mode,'repeat')}
   if(sc.some(s=>s.action==='cross'))assert.ok(figs.side_clips.includes(r.npc)&&!figs.direction_bound[r.anomaly],r.anomaly)}
  else assert.ok(r.missing.length,r.visitor)}
 // NPC01 has no walk: its cases never borrow another person's walk; walking cases of every role stay legacy.
 for(const r of figs.cases.filter(r=>r.npc==='NPC01'))assert.ok(r.kind==='legacy'||!r.needs.some(n=>n.startsWith('walk')),r.visitor);
 assert.ok(!figs.side_clips.includes('NPC01'));assert.ok(!figs.side_clips.includes('NPC10'),'NPC10 side is REVISE');
 for(const id of Object.keys(figs.direction_bound))for(const r of figs.cases.filter(r=>r.anomaly===id))assert.equal(r.kind,'legacy',id);
 const plan=cctvPlan({id:'X',scenes:[{action:'wait'},{action:'enter',location:'lobby'}]},'NPC06',figs);assert.equal(plan.ok,false);assert.deepEqual(plan.missing,['walk_front_rear']);
 assert.equal(cctvPlan({id:'X',scenes:[{action:'wait',mode:'repeat'}]},'NPC06',figs).ok,false,'repeat replays a walk-in');
 assert.equal(cctvPlan({id:'X',scenes:[{action:'cross'}]},'NPC03',figs).ok,false,'no runtime side walk for NPC03');
 assert.equal(caseFig('V001',figs.cases.find(r=>r.visitor==='V001').anomaly).kind,'legacy');
 const off={...figs,enabled:false};assert.equal(figureFor({...V.V051,baseRole:V.V051.role},S.A079,chars,off,1).kind,'legacy','master switch')});
test('NPC06 v10r5 exception: exactly this version and hash, visual REVISE kept, four accepted limits, runtime on; anything else refused',()=>{
 assert.ok(exceptionAllows(rec,clip));assert.equal(rec.visual_status,'REVISE');assert.equal(rec.qa_status,'REVISE');assert.equal(rec.runtime_enabled,true);assert.equal(rec.user_accepted_limitations.length,4);
 for(const w of ['다리','몸통','소매','가방끈'])assert.ok(rec.user_accepted_limitations.some(x=>x.includes(w)),w);assert.match(rec.approval_basis,/수용/);assert.doesNotMatch(JSON.stringify(rec),/"PASS"/);
 assert.equal(USER_EXCEPTIONS.NPC06.manifest_sha256,sha(P('asset-source/v10r5_NPC06/NPC06_v10r5_manifest.json')));assert.equal(rec.scope.manifest_sha256,USER_EXCEPTIONS.NPC06.manifest_sha256);
 assert.deepEqual(Object.keys(USER_EXCEPTIONS),['NPC06'],'no other NPC rides on this approval');
 for(const bad of [{...rec,revision:'v09r'},{...rec,visual_status:'PASS'},{...rec,runtime_enabled:false},{...rec,npc:'NPC03'},{...rec,user_accepted_limitations:[]}])assert.equal(exceptionAllows(bad,clip),false);
 for(const bad of [{...clip,revision:'v10r4'},{...clip,visual_status:'PASS'},{...clip,source:{...clip.source,manifest_sha256:'0'.repeat(64)}},{...clip,npc:'NPC07'}])assert.equal(exceptionAllows(rec,bad),false);
 // The global REVISE block is untouched: the walk_clips entries still never pass clipUsable, v10r5 included.
 for(const [id,n] of Object.entries(walk.npcs))assert.equal(clipUsable(n),false,id);assert.equal(clipUsable({...walk.npcs.NPC06.v10r5,review:walk.npcs.NPC06.review}),false);
 const {atlas,source,note,...w}=walk.npcs.NPC06.v10r5;assert.deepEqual(w,rec,'walk_clips.json records the same exception');assert.equal(walk.npcs.NPC06.qa_status,'REVISE')});
test('clip.json and its pages: hash chain, 215 frames in six segments, rects on the fixed 720x1280 canvas, source frames verified',()=>{
 assert.equal(sha(D(rec.clip)),rec.clip_sha256);for(const p of clip.pages){const u=D('assets/clips/NPC06_v10r5/'+p.file);assert.equal(statSync(u).size,p.bytes);assert.equal(sha(u),p.sha256);assert.equal(rec.scope.pages[p.file],p.sha256);assert.ok(p.size[0]<=2048&&p.size[1]<=2048,'mobile page size');assert.equal(p.alpha_identical,true)}
 assert.deepEqual(Object.fromEntries(Object.entries(clip.segments).map(([k,v])=>[k,v.frames])),{enter:48,settle:16,idle:48,turn:40,start:15,exit:48});let o=0;for(const v of Object.values(clip.segments)){assert.equal(v.offset,o);o+=v.frames}
 assert.equal(clip.frames.length,215);assert.equal(clip.shadows.length,215);assert.deepEqual(clip.canvas,[720,1280]);assert.equal(clip.design_scale,1.5);assert.equal(clip.fps,24);assert.match(clip.fps_basis,/24fps/);
 for(const [pg,sx,sy,sw,sh,dx,dy] of clip.frames){const p=clip.pages[pg];assert.ok(sx>=0&&sy>=0&&sx+sw<=p.size[0]&&sy+sh<=p.size[1]);assert.ok(dx>=0&&dy>=0&&dx+sw<=720&&dy+sh<=1280)}
 for(const [g,segs] of Object.entries(clip.groups))for(const s of segs){const v=clip.segments[s];for(let i=v.offset;i<v.offset+v.frames;i++)assert.equal(clip.pages[clip.frames[i][0]].group,g,s+i)}
 assert.deepEqual(clip.turn_entries,[23,47]);assert.equal(clip.turn_entry_check.idle_to_turn0[47],clip.turn_entry_check.limit_idle47);
 const ver=J(P('asset-source/v10r5_NPC06/QA/verification_v10r5.json'));for(const [i,h] of clip.src_sha256.entries()){assert.equal(sha(P(`asset-source/v10r5_NPC06/frames/seq/${String(i).padStart(4,'0')}.png`)),h);assert.equal(ver.frames.find(f=>f.path===`seq/${String(i).padStart(4,'0')}.png`).sha256,h)}
 assert.equal(clip.source.frames_json_sha256,sha(P('asset-source/v10r5_NPC06/frames/frames.json')))});
test('side walks: v06 side PASS frames byte for byte, never mirrored, only for NPCs a case needs',()=>{
 assert.deepEqual(Object.keys(side.npcs).sort(),figs.side_clips);const need=new Set(figs.cases.filter(r=>r.kind==='role'&&r.needs.includes('walk_side')).map(r=>r.npc));assert.deepEqual([...need].sort(),figs.side_clips);
 const review=J(P('asset-source/v06_QA/review_summary_v06.json'));
 for(const [npc,c] of Object.entries(side.npcs)){const a=J(P(`asset-source/v06_QA/${npc}/atlas.json`)),o=a.clips.pass.offset;assert.deepEqual(c.src_sha256,a.sha256.slice(o,o+48),npc);assert.equal(review.npcs[npc].side.status,'PASS',npc);
  assert.equal(c.direction,'screen-left');assert.ok(c.step_px<0);assert.equal(c.frames.length,48);assert.equal(c.root_x.length,48);assert.equal(c.shadows.length,48);
  for(const p of c.pages){const u=D('assets/clips/side/'+p.file);assert.equal(sha(u),p.sha256);assert.equal(statSync(u).size,p.bytes)}}
 const replay=readFileSync(D('replay.js'),'utf8');assert.match(replay,/flip:!role&&/,'role figures are not mirrored for walking')});
test('sequence: enter -> settle -> idle (only loop) -> turn -> start -> exit -> gone, once each, turn only after an entry frame',()=>{
 const seg={enter:{frames:48},settle:{frames:16},idle:{frames:48},turn:{frames:40},start:{frames:15},exit:{frames:48}},fps=24;
 for(const leaveAt of [0.5,2.2,3.0,3.5,4.6,9.99]){const ev=[];const s=createSequence({segments:seg,fps,turnEntries:[23,47],onState:(x,t)=>ev.push([x,t])});s.start(0);let prev=null,asked=false;const seen={};
  for(let t=0;t<20;t+=1/90){if(!asked&&t>=leaveAt){assert.ok(s.leave(t));asked=true;assert.equal(s.leave(t),false,'second leave refused')}
   const a=s.at(t);if(a.seg&&a.state!=='idle'&&prev&&prev.seg===a.seg)assert.ok(a.frame>=prev.frame,a.seg+' forward only');if(a.seg)(seen[a.seg]??=new Set()).add(a.frame);if(prev?.state==='idle'&&a.state==='turn')assert.ok([23,47].includes(prev.frame),'turn after idle '+prev.frame);prev=a}
  assert.deepEqual(ev.map(e=>e[0]),SEQ_STATES.slice(1),'leave at '+leaveAt);for(const k of ['enter','settle','turn','start','exit'])assert.equal(seen[k].size,seg[k].frames,k+' every frame shown');
  const turnAt=ev.find(e=>e[0]==='turn')[1],idleAt=ev.find(e=>e[0]==='idle')[1];assert.ok(turnAt>=Math.max(leaveAt,idleAt)-1e-9,'an arrival is never cut short');assert.ok(Number.isInteger(Math.round((turnAt-idleAt)*fps*1e6)/1e6)&&[0,24].includes(Math.round((turnAt-idleAt)*fps)%48),'turn on an entry boundary')}
 const r=createSequence({segments:seg,instant:true,turnEntries:[47]});r.start(0);assert.equal(r.at(0).state,'idle');assert.equal(r.at(5).frame,0,'reduced motion: still frame');r.leave(6);assert.equal(r.at(6).state,'gone');
 const v=createSequence({segments:seg,turnEntries:[47]});v.start(0);v.at(3);assert.ok(v.vanish(3));const a=v.at(3.1);assert.ok(a.alpha<1&&a.alpha>0);assert.equal(v.at(3.3).state,'gone');assert.equal(v.start(4),false);
 assert.throws(()=>createSequence({segments:{...seg,turn:{frames:0}}}));assert.throws(()=>createSequence({segments:seg,turnEntries:[99]}))});
test('SHA-256 fallback (pages hashed on origins without Web Crypto) equals node crypto',()=>{
 for(const n of [0,1,55,56,63,64,65,1000,99999]){const b=Buffer.alloc(n);for(let i=0;i<n;i++)b[i]=(i*31+7)&255;assert.equal(sha256js(b.buffer.slice(b.byteOffset,b.byteOffset+n)),createHash('sha256').update(b).digest('hex'),String(n))}});
test('offline: role figures in use, the clip pages and side walks are precached; QA media, ZIPs and source frames are not',()=>{
 const sw=readFileSync(D('sw.js'),'utf8');for(const p of clip.pages)assert.ok(sw.includes(`assets/clips/NPC06_v10r5/${p.file}`),p.file);for(const c of Object.values(side.npcs))for(const p of c.pages)assert.ok(sw.includes(`assets/clips/side/${p.file}`),p.file);
 assert.match(sw,/clip\.json/);assert.match(sw,/side\.json/);assert.match(sw,/visitor_figures\.json/);assert.match(sw,/figures\.js/);const files=sw.split('\n').find(l=>l.startsWith('const FILES'));assert.doesNotMatch(files,/asset-source|\.zip|\.mp4|frames\/seq|sequence_\d|comparison|test-artifacts/);
 for(const f of ['assets/clips/NPC06_v10r5','assets/clips/side'])assert.ok(existsSync(D(f)))});
