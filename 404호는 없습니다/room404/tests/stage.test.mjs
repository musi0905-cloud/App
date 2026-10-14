// Layered stage (v0.16.0): walk.js timing rules, stage.js placement math, scene_layout.json and walk_clips.json data.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {createWalker,STATES} from '../dist/walk.js';
import {depthAt,placeStill,areaStyle,clipActor,clipUsable,cameraOf} from '../dist/stage.js';
const read=p=>JSON.parse(readFileSync(new URL('../dist/'+p,import.meta.url)));
const layout=read('data/scene_layout.json'),walk=read('data/walk_clips.json'),chars=read('data/character_assets.json'),evidence=read('data/story_evidence.json');
const game=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const times=(a,b,step=1/96)=>{const t=[];for(let x=a;x<=b+1e-9;x+=step)t.push(x);return t};

test('still figure: enter and leave by opacity only, no frames, no movement',()=>{const w=createWalker({fade:.25});assert.equal(w.state,'hidden');assert.equal(w.at(0).alpha,0);
 assert.ok(w.start(10));const a=w.at(10.1);assert.equal(a.state,'enter');assert.ok(a.alpha>0&&a.alpha<1);assert.equal(a.frame,null);assert.equal(a.moving,false);
 assert.equal(w.at(10.3).state,'idle');assert.equal(w.at(10.3).alpha,1);assert.ok(w.leave(11));const e=w.at(11.1);assert.equal(e.state,'exit');assert.ok(e.alpha<1&&e.alpha>0);assert.equal(e.moving,false);
 assert.equal(w.at(11.3).state,'gone');assert.equal(w.at(11.3).alpha,0);for(const t of times(10,12))assert.ok(STATES.includes(w.at(t).state))});
test('walk clip: enter plays once, frames only move forward, last frame holds (no wrap), exit plays its own clip forward',()=>{
 const w=createWalker({clips:{enter:{frames:48},exit:{frames:48}},fps:24});w.start(0);let last=-1;
 for(const t of times(0,1.99)){const s=w.at(t);assert.equal(s.state,'enter');assert.equal(s.clip,'enter');assert.ok(s.frame>=last,'never backwards');assert.ok(s.frame<=47);last=s.frame}
 assert.equal(last,47);const idle=w.at(3);assert.equal(idle.state,'idle');assert.equal(idle.frame,47,'idle holds the last arrival frame, no wrap to 0');assert.equal(idle.moving,false);
 w.leave(5);last=-1;for(const t of times(5,6.99)){const s=w.at(t);assert.equal(s.clip,'exit');assert.ok(s.frame>=last);last=s.frame}
 assert.equal(last,47);const tail=w.at(7.1);assert.equal(tail.state,'exit');assert.equal(tail.frame,47);assert.ok(tail.alpha<1);assert.equal(w.at(7.3).state,'gone')});
test('leaving during the arrival waits for the arrival to finish; a second start while on stage is refused',()=>{const w=createWalker({clips:{enter:{frames:48},exit:{frames:48}},fps:24});
 w.start(0);assert.equal(w.start(.5),false);w.leave(.5);assert.equal(w.at(1).state,'enter');assert.equal(w.at(1).frame,24);const s=w.at(2.05);assert.equal(s.state,'exit');assert.equal(s.frame,1)});
test('reduced motion: no timed transitions',()=>{const w=createWalker({clips:{enter:{frames:48}},instant:true});w.start(0);assert.equal(w.at(0).state,'idle');w.leave(1);assert.equal(w.at(1).state,'gone')});
test('BG02 camera model: floor line, PASS placement reference, and the still figure stands on its stand point',()=>{const bg=layout.backgrounds.BG02,c=bg.camera_model;
 assert.ok(Math.abs(bg.floor_line_y-(c.horizon_y+c.focal_px*c.camera_height_m/c.door_plane_z_m))<.1);
 const sp=bg.stand_points.idle;assert.ok(Math.abs(depthAt(bg,sp.y)-sp.z)<.002);
 for(const [id,a] of Object.entries(chars.assets)){const f=a.figure,p=placeStill(bg,sp,f);assert.ok(Math.abs(p.box[3]-sp.y)<1e-6,id+' feet on the floor point');
  assert.ok(Math.abs((p.box[3]-p.box[1])-f.height_m*c.focal_px/sp.z)<1,id+' height follows depth');assert.equal(p.shadows.length,2);for(const s of p.shadows){assert.equal(s[1],sp.y);assert.ok(Math.abs(s[0]-sp.x)<p.w/2)}
  const cam=bg.cameras.intercom;assert.ok(p.box[1]>=cam[1]&&p.box[3]<=cam[1]+cam[3],id+' whole figure inside the intercom camera')}});
test('click areas grow to a 44 px touch target; figure areas need an idle figure',()=>{const s=areaStyle([500,500,10,10],[0,0,1080,1920],{width:270,height:480});assert.equal(s.width,44);assert.equal(s.height,44);
 const big=areaStyle([0,0,540,960],[0,0,1080,1920],{width:270,height:480});assert.equal(big.width,135)});
test('scene_layout: every background id maps to a game file, camera, horizon, floor; areas and occluders stay inside',()=>{
 const ids=Object.keys(layout.backgrounds);for(const id of ['BG01','BG02','BG03','BG04','BG05','BG06','BG07','BG08','BG09','BG10','BG11','BG12','BG13_2026'])assert.ok(ids.includes(id),id);
 for(const u of [layout.usage.intercom.background,layout.usage.desk.background,...Object.values(layout.usage.night_intro),...Object.values(layout.usage.cutscene_setting),...Object.values(layout.usage.evidence_backdrop)])assert.ok(layout.backgrounds[u].file,u+' used in the game has a game file');
 for(const [id,b] of Object.entries(layout.backgrounds)){if(id==='BG08')assert.equal(b.file,null,'BG08: approved file not in hand, no game copy');else assert.ok(existsSync(new URL('../dist/'+b.file,import.meta.url)),b.file);assert.deepEqual(b.size,[1080,1920]);assert.ok(['2004','2026'].includes(b.era),id);
  assert.ok(b.horizon_y>0&&b.horizon_y<1920&&b.floor_line_y>0&&b.floor_line_y<=1920,id);assert.ok(['v05_binding','visual_estimate'].includes(b.calibration),id);
  const inside=([x,y])=>x>=0&&x<=1080&&y>=0&&y<=1920;
  for(const r of Object.values(b.cameras))assert.ok(inside([r[0],r[1]])&&inside([r[0]+r[2],r[1]+r[3]]),id+' camera');
  for(const a of b.click_areas){if(Array.isArray(a.rect))assert.ok(inside([a.rect[0],a.rect[1]])&&inside([a.rect[0]+a.rect[2],a.rect[1]+a.rect[3]]),id+' '+a.id);if(a.action)assert.match(a.action,/^tool:(CCTV|명부|통화)$/)}
  for(const o of b.occluders)assert.ok(o.polygon.every(inside),id+' '+o.id);for(const p of [b.floor].filter(Boolean))assert.ok(p.every(inside),id+' floor')}
 assert.deepEqual(layout.backgrounds.BG01.click_areas.filter(a=>a.action).map(a=>a.action).sort(),['tool:CCTV','tool:명부','tool:통화']);
 assert.equal(layout.layers.join('>'),'background>back_objects>contact_shadow>character>foreground_occlusion>ui')});
test('era rule: 2004 backgrounds only behind 2004 records; present-day screens use 2026 backgrounds; no one stands in 404',()=>{const era=id=>layout.backgrounds[id].era,u=layout.usage;
 assert.equal(era(u.intercom.background),'2026');assert.equal(era(u.desk.background),'2026');for(const id of Object.values(u.night_intro))assert.equal(era(id),'2026',id);for(const id of Object.values(u.cutscene_setting))assert.equal(era(id),'2026',id);
 for(const [ev,id] of Object.entries(u.evidence_backdrop)){const x=evidence.evidence.find(e=>e.id===ev),years=(x.era+' '+(x.issued_at||'')).match(/(19|20)\d\d/g).map(Number);assert.ok(years.every(y=>y<2006)&&era(id)==='2004',ev+' '+x.era+' -> '+id)}
 const used2004=new Set(Object.values(u.evidence_backdrop));for(const [id,b] of Object.entries(layout.backgrounds))if(b.era==='2004')assert.ok(!Object.values(u.night_intro).includes(id)&&u.intercom.background!==id&&u.desk.background!==id,id);
 for(const id of ['BG10','BG11'])assert.deepEqual(layout.backgrounds[id].stand_points,{},id+' has no stand point (victims never appear alive in 2026)');assert.ok(used2004.size>0)});
test('walk_clips: NPC02-NPC10, 3 views x 48 frames, data per frame, REVISE everywhere, carrying arm and rig_path honoured',()=>{
 assert.deepEqual(Object.keys(walk.npcs),['NPC02','NPC03','NPC04','NPC05','NPC06','NPC07','NPC08','NPC09','NPC10']);assert.equal(walk.canvas.width,720);assert.equal(walk.canvas.height,1280);assert.equal(walk.canvas.design_scale,1.5);
 for(const [id,n] of Object.entries(walk.npcs)){assert.equal(n.fps,24);assert.equal(n.frames,48);assert.equal(n.frames_expected,144);assert.equal(n.engine_applied,false);assert.equal(n.qa_status,'REVISE');
  assert.equal(n.views.front.role,'enter');assert.equal(n.views.rear.role,'exit');
  for(const v of Object.values(n.views)){assert.equal(v.feet.length,48);assert.equal(v.bbox.length,48);assert.equal(v.shadows.length,48);
   for(const [x,y] of v.feet)assert.ok(x>0&&x<720&&y>0&&y<1280&&Number.isFinite(x+y));for(const b of v.bbox)assert.ok(b[0]<b[2]&&b[1]<b[3]);for(const s of v.shadows)assert.equal(s.length,2)}
  assert.ok(n.checks.foot_slide_mm.front<5,id+' rig keeps the planted foot')}
 assert.equal(walk.npcs.NPC06.rig,'walk_rig_elder_v04.json');assert.ok(walk.npcs.NPC06.checks.enter_exit_gap_m>.5,'NPC06 enter end and exit start do not meet (reported)');
 for(const id of ['NPC03','NPC09']){assert.equal(walk.npcs[id].carrying.driver,'Lshoulder');assert.match(walk.npcs[id].carrying.rear_mapping,/mirrored locally/)}
 for(const id of ['NPC02','NPC04','NPC05','NPC06','NPC07','NPC08','NPC10'])assert.equal(walk.npcs[id].carrying,undefined)});
test('REVISE clips never reach a game scene; the game does not load walk_clips.json',()=>{const atlas={base:'',src:'a.webp',scale:.5,frames:144,clips:{enter:{offset:0,frames:48},exit:{offset:48,frames:48},pass:{offset:96,frames:48}},rects:[]};
 assert.equal(clipActor('NPC03',walk.npcs.NPC03,atlas),null);assert.ok(clipActor('NPC03',walk.npcs.NPC03,atlas,{allowRevise:true}));assert.equal(clipActor('NPC03',{...walk.npcs.NPC03,qa_status:'PASS'},{...atlas,frames:100}),null,'incomplete atlas refused');
 for(const [id,n] of Object.entries(walk.npcs)){assert.equal(clipUsable(n),false,id+' is not usable in a game scene');assert.equal(clipActor(id,n,atlas),null)}
 // A package PASS alone is not enough: the frame review must pass front, rear and the sequence, and the seam must meet.
 const passed={...walk.npcs.NPC03,qa_status:'PASS',review:{views:{front:'PASS',side:'REVISE',rear:'PASS'},sequence:'PASS'}};
 assert.ok(clipActor('NPC03',passed,atlas),'all gates passed');assert.equal(clipActor('NPC03',{...walk.npcs.NPC03,qa_status:'PASS'},atlas),null,'no review');
 assert.equal(clipActor('NPC03',{...passed,review:{...passed.review,sequence:'REVISE'}},atlas),null,'turn/idle missing');
 assert.equal(clipActor('NPC03',{...passed,review:{...passed.review,views:{front:'PASS',rear:'REVISE'}}},atlas),null,'exit view not passed');
 assert.equal(clipActor('NPC06',{...walk.npcs.NPC06,qa_status:'PASS',review:passed.review},atlas),null,'NPC06 0.533 m seam refused even if marked PASS');
 assert.doesNotMatch(game,/walk_clips/);assert.doesNotMatch(game,/clipActor/);assert.equal(cameraOf(layout,'BG02','intercom').rect.length,4)});
