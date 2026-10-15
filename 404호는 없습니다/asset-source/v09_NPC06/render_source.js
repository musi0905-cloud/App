#!/usr/bin/env node
'use strict';
// v06 walk renderer, shared by NPC02-NPC10 (2026-10-14). A port of the producer's v05 render.js (four variants, now
// configs/<NPC>.json v05_variant) with the v06 fixes behind configs/default.json "fixes" and an enter -> settle -> idle ->
// turn -> start -> exit sequence. Inputs are only read: ../v05_QA/code/<NPC>/ (config.json, rig, carrying binding,
// assets/ part art restored 2026-10-14) and ../02_배경/game/BG02 (not drawn into sprites; sprites are figure-only RGBA).
//
//   node render_v06.js <NPC> <outDir> --mode=v05 [--views=front,side,rear]   delivered v05 sprites, byte for byte
//   node render_v06.js <NPC> <outDir> [--only=seq|pass] [--frames=0,47]      v06: seq/NNNN.png, pass/NNNN.png, frames.json
//   node render_v06.js NPC06 <outDir> --art=v07 [--v07-anchor=cuff|top]         NPC06 experiment with the v07 leg/torso sheets
//
// Rules kept from the contract: one fixed 720x1280 canvas and the BG02 camera (camera_v06.json, the only copy of the
// path constants); every joint goes through the same projection; no per-frame re-centring, no canvas move or scale, no
// mirroring to make a walk direction (the v05 shoe/prop flips are art orientation and are kept as delivered).
const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const HERE=__dirname,PROJECT=path.resolve(HERE,'..','..');
const readJSON=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const argv=process.argv.slice(2),pos=argv.filter(a=>!a.startsWith('--')),opt=Object.fromEntries(argv.filter(a=>a.startsWith('--')).map(a=>{const i=a.indexOf('=');return i<0?[a.slice(2),true]:[a.slice(2,i),a.slice(i+1)]}));
const NPC=pos[0];if(!/^NPC(0[2-9]|10)$/.test(NPC||''))throw Error('usage: node render_v06.js NPC06 <outDir> [--mode=v05]');
const OUT=path.resolve(pos[1]||path.join(HERE,'out',NPC)),MODE=opt.mode||'v06',V05=MODE==='v05';
// --art=v07: NPC06 experiment only (asset-source/v07_NPC06/binding_v07.json). Without it nothing below changes a v06 frame.
const ART07=opt.art==='v07',ANCHOR07=opt['v07-anchor']||'cuff';if(!['top','cuff'].includes(ANCHOR07))throw Error('--v07-anchor is cuff (default) or top');if(opt.art&&!ART07&&opt.art!=='v06')throw Error('--art is v06 or v07');if(ART07&&(NPC!=='NPC06'||V05))throw Error('--art=v07 exists only for NPC06 in v06 mode');
const SRC=path.join(PROJECT,'asset-source','v05_QA','code',NPC);
const CAM=readJSON(path.join(HERE,'camera_v06.json'));
const W=CAM.canvas[0],H=CAM.canvas[1],F=CAM.focal_px_design*W/CAM.design_width,HY=CAM.horizon_y_design*W/CAM.design_width,CH=CAM.camera_height_m;
const merge=(a,b)=>{const o={...a};for(const [k,v] of Object.entries(b||{}))o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&a?.[k]&&typeof a[k]==='object'?merge(a[k],v):v;return o};
const CONF=merge(readJSON(path.join(HERE,'configs','default.json')),fs.existsSync(path.join(HERE,'configs',NPC+'.json'))?readJSON(path.join(HERE,'configs',NPC+'.json')):{});
const VAR=CONF.v05_variant,FIX=V05?{}:CONF.fixes,SEQ=CONF.sequence;
const CFG=readJSON(path.join(SRC,'config.json')),ID=CFG.id,S=CFG.height_m/1.725;
const RIG_FILE=CFG.rig_path||'walk_rig_scene_retimed_v01.json',rig=readJSON(path.join(SRC,RIG_FILE));
const names=['head','torso','pelvis','Lupperarm','Lforearm','Lhand','Rupperarm','Rforearm','Rhand','Lthigh','Lshin','Lshoe','Rthigh','Rshin','Rshoe','prop'];
const HOLDS=CFG.prop&&!['shoulderbag','crossbody'].includes(CFG.prop);

// ---- vectors -----------------------------------------------------------------------------------------------------------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const len=a=>Math.hypot(...a),norm=a=>mul(a,1/(len(a)||1)),lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
// A stepping foot rises before it travels and comes straight down at the end (no toe or heel dragging on the floor).
const travel=s=>ease((s-.12)/.78);
const clone=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.slice()]));

// ---- floor frame: body-local (p0 forward, p1 up, p2 lateral, left negative) -> world (x right, y up, z away) ----------
// heading 0 = facing the camera, 90 = facing screen left, 180 = facing away. Exact values at the three art headings keep
// the v05 arithmetic of render.js line 50 (front x = -p2, z = origin - p0) bit for bit.
function axes(deg){if(deg===0)return {h:[0,-1],l:[1,0]};if(deg===90)return {h:[-1,0],l:[0,-1]};if(deg===180)return {h:[0,1],l:[-1,0]};
 const r=deg*Math.PI/180;return {h:[-Math.sin(r),-Math.cos(r)],l:[Math.cos(r),-Math.sin(r)]}}
function toWorld(p,o,deg,collapse=false){const {h,l}=axes(deg);return [o[0]+p[0]*h[0]-p[2]*l[0],p[1],collapse?o[1]:o[1]+p[0]*h[1]-p[2]*l[1]]}
function poseWorld(p,o,deg,collapse){return Object.fromEntries(Object.entries(p).map(([k,v])=>[k,toWorld(v,o,deg,collapse)]))}
const project=q=>{const [x,y,z]=q;return [W/2+F*x/z,HY+F*(CH-y)/z,F/z]};

// ---- rig poses (scaled, body-local) and the v06 pose fixes -------------------------------------------------------------
const rigPose=i=>Object.fromEntries(Object.entries(rig.frames[i].joints).map(([k,v])=>[k,v.map(x=>x*S)]));
const PLANT=.005;
function ik(hip,ankle,T,L,pole){let v=sub(ankle,hip),d=len(v);const u=mul(v,1/d);d=Math.min(d,(T+L)*.99995);
 const a=(T*T-L*L+d*d)/(2*d),h=Math.sqrt(Math.max(0,T*T-a*a));let n=sub(pole,mul(u,dot(pole,u)));n=norm(n);return add(add(hip,mul(u,a)),mul(n,h))}
const kneePole=(p,s)=>{const u=norm(sub(p[s+'ankle'],p[s+'hip'])),k=sub(p[s+'knee'],p[s+'hip']);return norm(sub(k,mul(u,dot(k,u))))};
const bones=(p,s)=>({T:len(sub(p[s+'knee'],p[s+'hip'])),L:len(sub(p[s+'ankle'],p[s+'knee']))});
const flexDeg=(p,s)=>{const a=sub(p[s+'hip'],p[s+'knee']),b=sub(p[s+'ankle'],p[s+'knee']);return 180-Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(len(a)*len(b)))))*180/Math.PI};
const UPPER=['root','neck','head','Lshoulder','Rshoulder','Lelbow','Relbow','Lwrist','Rwrist','Lhip','Rhip'];
// Pelvic obliquity and shoulder counter-roll (TORSO_STATIC): the hip of the swinging leg drops, the shoulder line tilts
// the other way; arms ride on their shoulder. Swing amount from the rig's own foot heights, so standing frames get none.
function counterRoll(p,amp,ratio){if(!amp)return p;const q=clone(p),sw=s=>Math.max(0,Math.min(1,Math.min(p[s+'heel'][1],p[s+'toe'][1])/(.03*S)));
 const rho=amp*(sw('R')-sw('L')),rot=(pt,c,a)=>{const d2=pt[2]-c[2],d1=pt[1]-c[1];return [pt[0],c[1]+d1*Math.cos(a)-d2*Math.sin(a),c[2]+d2*Math.cos(a)+d1*Math.sin(a)]};
 for(const s of 'LR')q[s+'hip']=rot(p[s+'hip'],p.root,rho);
 const chest=lerp(p.Lshoulder,p.Rshoulder,.5);for(const s of 'LR'){const n=rot(p[s+'shoulder'],chest,-rho*ratio),d=sub(n,p[s+'shoulder']);q[s+'shoulder']=n;q[s+'elbow']=add(p[s+'elbow'],d);q[s+'wrist']=add(p[s+'wrist'],d)}
 for(const s of 'LR'){const {T,L}=bones(p,s);q[s+'knee']=ik(q[s+'hip'],p[s+'ankle'],T,L,kneePole(p,s))}
 return q}
// Stance-knee retime (KNEE_CROUCH): while a foot is flat, raise the body until that knee bends at most maxDeg; never past
// the reach of either leg (feet stay exactly where the rig puts them), smoothed over the cycle so the rise is a bob.
function knee_lift(poses,maxDeg){const n=poses.length,raw=[],cap=[];
 for(const p of poses){let need=0,lim=Infinity;for(const s of 'LR'){const {T,L}=bones(p,s),A=p[s+'ankle'],Hh=p[s+'hip'],hz=Math.hypot(A[0]-Hh[0],A[2]-Hh[2]);
   lim=Math.min(lim,A[1]+Math.sqrt(Math.max(0,((T+L)*.998)**2-hz*hz))-Hh[1]);
   const flat=p[s+'heel'][1]<=PLANT&&p[s+'toe'][1]<=PLANT;if(flat){const dt=Math.sqrt(T*T+L*L+2*T*L*Math.cos(maxDeg*Math.PI/180));need=Math.max(need,A[1]+Math.sqrt(Math.max(0,dt*dt-hz*hz))-Hh[1])}}
  raw.push(Math.max(0,need));cap.push(Math.max(0,lim))}
 const sm=raw.map((_,i)=>{let s=0,w=0;for(let k=-4;k<=4;k++){const g=Math.exp(-k*k/(2*1.5*1.5));s+=g*raw[(i+k+n)%n];w+=g}return s/w});
 return sm.map((v,i)=>Math.min(Math.max(v,raw[i]),cap[i]))}
function lift(p,dy){if(!dy)return p;const q=clone(p);for(const k of UPPER)q[k]=[p[k][0],p[k][1]+dy,p[k][2]];
 for(const s of 'LR'){const {T,L}=bones(p,s);q[s+'knee']=ik(q[s+'hip'],p[s+'ankle'],T,L,kneePole(p,s))}return q}
// Carrying arm held still in v05 (render.js lines 54-58), kept as delivered: the v06 carry fix moves the drawn image.
function holdArm(p){if(!HOLDS)return p;const q=clone(p),sh=q.Lshoulder,hold=['parcel','folder'].includes(CFG.prop);q.Lwrist=[sh[0]+(hold?.25:.025)*S,sh[1]-(hold?.35:.545)*S,sh[2]];
 const v=q.Lwrist.map((x,i)=>x-sh[i]),d=Math.hypot(...v),u=v.map(x=>x/d),pole=[-1,0,0],dt=pole.reduce((a,x,i)=>a+x*u[i],0),n=pole.map((x,i)=>x-dt*u[i]),N=Math.hypot(...n),bend=Math.sqrt((.29*S)**2-d*d/4);q.Lelbow=sh.map((x,i)=>x+v[i]/2+n[i]/N*bend);return q}
const WALK=Array.from({length:48},(_,i)=>rigPose(i));
let LIFT=new Array(48).fill(0);
const fixedWalk=()=>{const rolled=WALK.map(p=>FIX.counter_roll?counterRoll(p,FIX.counter_roll.pelvis_rad,FIX.counter_roll.shoulder_ratio):p);
 if(FIX.stance_knee_max_deg)LIFT=knee_lift(rolled,FIX.stance_knee_max_deg);return rolled.map((p,i)=>holdArm(lift(p,LIFT[i])))};

// ---- art -----------------------------------------------------------------------------------------------------------------
const VIEWS={};let cb=null,carryImage=null;
async function loadArt(){
 const atlas=await loadImage(path.join(SRC,`assets/${ID}_3view_parts_atlas_v01.png`));
 const scan=createCanvas(atlas.width,atlas.height),sc=scan.getContext('2d');sc.drawImage(atlas,0,0);const pix=sc.getImageData(0,0,atlas.width,atlas.height).data;
 const seen=new Uint8Array(atlas.width*atlas.height),components=[];
 for(let seed=0;seed<seen.length;seed++){if(seen[seed]||pix[seed*4+3]<32)continue;let stack=[seed],count=0,l=atlas.width,r=0,t=atlas.height,b=0,sx=0,sy=0;seen[seed]=1;
  while(stack.length){let i=stack.pop(),x=i%atlas.width,y=Math.floor(i/atlas.width);count++;sx+=x;sy+=y;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
   for(const j of [x>0?i-1:-1,x<atlas.width-1?i+1:-1,y>0?i-atlas.width:-1,y<atlas.height-1?i+atlas.width:-1])if(j>=0&&!seen[j]&&pix[j*4+3]>=32){seen[j]=1;stack.push(j)}}
  if(count>500)components.push({count,cx:sx/count,cy:sy/count,x:l,y:t,w:r-l+1,h:b-t+1})}
 const torsoFile=VAR.torso_files.map(f=>path.join(SRC,`assets/${ID}${f}`)).find(f=>fs.existsSync(f))||null;
 const torsoImage=torsoFile?await loadImage(torsoFile):null,armPath=path.join(SRC,`assets/${ID}_continuous_arms_v03.png`),armAtlas=fs.existsSync(armPath)?await loadImage(armPath):null;
 if(VAR.carry){cb=readJSON(path.join(SRC,VAR.carry.binding));carryImage=await loadImage(path.join(SRC,cb.file))}
 for(const view of ['front','side','rear']){
  const rects={};
  for(let n=0;n<(CFG.prop?16:15);n++){const row=Math.floor(n/4),col=n%4,items=components.filter(c=>Math.floor(c.cy/atlas.height*4)===row).sort((a,b)=>a.cx-b.cx),expected=row===3&&!CFG.prop?9:12;
   if(items.length!==expected)throw Error('Atlas row '+row+' component count '+items.length+' expected '+expected);
   const {x,y,w,h}=items[['front','side','rear'].indexOf(view)*(row===3&&!CFG.prop?3:4)+col];rects[names[n]]={x,y,w,h}}
  let torsoRect=null;
  if(torsoImage){const cv=createCanvas(torsoImage.width,torsoImage.height),cx=cv.getContext('2d');cx.drawImage(torsoImage,0,0);const a=cx.getImageData(0,0,cv.width,cv.height).data,cell=['front','side','rear'].indexOf(view);let l=cv.width,r=0,t=cv.height,b=0;for(let y=0;y<cv.height;y++)for(let x=Math.floor(cell*cv.width/3);x<Math.floor((cell+1)*cv.width/3);x++)if(a[(y*cv.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}torsoRect={x:l,y:t,w:r-l+1,h:b-t+1}}
  const armRects={};
  if(armAtlas){const cv=createCanvas(armAtlas.width,armAtlas.height),cx=cv.getContext('2d');cx.drawImage(armAtlas,0,0);const a=cx.getImageData(0,0,cv.width,cv.height).data;
   const col=['front','side','rear'].indexOf(view),rows=ID==='NPC04'?3:2,offset=ID==='NPC04'?1:0;
   for(const [j,side] of ['L','R'].entries()){let l=cv.width,r=0,t=cv.height,b=0;for(let y=Math.floor((ID==='NPC04'?[.28,.65][j]:(j+offset)/rows)*cv.height);y<Math.floor((ID==='NPC04'?[.64,1][j]:(j+offset+1)/rows)*cv.height);y++)for(let x=Math.floor(col*cv.width/3);x<Math.floor((col+1)*cv.width/3);x++)if(a[(y*cv.width+x)*4+3]>64){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}armRects[side]={x:l,y:t,w:r-l+1,h:b-t+1}}}
  // Runtime alpha overlap reduces rigid cap seams without modifying source atlases (v05).
  const blendParts={};
  for(const name of ['Lupperarm','Rupperarm','Lthigh','Rthigh','Lshin','Rshin','pelvis']){const r=rects[name],cv=createCanvas(r.w,r.h),cx=cv.getContext('2d');cx.drawImage(atlas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
   const gradient=cx.createLinearGradient(0,0,0,r.h);gradient.addColorStop(0,name!=='pelvis'?'rgba(255,255,255,0)':'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,1)');gradient.addColorStop(name==='pelvis'?.75:.91,'rgba(255,255,255,1)');gradient.addColorStop(1,'rgba(255,255,255,0)');cx.globalCompositeOperation='destination-in';cx.fillStyle=gradient;cx.fillRect(0,0,r.w,r.h);blendParts[name]=cv}
  VIEWS[view]={atlas,rects,torsoImage,torsoRect,armAtlas,armRects,blendParts,shoeRects:{L:rects.Lshoe,R:rects.Rshoe},legTex:FIX.leg_mesh?{L:legTexture(atlas,rects,'L'),R:legTexture(atlas,rects,'R')}:null};
 }
 if(ART07){B07=readJSON(path.join(PROJECT,'asset-source','v07_NPC06','binding_v07.json'));for(const [k,f] of Object.entries(B07.sheets))SHEET07[k]=await loadImage(path.join(PROJECT,f))}
}
// ---- v07 experiment (NPC06): state pictures from the producer's sheets, placed rigidly at a fixed scale ------------------
let B07=null;const SHEET07={},CAL07={};
const shoulderTurn=(p,deg)=>{const {h,l}=axes(deg),d=sub(p.Lshoulder,p.Rshoulder);return Math.atan2(d[0]*h[0]+d[2]*h[1],d[0]*l[0]+d[2]*l[1])*180/Math.PI};
function v07State(fr){if(!ART07||fr.art==='side')return null;const view=fr.art,legs={};
 for(const s of 'LR'){const flex=flexDeg(fr.p,s),R=B07.leg_state_rule;legs[s]={flex:+flex.toFixed(1),state:flex<R.straight_below_deg?'straight':flex<R.knee60_from_deg?'knee30':'knee60'}}
 const yaw=shoulderTurn(fr.p,fr.geom_heading??fr.heading),th=B07.torso_state_rule.stride_rule_rendered.threshold_deg;
 const cell=Math.abs(yaw)<th?null:B07.torso_state_rule.cell_for_forward_shoulder[view+'.'+(yaw>0?'L':'R')];
 return {view,legs,torso:{yaw_deg:+yaw.toFixed(2),cell}}}
// Leg: the state picture's top-to-cuff line is turned onto the rig's leg-top-to-leg-end line (leg top 7.5 % of the thigh
// above the hip, leg end 0.077*S above the sole on the shoe, both v06), scale fixed per sheet, no stretch. Default anchor:
// the cuff attach on the leg end, the top slides under the pelvis and top_gap_px records by how much the drawn length falls
// short of (+) or passes (-) the leg top. --v07-anchor=top (first attempt, kept for the record) pins the top instead and
// cuff_gap_px records the shortfall at the shoe.
function v07LegPlace(fr,s,st,end){const L=B07.legs[st.view],part=L.parts.find(q=>q.side===s&&q.state===st.legs[s].state),p=fr.p;
 const top=add(p[s+'hip'],mul(sub(p[s+'hip'],p[s+'knee']),.075)),A=project(top),Bp=end||project([p[s+'ankle'][0],p[s+'ankle'][1]+.045*S,p[s+'ankle'][2]]);
 const k=F/((top[2]+p[s+'ankle'][2])/2),sx=L.scale.m_per_px_x*k,sy=(CAL07[st.view]??L.scale.m_per_px_y)*k,t=part.top_attach.xy,c=part.cuff_attach.xy;
 const ax=(c[0]-t[0])*sx,ay=(c[1]-t[1])*sy,rot=Math.atan2(Bp[1]-A[1],Bp[0]-A[0])-Math.atan2(ay,ax),drawn=Math.hypot(ax,ay),need=Math.hypot(Bp[0]-A[0],Bp[1]-A[1]);
 const O=ANCHOR07==='cuff'?[Bp[0]-(ax*Math.cos(rot)-ay*Math.sin(rot)),Bp[1]-(ax*Math.sin(rot)+ay*Math.cos(rot))]:A;
 const at=q=>{const x=(q[0]-t[0])*sx,y=(q[1]-t[1])*sy;return [O[0]+x*Math.cos(rot)-y*Math.sin(rot),O[1]+x*Math.sin(rot)+y*Math.cos(rot)]};
 return {part,A:O,rot,sx,sy,t,anchor:ANCHOR07,cuff_gap_px:ANCHOR07==='cuff'?0:need-drawn,top_gap_px:ANCHOR07==='cuff'?need-drawn:0,top_px:A.slice(0,2),top_drawn_px:O.slice(0,2),cuff_px:at(c),knee_px:at(part.knee.xy),end_px:Bp.slice(0,2)}}
// One continuous trouser texture per leg (LEG_STRIP): thigh rows over shin rows, cross-faded inside the texture so the knee
// is opaque (v05 faded both part ends to transparent and the floor showed through the knee band). Rows keep the v05
// mapping: thigh u in [-0.075, 1] -> its atlas rows (u+0.075)/1.15, shin u in [0, 1.065] -> (u+0.065)/1.13.
const LT={w:128,h:640,ov:.025};
function legTexture(atlas,rects,s){const tr=rects[s+'thigh'],sr=rects[s+'shin'],tk=LT.tk,c=createCanvas(LT.w,LT.h),g=c.getContext('2d');
 const us=y=>(y-tk)/(1-tk)*1.065,fs_=u=>(u+.065)/1.13,ut=y=>-.075+y/tk*1.075,ft=u=>(u+.075)/1.15;
 const y0=tk-LT.ov,f0=fs_(us(y0));g.drawImage(atlas,sr.x,sr.y+f0*sr.h,sr.w,(1-f0)*sr.h,0,y0*LT.h,LT.w,(1-y0)*LT.h);
 // destination-in clears everything outside the filled shape, so the fade covers the whole texture (opaque above yb).
 const yb=tk+(.91*1.13-.065)/1.065*(1-tk),gb=g.createLinearGradient(0,0,0,LT.h);gb.addColorStop(0,'rgba(255,255,255,1)');gb.addColorStop(yb,'rgba(255,255,255,1)');gb.addColorStop(1,'rgba(255,255,255,0)');
 g.globalCompositeOperation='destination-in';g.fillStyle=gb;g.fillRect(0,0,LT.w,LT.h);g.globalCompositeOperation='source-over';
 const t=createCanvas(LT.w,LT.h),h=t.getContext('2d'),y1=tk+LT.ov,f1=ft(ut(y1));h.drawImage(atlas,tr.x,tr.y,tr.w,f1*tr.h,0,0,LT.w,y1*LT.h);
 const gt=h.createLinearGradient(0,0,0,y1*LT.h);gt.addColorStop(0,'rgba(255,255,255,0)');gt.addColorStop(Math.min(.99,.126*tk/y1),'rgba(255,255,255,1)');gt.addColorStop((tk-LT.ov)/y1,'rgba(255,255,255,1)');gt.addColorStop(1,'rgba(255,255,255,0)');
 h.globalCompositeOperation='destination-in';h.fillStyle=gt;h.fillRect(0,0,LT.w,y1*LT.h);g.drawImage(t,0,0);return c}

// ---- one figure ----------------------------------------------------------------------------------------------------------
// fr: {art: 'front'|'side'|'rear', p: world joints, frame: v05 frame index (torso roll in --mode v05), heading}
// One figure canvas and one scratch canvas for the whole run (cleared per frame): fresh native canvases per frame are
// only released when the event loop turns, and a long synchronous sequence ran out of memory.
let ART=null,TMP=null;
function drawFigure(fr){
 const view=fr.art,V=VIEWS[view],{atlas,rects,torsoImage,torsoRect,armAtlas,armRects,blendParts,shoeRects}=V,p=fr.p,frame=fr.frame,st07=v07State(fr);
 ART??=createCanvas(W,H);TMP??=createCanvas(W,H);
 const art=ART,g=art.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,W,H);g.imageSmoothingEnabled=true;
 const lineAngle=(a,b)=>{let A=project(a),B=project(b);if(A[0]>B[0])[A,B]=[B,A];return Math.atan2(B[1]-A[1],B[0]-A[0])};
 const torsoAngle=view==='side'?0:FIX.counter_roll?lineAngle(p.Lshoulder,p.Rshoulder):Math.sin(frame/48*Math.PI*2)*.018;
 const pelvisAngle=view==='side'||!FIX.counter_roll?0:lineAngle(p.Lhip,p.Rhip);
 function part(name,a,b,width,over=.08,endScreen=null){
  const u=project(a),v=endScreen||project(b),dx=v[0]-u[0],dy=v[1]-u[1],len=Math.hypot(dx,dy),r=rects[name],scale=(u[2]+v[2])/2;
  g.save();g.translate(u[0],u[1]);g.rotate(Math.atan2(dy,dx)-Math.PI/2);if(blendParts[name])g.drawImage(blendParts[name],-width*scale/2,-len*over,width*scale,len*(1+2*over));else g.drawImage(atlas,r.x,r.y,r.w,r.h,-width*scale/2,-len*over,width*scale,len*(1+2*over));g.restore();
 }
 function fixed(name,pos,w,h,bottom=false){const a=project(pos),r=rects[name];
  if(name==='torso'&&st07?.torso.cell){const T7=B07.torso,c=T7.cells.find(q=>q.view===view&&q.cell===st07.torso.cell),o=c.crop_xywh,an=c.anchor.xy;
   g.save();g.translate(a[0],a[1]+h*a[2]*.85);g.rotate(torsoAngle-c.baked_shoulder_tilt_deg.value*Math.PI/180);g.scale(T7.scale.m_per_px_x*a[2],T7.scale.m_per_px_y*a[2]);g.imageSmoothingQuality='high';
   g.drawImage(SHEET07.torso,o[0],o[1],o[2],o[3],o[0]-an[0],o[1]-an[1],o[2],o[3]);g.restore();return}
  if(name==='torso'&&torsoImage){const q=torsoRect;g.save();g.translate(a[0],a[1]+h*a[2]*.85);g.rotate(torsoAngle);g.drawImage(torsoImage,q.x,q.y,q.w,q.h,-w*a[2]/2,-h*a[2]*.85,w*a[2],h*a[2]);g.restore();return;}
  if(name==='pelvis'&&pelvisAngle){g.save();g.translate(a[0],a[1]);g.rotate(pelvisAngle);g.drawImage(blendParts[name],-w*a[2]/2,-(bottom?h:0)*a[2],w*a[2],h*a[2]);g.restore();return}
  if(blendParts[name])g.drawImage(blendParts[name],a[0]-w*a[2]/2,a[1]-(bottom?h:0)*a[2],w*a[2],h*a[2]);else g.drawImage(atlas,r.x,r.y,r.w,r.h,a[0]-w*a[2]/2,a[1]-(bottom?h:0)*a[2],w*a[2],h*a[2]);}
 // Turn frames: each shoe uses the art of the way that foot points (a foot still facing the camera keeps the front
 // shoe under a profile body); walk frames always point the way their view was painted.
 const shoeView=s=>{if(fr.seg!=='turn')return view;const d=sub(p[s+'toe'],p[s+'heel']),n=Math.hypot(d[0],d[2])||1;return -d[0]/n>=.5?'side':-d[2]/n>=0?'front':'rear'};
 function shoe(s){const sv=shoeView(s);
  const heel=project(p[s+'heel']),toe=project(p[s+'toe']),ankle=project(p[s+'ankle']),r=VIEWS[sv].shoeRects[s];
  if(sv==='side'){let tx=toe[0]-heel[0],ty=toe[1]-heel[1];
   // Turn frames: a foot that still points toward the camera would put the profile shoe on a steep screen line; the
   // profile shoe keeps its own pitch (toe above heel) and at least 3/4 of its length, facing the way the art faces.
   if(fr.profileShoes){const fl=len(sub(p[s+'toe'],p[s+'heel']))*ankle[2];tx=-Math.max(Math.abs(tx),.75*fl);ty=-(p[s+'toe'][1]-p[s+'heel'][1])*ankle[2]}
   const sl=Math.hypot(tx,ty);g.save();g.translate(heel[0],heel[1]);g.rotate(Math.atan2(ty,tx)-Math.PI);if((CFG.flip_side_shoes||[]).includes(s)){g.scale(-1,1);g.drawImage(atlas,r.x,r.y,r.w,r.h,0,-.105*ankle[2],sl,.105*ankle[2]);}else g.drawImage(atlas,r.x,r.y,r.w,r.h,-sl,-.105*ankle[2],sl,.105*ankle[2]);g.restore();}
  else{const y=Math.max(heel[1],toe[1]),h=.108*S*ankle[2];g.drawImage(atlas,r.x,r.y,r.w,r.h,ankle[0]-.073*ankle[2],y-h,.146*ankle[2],h);}
 }
 function legMesh(s,end){
  // Perspective-correct trouser leg: points spaced along the 3D leg, each projected; strip width from its own depth.
  const hip=p[s+'hip'],knee=p[s+'knee'],ank=p[s+'ankle'],wt=(view==='side'?.174:.185)*S,ws=(view==='side'?.165:.17)*S;
  let bot=[ank[0],ank[1]+.045*S,ank[2]];if(end)bot=[(end[0]-W/2)*ank[2]/F,CH-(end[1]-HY)*ank[2]/F,ank[2]];
  const top=add(hip,mul(sub(hip,knee),.075)),botX=add(bot,mul(sub(bot,knee),.065)),k1=lerp(knee,hip,.12),k2=lerp(knee,bot,.12);
  const seg=(a,b,n)=>Array.from({length:n},(_,i)=>lerp(a,b,i/n)),bez=Array.from({length:8},(_,i)=>{const t=i/8;return add(add(mul(k1,(1-t)**2),mul(knee,2*t*(1-t))),mul(k2,t*t))});
  const pts=[...seg(top,k1,22),...bez,...seg(k2,botX,26),botX],arc=[0];for(let i=1;i<pts.length;i++)arc.push(arc[i-1]+len(sub(pts[i],pts[i-1])));
  const kIdx=22+4,ak=arc[kIdx],at=arc.at(-1),tk=LT.tk,tex=V.legTex[s];
  const tv=a=>a<=ak?a/ak*tk:tk+(a-ak)/(at-ak)*(1-tk),wd=v=>v<tk-LT.ov?wt:v>tk+LT.ov?ws:wt+(ws-wt)*(v-tk+LT.ov)/(2*LT.ov);
  const pr=pts.map(project);
  for(let i=0;i<pts.length-1;i++){const a=pr[i],b=pr[i+1],v0=tv(arc[i]),v1=tv(arc[i+1]),dX=b[0]-a[0],dY=b[1]-a[1],L=Math.hypot(dX,dY),width=(wd(v0)*a[2]+wd(v1)*b[2])/2;
   g.save();g.translate(a[0],a[1]);g.rotate(Math.atan2(dY,dX)-Math.PI/2);g.drawImage(tex,0,v0*LT.h,LT.w,Math.max(1,(v1-v0)*LT.h),-width/2,-.3,width,L+.6);g.restore()}
 }
 function leg(s){shoe(s);let end=null;
  if(shoeView(s)!=='side'){const heel=project(p[s+'heel']),toe=project(p[s+'toe']),ankle=project(p[s+'ankle']);end=[ankle[0],Math.max(heel[1],toe[1])-.077*S*ankle[2],ankle[2]];}
  if(st07){const q=v07LegPlace(fr,s,st07,end),o=q.part.crop_xywh;g.save();g.translate(q.A[0],q.A[1]);g.rotate(q.rot);g.scale(q.sx,q.sy);g.imageSmoothingQuality='high';
   g.drawImage(SHEET07[st07.view+'_leg'],o[0],o[1],o[2],o[3],o[0]-q.t[0],o[1]-q.t[1],o[2],o[3]);g.restore();return}
  if(FIX.leg_mesh){legMesh(s,end);return}
  part(s+'shin',p[s+'knee'],[p[s+'ankle'][0],p[s+'ankle'][1]+.045*S,p[s+'ankle'][2]],(view==='side'?.165:.17)*S,.065,end);part(s+'thigh',p[s+'hip'],p[s+'knee'],(view==='side'?.174:.185)*S,.075);
 }
 function meshArm(side,texSide=side,ctx=g){
  const r=armRects[texSide],sh=project(p[side+'shoulder']),el=project(p[side+'elbow']),wr=project(p[side+'wrist']),AW=FIX.arm?.width??.132,HE=FIX.arm?.hand_ext??.12;
  sh[1]+=(view==='side'?-.005:.035)*S*sh[2];if(view==='side')sh[0]+=.025*S*sh[2];
  let dx=wr[0]-el[0],dy=wr[1]-el[1],len=Math.hypot(dx,dy),end=[wr[0]+dx/len*HE*S*wr[2],wr[1]+dy/len*HE*S*wr[2],wr[2]];
  const pts=[sh,el,wr,end],ts=[0,.43,(CFG.arm_wrist_fraction||.74),1];let maxT=1;if(side==='L'&&HOLDS)maxT=['parcel','folder'].includes(CFG.prop)?.43:(CFG.arm_wrist_fraction||.74);
  function center(t){let j=t<ts[1]?0:t<ts[2]?1:2,z=(t-ts[j])/(ts[j+1]-ts[j]),h=ts[j+1]-ts[j];return pts[j].map((v,k)=>{const a=Math.max(0,j-1),b=Math.min(3,j+2),m0=(pts[j+1][k]-pts[a][k])/(ts[j+1]-ts[a]),m1=(pts[b][k]-pts[j][k])/(ts[b]-ts[j]);return (2*z*z*z-3*z*z+1)*v+(z*z*z-2*z*z+z)*h*m0+(-2*z*z*z+3*z*z)*pts[j+1][k]+(z*z*z-z*z)*h*m1})}
  for(let i=0;i<48;i++){const t=i/48;if(t>=maxT)break;const t2=Math.min((i+1)/48,maxT),a=center(t),b=center(t2),dX=b[0]-a[0],dY=b[1]-a[1],L=Math.hypot(dX,dY),width=AW*S*(a[2]+b[2])/2;
   ctx.save();ctx.translate(a[0],a[1]);ctx.rotate(Math.atan2(dY,dX)-Math.PI/2);ctx.drawImage(armAtlas,r.x,r.y+r.h*t,r.w,Math.max(1,r.h*(t2-t)),-width/2,-.3,width,L+.6);ctx.restore();}
 }
 function arm(s){
  if(VAR.carry&&s==='L')return; // unified shoulder-through-grip asset is drawn by drawProp (NPC03, NPC09)
  if(armAtlas){
   // FAR_ARM: in the side view the far arm uses the near arm's sleeve texture, in the body's shadow, behind the torso.
   if(FIX.far_arm_sleeve&&view==='side'&&s==='R'){const t=TMP,tg=t.getContext('2d');tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='source-over';tg.clearRect(0,0,W,H);tg.imageSmoothingEnabled=true;meshArm(s,'L',tg);tg.globalCompositeOperation='source-atop';tg.fillStyle=`rgba(8,10,12,${FIX.far_arm_sleeve.darken})`;tg.fillRect(0,0,W,H);tg.globalCompositeOperation='source-over';g.drawImage(t,0,0);return}
   meshArm(s);return;}
  if(s==='L'&&['parcel','folder'].includes(CFG.prop)){part(s+'upperarm',p[s+'shoulder'],p[s+'elbow'],.135*S,.08);return;}
  const w=p[s+'wrist'],e=p[s+'elbow'];const dir=[w[0]-e[0],w[1]-e[1],w[2]-e[2]],L=Math.hypot(...dir);const handend=w.map((v,i)=>v+dir[i]*.155/L);
  if(!(s==='L'&&HOLDS))part(s+'hand',w,handend,.094*S,.05);part(s+'forearm',p[s+'elbow'],w,.115*S,.12);part(s+'upperarm',p[s+'shoulder'],p[s+'elbow'],.135*S,.08);
 }
 function drawProp(){if(!CFG.prop)return;
  if(VAR.carry){const r=cb.views[view],q=project(p.Lshoulder),height=.60*S,scale=height*q[2]/r.h;
   // One source image preserves elbow-to-wrist anatomy (v05). CARRY_STATIC (v06): the image turns a few degrees about
   // the shoulder with the shoulder line and in step with the stride, and the parcel dips on each step.
   const cm=FIX.carry_motion,ph=(fr.phase??frame/48)*Math.PI*2,rot=cm?torsoAngle+cm.swing_rad*Math.sin(2*ph):0,dip=cm?cm.bounce_m*S*q[2]*Math.max(0,Math.sin(2*ph-.6)):0;
   g.save();g.translate(q[0]+(view==='side'?.025*S*q[2]:0),q[1]+(view==='side'?.00:.025)*S*q[2]+dip);if(rot)g.rotate(view==='side'?cm.swing_rad*Math.sin(2*ph):rot);if(view==='rear')g.scale(-1,1);g.scale(VAR.carry.scale_x,1);
   g.drawImage(carryImage,r.x,r.y,r.w,r.h,-r.shoulder_x*r.w*scale,0,r.w*scale,r.h*scale);g.restore();return}
  const kind=CFG.prop,r=rects.prop;
  if(['parcel','folder'].includes(kind)){const sh=p.Lshoulder,{h}=axes(fr.heading??0),top=[sh[0]+h[0]*.06*S,sh[1]-.11*S,sh[2]+h[1]*.06*S],q=project(top),width=(view==='side'?.27:.34)*S,height=.43*S;g.drawImage(atlas,r.x,r.y,r.w,r.h,q[0]-width*q[2]/2,q[1],width*q[2],height*q[2]);}
  else if(['shoulderbag','crossbody'].includes(kind)){const q=project(kind==='crossbody'?p.Rshoulder:p.Lshoulder),width=(kind==='crossbody'?(view==='side'?.24:.40):.25)*S,height=(kind==='crossbody'?.60:.56)*S;
   // Accessories preserve actual shoulder anchor; rear diagonal reverses with body direction (v05).
   g.save();g.translate(q[0],q[1]);if(view==='rear')g.scale(-1,1);g.drawImage(atlas,r.x,r.y,r.w,r.h,-width*q[2]*(kind==='shoulderbag'?.55:.15),0,width*q[2],height*q[2]);g.restore();}
  else{const q=project(p.Lwrist),height=({toolbox:.30,duffel:.34,foodbag:.42,keys:.14}[kind]||.35)*S,width=height*r.w/r.h;g.drawImage(atlas,r.x,r.y,r.w,r.h,q[0]-width*q[2]/2,q[1]-.015*q[2],width*q[2],height*q[2]);}
 }
 const far=view==='side'?'R':view==='rear'?'L':'R',near=far==='L'?'R':'L';
 arm(far);if(view!=='side')arm(near);
 if(FIX.leg_depth_order&&view!=='side'){const z=s=>(p[s+'hip'][2]+p[s+'knee'][2]+p[s+'ankle'][2])/3;const [a,b]=z('L')>=z('R')?['L','R']:['R','L'];leg(a);leg(b)}else{leg(far);leg(near)}
 const behind=view==='rear'&&['parcel','folder'].includes(CFG.prop);if(behind)drawProp();
 fixed('pelvis',[p.root[0],p.root[1]+.015,p.root[2]],(view==='side'?.27:.345)*S,.18*S);
 // Torso top to waist, lower hem hides the pelvis joint.
 fixed('torso',[p.root[0],p.root[1]+.535*S,p.root[2]],(view==='side'?.32:.425)*S,.57*S);
 // Fixed draws descend in screen coordinates: head/torso use positive world-height top.
 fixed('head',[p.head[0],p.head[1]+.06,p.head[2]],.235*S,.30*S);
 if(VAR.bag_below_near_arm_side){const bagBelowArm=view==='side'&&['shoulderbag','crossbody'].includes(CFG.prop);if(bagBelowArm&&!behind)drawProp();if(view==='side')arm(near);if(!behind&&!bagBelowArm)drawProp();}
 else{if(view==='side')arm(near);if(!behind)drawProp();}
 return art;
}

// ---- contact shadows (world feet -> the ellipse the engine draws; v05 render.js line 120, foot direction-aware) ---------
function shadows(p,view){return ['L','R'].map(s=>{const he=p[s+'heel'],to=p[s+'toe'],floor=[(he[0]+to[0])/2,0,(he[2]+to[2])/2],q=project(floor),lift=Math.max(0,Math.min(he[1],to[1]));
 const d=sub(to,he),side=Math.abs(d[0])/(Math.hypot(d[0],d[2])||1),base=view==='side'&&!FIX.side_lateral_depth?.145:.095+.05*side;
 return [+q[0].toFixed(2),+q[1].toFixed(2),+(base*S*q[2]*(1+lift*1.6)).toFixed(2),+(.028*S*q[2]*(1+lift*3)).toFixed(2),+(.32*Math.exp(-lift*20)).toFixed(3)]})}

// ---- the v06 sequence (world joints per frame) ---------------------------------------------------------------------------
const FOOT=['ankle','heel','toe'];
function standOffsets(walk){
 // Posture while standing: the rig's own mean upper-body offsets from the root over the cycle; arms hang at their
 // mean offset from the shoulder (the swing averages out). Foot shape from a frame where that foot is flat.
 const mean=f=>{const s=[0,0,0];for(const p of walk){const v=f(p);for(let i=0;i<3;i++)s[i]+=v[i]/walk.length}return s};
 const off={};for(const k of ['neck','head','Lshoulder','Rshoulder','Lhip','Rhip'])off[k]=mean(p=>sub(p[k],p.root));
 for(const s of 'LR'){off[s+'elbow']=mean(p=>sub(p[s+'elbow'],p[s+'shoulder']));off[s+'wrist']=mean(p=>sub(p[s+'wrist'],p[s+'shoulder']))}
 const foot={};for(const s of 'LR'){const p=walk.find(p=>p[s+'heel'][1]<=.002&&p[s+'toe'][1]<=.002)||walk[0];foot[s]={heel:sub(p[s+'heel'],p[s+'ankle']),toe:sub(p[s+'toe'],p[s+'ankle']),ankleY:p[s+'ankle'][1]}}
 return {off,foot}}
// Builds a standing pose (body-local, enter frame axes) whose feet are given; root over the support, knees at kneeDeg.
function standPose(st,feet,kneeDeg,bonesLR,poleLR){
 const p={};for(const s of 'LR')for(const k of FOOT)p[s+k]=feet[s][k].slice();
 const mid=lerp(p.Lankle,p.Rankle,.5),sup=lerp(lerp(p.Lheel,p.Ltoe,.5),lerp(p.Rheel,p.Rtoe,.5),.5),rx=mid[0]+(sup[0]-mid[0])*.5,rz=mid[2];
 let ry=Infinity;for(const s of 'LR'){const {T,L}=bonesLR[s],ho=st.off[s+'hip'],A=p[s+'ankle'],hz=Math.hypot(A[0]-(rx+ho[0]),A[2]-(rz+ho[2])),d=Math.sqrt(T*T+L*L+2*T*L*Math.cos(kneeDeg*Math.PI/180));ry=Math.min(ry,A[1]+Math.sqrt(Math.max(0,d*d-hz*hz))-ho[1])}
 p.root=[rx,ry,rz];for(const k of ['neck','head','Lshoulder','Rshoulder','Lhip','Rhip'])p[k]=add(p.root,st.off[k]);
 for(const s of 'LR'){p[s+'elbow']=add(p[s+'shoulder'],st.off[s+'elbow']);p[s+'wrist']=add(p[s+'shoulder'],st.off[s+'wrist']);p[s+'knee']=ik(p[s+'hip'],p[s+'ankle'],bonesLR[s].T,bonesLR[s].L,poleLR[s])}
 return holdArm(p)}
function blendPose(a,b,t,skip=[]){const o={};for(const k of Object.keys(b))o[k]=skip.includes(k)?b[k]:lerp(a[k],b[k],t);return o}
function buildSequence(walk){
 const enterO=CAM.paths.enter.origin,passO=CAM.paths.pass.origin,frames=[],st=standOffsets(walk);
 const bonesLR=Object.fromEntries(['L','R'].map(s=>[s,bones(walk[0],s)])),fwdPole={L:[1,0,0],R:[1,0,0]};
 const push=(seg,i,art,p,heading,extra={})=>frames.push({seg,i,art,p,heading,phase:extra.phase,frame:extra.frame??0,...extra});
 // enter: rig 0..47 on the enter path
 walk.forEach((p,i)=>push('enter',i,'front',poseWorld(p,enterO,0),0,{frame:i,phase:i/48,local:p}));
 // settle: the leading planted foot stays, the trailing foot steps up beside it, the root comes over both feet
 const P=walk[47],down=s=>Math.min(P[s+'heel'][1],P[s+'toe'][1])<=PLANT,lead=['L','R'].filter(down).sort((a,b)=>P[b+'ankle'][0]-P[a+'ankle'][0])[0],trail=lead==='L'?'R':'L';
 // The leading foot is on its heel or flat: it comes down flat about the heel (the heel never moves).
 const flatFoot=(s,ankle)=>({ankle,heel:add(ankle,st.foot[s].heel),toe:add(ankle,st.foot[s].toe)});
 const lHeel=P[lead+'heel'],lAnk=[lHeel[0]-st.foot[lead].heel[0],st.foot[lead].ankleY,lHeel[2]-st.foot[lead].heel[2]],feetStand={[lead]:flatFoot(lead,lAnk)};
 feetStand[lead].heel=lHeel.slice();feetStand[trail]=flatFoot(trail,[lAnk[0],lAnk[1],P[trail+'ankle'][2]]);
 const bones47={L:bones(P,'L'),R:bones(P,'R')},stand=standPose(st,feetStand,SEQ.idle_knee_deg,bonesLR,fwdPole),N1=SEQ.settle_frames,poles47={L:kneePole(P,'L'),R:kneePole(P,'R')};
 for(let k=1;k<=N1;k++){const s=k/N1,e=ease(s),q=blendPose(P,stand,e);
  for(const f of FOOT)q[lead+f]=lerp(P[lead+f],feetStand[lead][f],ease(Math.min(1,s*2)));q[lead+'heel']=lHeel.slice();
  const fsw=travel(s);for(const f of FOOT){q[trail+f]=lerp(P[trail+f],stand[trail+f],fsw);q[trail+f][1]+=.035*S*Math.sin(Math.PI*s)*(f==='toe'?.6:1)}
  for(const s2 of 'LR'){const T=bones47[s2].T+(bonesLR[s2].T-bones47[s2].T)*e,L=bones47[s2].L+(bonesLR[s2].L-bones47[s2].L)*e,pole=norm(lerp(poles47[s2],fwdPole[s2],e));q[s2+'knee']=ik(q[s2+'hip'],q[s2+'ankle'],T,L,pole)}
  push('settle',k,'front',poseWorld(holdArm(q),enterO,0),0,{phase:k/N1})}
 // stand point on the floor (world) and the standing pose relative to it
 const Ow=toWorld([stand.root[0],0,stand.root[2]],enterO,0),O=[Ow[0],Ow[2]],rel=Object.fromEntries(Object.entries(stand).map(([k,v])=>[k,[v[0]-stand.root[0],v[1],v[2]-stand.root[2]]]));
 // idle: in place, breathing and a slow weight shift; feet never move (loop of SEQ.idle_frames)
 const N2=SEQ.idle_frames;for(let i=1;i<=N2;i++){const a=2*Math.PI*i/N2,q=clone(rel),br=.004*S*Math.sin(a);
  for(const k of ['root','Lhip','Rhip','neck','head','Lshoulder','Rshoulder','Lelbow','Relbow','Lwrist','Rwrist'])q[k]=[q[k][0],q[k][1],q[k][2]+.004*S*Math.sin(a)];
  for(const k of ['neck','head','Lshoulder','Rshoulder','Lelbow','Relbow','Lwrist','Rwrist'])q[k][1]+=br;
  for(const s2 of 'LR'){const {T,L}=bonesLR[s2];q[s2+'knee']=ik(q[s2+'hip'],q[s2+'ankle'],T,L,fwdPole[s2])}
  push('idle',i,'front',poseWorld(holdArm(q),O,0),0,{phase:i/N2})}
 // turn: in place toward screen left (the person's right), four steps; a foot only moves while it is lifted
 const N3=SEQ.turn_frames,steps=SEQ.turn_steps,per=N3/steps.length,targets=[60,120,180,180],footAt={L:0,R:0};
 const footWorld=(s,deg)=>Object.fromEntries(FOOT.map(f=>[f,toWorld(rel[s+f],O,deg)]));
 let planted={L:footWorld('L',0),R:footWorld('R',0)};
 for(let k=1;k<=N3;k++){const si=Math.min(steps.length-1,Math.floor((k-1)/per)),s=(k-si*per)/per,e=ease(s),mover=steps[si],body=45*si+45*e;
  const from=footAt[mover],to=targets[si],deg=from+(to-from)*travel(s),mv=footWorld(mover,deg);for(const f of FOOT)mv[f][1]+=.03*S*Math.sin(Math.PI*s)*(f==='toe'?.7:1);
  // Three-view art: the body is drawn with the geometry of the angle its art was painted for (front <= 30, side 75-105,
  // rear >= 150); only the feet step round on the floor. Otherwise a profile torso would sit on 130-degree shoulders.
  const art=si===0?'front':si<3?'side':'rear',gdeg=art==='front'?Math.min(body,30):art==='side'?Math.max(75,Math.min(105,body)):Math.max(150,body);
  const feet={...planted,[mover]:mv},body3=Object.fromEntries(['root','neck','head','Lshoulder','Rshoulder','Lelbow','Relbow','Lwrist','Rwrist','Lhip','Rhip'].map(j=>[j,toWorld(rel[j],O,gdeg)]));
  const q={...body3};for(const s2 of 'LR')for(const f of FOOT)q[s2+f]=feet[s2][f];
  const {h}=axes(gdeg),pole=[h[0],0,h[1]];for(const s2 of 'LR'){const {T,L}=bonesLR[s2];q[s2+'knee']=ik(q[s2+'hip'],q[s2+'ankle'],T,L,pole)}
  push('turn',k,art,q,body,{phase:k/N3,step:si,mover,geom_heading:gdeg,profileShoes:art==='side'});
  if(s>=1-1e-9){footAt[mover]=to;planted={...planted,[mover]:footWorld(mover,to)}}}
 // start + exit: the exit path is placed so the rig's pushing-off foot at exit frame 0 is the foot already on the floor
 const R0=walk[0],lead0=R0.Lheel[0]>R0.Rheel[0]?'L':'R',pivot=lead0==='L'?'R':'L',sf=rel[pivot+'toe'],a0=R0[pivot+'toe'];
 const standRearWorld=Object.fromEntries(Object.entries(rel).map(([k,v])=>[k,toWorld(v,O,180)]));
 const exitO=[standRearWorld[pivot+'toe'][0]-a0[2],standRearWorld[pivot+'toe'][2]-a0[0]];
 const R0w=poseWorld(R0,exitO,180),N4=SEQ.start_frames,pole0={L:kneePole(R0w,'L'),R:kneePole(R0w,'R')},bones0={L:bones(R0,'L'),R:bones(R0,'R')},back=[0,0,1];
 for(let k=1;k<N4;k++){const s=k/N4,e=ease(s),q=blendPose(standRearWorld,R0w,e);
  for(const f of FOOT){q[pivot+f]=lerp(standRearWorld[pivot+f],R0w[pivot+f],e)}q[pivot+'toe']=standRearWorld[pivot+'toe'].slice();
  const fsw=travel(Math.min(1,s*1.08));for(const f of FOOT){q[lead0+f]=lerp(standRearWorld[lead0+f],R0w[lead0+f],fsw);q[lead0+f][1]+=.03*S*Math.sin(Math.PI*Math.min(1,s*1.08))*(f==='toe'?.7:1)}
  for(const s2 of 'LR'){const T=bonesLR[s2].T+(bones0[s2].T-bonesLR[s2].T)*e,L=bonesLR[s2].L+(bones0[s2].L-bonesLR[s2].L)*e,pole=norm(lerp(back,pole0[s2],e));q[s2+'knee']=ik(q[s2+'hip'],q[s2+'ankle'],T,L,pole)}
  push('start',k,'rear',q,180,{phase:k/N4})}
 walk.forEach((p,i)=>push('exit',i,'rear',poseWorld(p,exitO,180),180,{frame:i,phase:i/48,local:p}));
 return {frames,meta:{lead_at_enter_end:lead,trail_at_enter_end:trail,stand_point_world:[+O[0].toFixed(4),+O[1].toFixed(4)],stand_root_height_m:+stand.root[1].toFixed(4),
  exit_origin_world:[+exitO[0].toFixed(4),+exitO[1].toFixed(4)],exit_pivot_foot:pivot,enter_origin_world:enterO,
  enter_end_root_world:[+frames[47].p.root[0].toFixed(4),+frames[47].p.root[2].toFixed(4)],exit_start_root_world:[+frames.find(f=>f.seg==='exit').p.root[0].toFixed(4),+frames.find(f=>f.seg==='exit').p.root[2].toFixed(4)]}}}

// Fixed y scale per sheet, set once from standing frames (front: idle; rear: the last turn frame, both feet flat): the
// straight state's mean top-to-cuff length equals the mean v06 leg top-to-leg-end screen distance there. (The v06 leg end
// sits on the projected toe line, 0.077*S above the sole, not straight under the ankle, so a world-length scale left
// 27-34 px gaps at rest; see binding_v07.json scale.method_change.)
function v07Calibrate(frames){const ref={front:frames.filter(f=>f.seg==='idle'),rear:[frames.filter(f=>f.seg==='turn').at(-1)]},out={};
 for(const view of ['front','rear']){const L=B07.legs[view],st=L.parts.filter(q=>q.state==='straight'),px=st.reduce((a,q)=>a+q.top_to_cuff_px,0)/st.length;let m=0,n=0;
  for(const f of ref[view]){if(f.art!==view)throw Error('v07 calibration frame is not '+view);for(const s of 'LR'){const p=f.p,top=add(p[s+'hip'],mul(sub(p[s+'hip'],p[s+'knee']),.075)),heel=project(p[s+'heel']),toe=project(p[s+'toe']),an=project(p[s+'ankle']),A=project(top);
   m+=Math.hypot(an[0]-A[0],Math.max(heel[1],toe[1])-.077*S*an[2]-A[1])*((top[2]+p[s+'ankle'][2])/2)/F;n++}}
  CAL07[view]=m/n/px;out[view]={m_per_px_y:+CAL07[view].toFixed(7),reference:view==='front'?'idle (48 frames, both legs)':'turn frame 40 (rear, standing)',straight_px:+px.toFixed(1),world_estimate_m_per_px_y:L.scale.m_per_px_y}}
 return out}
// v07 per-frame record: the states chosen and where the placed pictures put the knee and the cuff (screen px).
function v07Info(f){const st=v07State(f);if(!st)return null;const r2=v=>v.map(x=>+x.toFixed(2)),legs={};
 for(const s of 'LR'){let end=null;const sv=f.seg==='turn'?(()=>{const d=sub(f.p[s+'toe'],f.p[s+'heel']),n=Math.hypot(d[0],d[2])||1;return -d[0]/n>=.5?'side':-d[2]/n>=0?'front':'rear'})():f.art;
  if(sv!=='side'){const heel=project(f.p[s+'heel']),toe=project(f.p[s+'toe']),ankle=project(f.p[s+'ankle']);end=[ankle[0],Math.max(heel[1],toe[1])-.077*S*ankle[2],ankle[2]]}
  const q=v07LegPlace(f,s,st,end);legs[s]={...st.legs[s],cuff_gap_px:+q.cuff_gap_px.toFixed(2),...(ANCHOR07==='cuff'?{top_gap_px:+q.top_gap_px.toFixed(2),top_drawn_px:r2(q.top_drawn_px)}:{}),top_px:r2(q.top_px),knee_px:r2(q.knee_px),cuff_px:r2(q.cuff_px),end_px:r2(q.end_px),rot_deg:+(q.rot*180/Math.PI).toFixed(2)}}
 return {view:st.view,legs,torso:st.torso}}

// ---- main ------------------------------------------------------------------------------------------------------------------
async function main(){
 const walk=V05?WALK.map(holdArm):fixedWalk();
 if(!V05){const b=bones(walk[0],'L');LT.tk=(b.T*1.075)/(b.T*1.075+b.L*1.065)}
 await loadArt();
 fs.mkdirSync(OUT,{recursive:true});const only=opt.only?String(opt.only).split(','):null,pick=opt.frames?String(opt.frames).split(',').map(Number):null;
 // Encoded PNGs are released by the collector; collect after every frame when node runs with --expose-gc (run_all.sh).
 const save=async(dir,i,fr)=>{fs.mkdirSync(path.join(OUT,dir),{recursive:true});const art=drawFigure(fr);fs.writeFileSync(path.join(OUT,dir,String(i).padStart(4,'0')+'.png'),art.toBuffer('image/png'));if(global.gc)global.gc();await new Promise(r=>setImmediate(r))};
 if(V05){const P={front:[CAM.paths.enter.origin,0],side:[CAM.paths.pass.origin,90],rear:[CAM.paths.exit_v05.origin,180]};
  for(const view of (opt.views?String(opt.views).split(','):['front','side','rear']))for(const i of (pick||Array.from({length:48},(_,i)=>i)))await save(view,i,{art:view,p:poseWorld(walk[i],P[view][0],P[view][1],view==='side'),frame:i,heading:P[view][1]});
  console.log('v05 mode: rendered');return}
 const report={npc:NPC,mode:MODE,rig:RIG_FILE,height_m:CFG.height_m,S,camera:{W,H,F,HY,CH},fixes:FIX,sequence_config:SEQ,knee_lift_m:LIFT.map(v=>+v.toFixed(4)),
  stance_knee_flex_deg:walk.map(p=>Object.fromEntries(['L','R'].filter(s=>p[s+'heel'][1]<=PLANT&&p[s+'toe'][1]<=PLANT).map(s=>[s,+flexDeg(p,s).toFixed(1)]))),
  rig_stance_knee_flex_deg:WALK.map(p=>Object.fromEntries(['L','R'].filter(s=>p[s+'heel'][1]<=PLANT&&p[s+'toe'][1]<=PLANT).map(s=>[s,+flexDeg(p,s).toFixed(1)]))),...(ART07?{art:'v07',binding:'asset-source/v07_NPC06/binding_v07.json',v07_anchor:ANCHOR07}:{})};
 // Per-frame record (world joints that matter for QA, their projection, engine shadows, knee angles).
 const info=(f,n)=>{const pr=k=>project(f.p[k]).slice(0,2).map(v=>+v.toFixed(2));return {n,seg:f.seg,i:f.i,art:f.art,heading:+f.heading.toFixed(2),
   root_world:f.p.root.map(v=>+v.toFixed(4)),feet_world:Object.fromEntries(['L','R'].map(s=>[s,{heel:f.p[s+'heel'].map(v=>+v.toFixed(4)),toe:f.p[s+'toe'].map(v=>+v.toFixed(4)),ankle:f.p[s+'ankle'].map(v=>+v.toFixed(4))}])),
   root_px:pr('root'),head_px:pr('head'),legs_px:Object.fromEntries(['L','R'].map(s=>[s,{hip:pr(s+'hip'),knee:pr(s+'knee'),ankle:pr(s+'ankle')}])),shoulders_px:{L:pr('Lshoulder'),R:pr('Rshoulder')},
   feet_px:Object.fromEntries(['L','R'].map(s=>[s,{heel:pr(s+'heel'),toe:pr(s+'toe')}])),shadows:shadows(f.p,f.art),knee_flex_deg:{L:+flexDeg(f.p,'L').toFixed(1),R:+flexDeg(f.p,'R').toFixed(1)},...(ART07?{v07:v07Info(f)}:{})}};
 // The report is always complete; --only limits which images are written (the rest are byte-identical re-renders).
 {const {frames,meta}=buildSequence(walk);report.sequence=meta;report.segments={};if(ART07)report.v07_calibration=v07Calibrate(frames);
  frames.forEach((f,n)=>{report.segments[f.seg]??={offset:n,frames:0,art:new Set()};report.segments[f.seg].frames++;report.segments[f.seg].art.add(f.art)});
  for(const s of Object.values(report.segments))s.art=[...s.art];
  report.frames=frames.map(info);
  if(!only||only.includes('seq'))for(const [n,f] of frames.entries())if(!pick||pick.includes(n))await save('seq',n,f)}
 {report.pass=[];for(const [i,p] of walk.entries()){const w=poseWorld(p,CAM.paths.pass.origin,90,!FIX.side_lateral_depth),f={seg:'pass',i,art:'side',p:w,frame:i,phase:i/48,heading:90};report.pass.push(info(f,i));if(!only||only.includes('pass'))if(!pick||pick.includes(i))await save('pass',i,f)}}
 fs.writeFileSync(path.join(OUT,'frames.json'),JSON.stringify(report));
 console.log(NPC,'v06',report.sequence?JSON.stringify(report.sequence):'',report.segments?Object.entries(report.segments).map(([k,v])=>k+':'+v.frames).join(' '):'');
}
main().catch(e=>{console.error(e);process.exit(1)});

