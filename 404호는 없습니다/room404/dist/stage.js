// Layered scene stage (v0.16.0): background -> back objects -> contact shadow -> character -> foreground occlusion -> UI.
// Coordinates are the background's design space (1080x1920, data/scene_layout.json). A camera is a fixed crop of that
// space; the canvas keeps one transform for the whole scene, so clip frames (root motion baked in) are never re-centred.
// Characters: a still image standing at a stand point (scaled by the camera model, never moved), or a walk clip whose
// frames cover the whole background frame (walk_clips.json, design_scale 1.5). Timing comes from walk.js.
import {createWalker,createSequence} from './walk.js';
import {loadClip,loadPages} from './figures.js';
const images=new Map();
export function loadImage(src){if(!images.has(src))images.set(src,new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>{images.delete(src);no(Error('image '+src))};im.src=src}));return images.get(src)}
// Floor depth of a foot line under the scene's camera model (BG02: v05 binding; others: the same 1.6 m / 1100 px estimate).
export function depthAt(bg,footY){const c=bg.camera_model||{horizon_y:bg.horizon_y,focal_px:1100,camera_height_m:1.6};return c.focal_px*c.camera_height_m/Math.max(1,footY-c.horizon_y)}
// A still figure on its stand point: design-space box, the depth it stands at, and the two foot shadows. The shadow
// ellipses use the v05 renderer's formula (render.js) for a foot resting on the floor (lift 0), under each measured sole
// (fig.feet, image px) or 0.09 m either side of the pivot when the soles were not measured.
export function placeStill(bg,stand,fig){const c=bg.camera_model||{focal_px:1100},z=stand.z||depthAt(bg,stand.y),q=c.focal_px/z,S=fig.height_m/1.725;
 const scale=fig.height_m*q/fig.height_px,w=fig.size[0]*scale,h=fig.size[1]*scale,x=stand.x-fig.foot[0]*scale,y=stand.y-fig.foot[1]*scale;
 const top=stand.y-fig.height_px*scale;
 const shadows=(fig.feet||[[fig.foot[0]-.09*S*q/scale],[fig.foot[0]+.09*S*q/scale]]).map(([fx])=>[stand.x+(fx-fig.foot[0])*scale,stand.y,.095*S*q,.028*S*q,.32]);
 return {x,y,w,h,z,scale,box:[stand.x-w/2,top,stand.x+w/2,stand.y],shadows}}
// A walk clip may stand in a game scene only when (README_CLAUDE_CODE_v02 3항 + the v05 frame review) the package QA status
// is PASS, the frame review passed the enter (front) and exit (rear) views and the enter -> idle -> exit sequence, and the
// clip's enter end and exit start meet (rig gap <= 0.15 m): a package PASS alone never puts a teleporting pair on screen.
// The QA viewer passes allowRevise. Returns the stage actor for an npc entry of walk_clips.json and its atlas.json, or null.
export function clipUsable(entry){const r=entry?.review;return !!entry&&entry.qa_status==='PASS'&&r?.views?.front==='PASS'&&r?.views?.rear==='PASS'&&r?.sequence==='PASS'&&(entry.checks?.enter_exit_gap_m??Infinity)<=.15}
export function clipActor(id,entry,atlas,{allowRevise=false}={}){if(!entry||!atlas||!(allowRevise||clipUsable(entry)))return null;
 if(atlas.frames!==entry.frames_expected||Object.values(atlas.clips).some(c=>c.frames!==entry.frames))return null;
 return {kind:'clip',id,binding:{...entry,design_scale:1.5},atlas:{src:atlas.base+atlas.src,scale:atlas.scale,rects:atlas.rects,cols:1,cell:[0,0]},clips:{enter:atlas.clips.enter,exit:atlas.clips.exit}}}
export function cameraOf(layout,bgId,camera){const bg=layout.backgrounds[bgId];if(!bg)throw Error('unknown background '+bgId);const r=bg.cameras[camera]||bg.cameras.full;return {bg,rect:r}}
// Click-area rectangles in percent of the camera view, grown to at least `minPx` CSS pixels for touch.
export function areaStyle(rect,cam,box,minPx=44){const [cx,cy,cw,ch]=cam,[x,y,w,h]=rect,sw=box.width/cw,sh=box.height/ch;let L=(x-cx)*sw,T=(y-cy)*sh,W=w*sw,H=h*sh;
 if(W<minPx){L-=(minPx-W)/2;W=minPx}if(H<minPx){T-=(minPx-H)/2;H=minPx}return {left:L,top:T,width:W,height:H}}
function poly(ctx,pts){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}
function shadow(ctx,[x,y,rx,ry,a]){ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(7,11,13,${a})`);g.addColorStop(.5,`rgba(7,11,13,${a*.45})`);g.addColorStop(1,'rgba(7,11,13,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore()}
// host: an element sized by CSS (its aspect should match the camera). opts:
//  layout, background, camera, actor: null | {kind:'still', id, src, size, foot, height_px, height_m, label}
//   | {kind:'clip', id, clips:{enter,exit,idle}, atlas:{src, cell:[w,h], cols, rects?}, binding (walk_clips npc entry)}
//   | {kind:'seq', id, record (visitor_figures.json intercom_clips entry), fallback (a still actor)}: a verified
//     enter -> settle -> idle -> turn -> start -> exit clip (figures.js loadClip/loadPages). If any of its files fails
//     to load or to match its SHA-256, the fallback still figure waits in place instead and the error is logged.
//  areas: [{id, rect|'figure', label, onClick}] (shown as buttons), reduced: no timed motion, label: canvas description,
//  stand: stand point name (default 'idle'), base: prefix for file paths (the QA viewer lives outside dist/).
export function mountStage(host,opts){
 const {layout,background,camera='full',reduced=false}=opts,{bg,rect:cam}=cameraOf(layout,background,camera);let actor=opts.actor||null;
 host.classList.add('stage');for(const k of ['trail','seg','frame','fallback','state','pages'])delete host.dataset[k];host.dataset.background=background;host.dataset.camera=camera;host.dataset.actor=actor?`${actor.kind}:${actor.id}`:'';
 let canvas=host.querySelector('canvas.stage-canvas');if(!canvas){canvas=document.createElement('canvas');canvas.className='stage-canvas';host.prepend(canvas)}
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',opts.label||bg.name);
 let layer=host.querySelector('.stage-areas');if(!layer){layer=document.createElement('div');layer.className='stage-areas';canvas.after(layer)}
 const ctx=canvas.getContext('2d'),fig=document.createElement('canvas'),fx=fig.getContext('2d');let bgImage=null,actorImage=null,raf=0,alive=true,placed=null,last=null;
 const fps=actor?.binding?.fps||24,clipOf=k=>actor?.kind==='clip'&&actor.clips?.[k]?{frames:actor.clips[k].frames}:null;
 let walker=createWalker({clips:{enter:clipOf('enter'),exit:clipOf('exit'),idle:clipOf('idle')},fps,instant:reduced});
 // Sequence actor state: the verified clip, its decoded pages (by index), the exit pages' promise, the state trail.
 let seq=null,pages={},leavePages=null,early=false;const trail=[];
 const now=()=>performance.now()/1000;
 function useFallback(e){console.error(`[stage] ${actor?.id} sequence unavailable, still figure shown instead: ${e?.message||e}`);host.dataset.fallback='still';
  const fb=actor?.fallback||null;releasePages();seq=null;actor=fb;host.dataset.actor=actor?`${actor.kind}:${actor.id}`:'';walker=createWalker({instant:reduced});placed=actor?.kind==='still'?placeStill(bg,bg.stand_points[opts.stand||'idle'],actor):null;
  return actor?.src?loadImage(url(actor.src)).then(im=>{actorImage=im}).catch(()=>{actorImage=null}):null}
 function releasePages(){for(const im of Object.values(pages))im?.close?.();pages={}}
 function size(){const r=host.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}return r}
 function figureBox(st){if(!actor||st.alpha<=0)return null;if(actor.kind==='still')return placed.box;
  if(actor.kind==='seq'){const g=seq&&st.seg&&seq.segments[st.seg],r=g&&seq.frames[g.offset+st.frame];if(!r)return null;const k=seq.design_scale;return [r[5]*k,r[6]*k,(r[5]+r[3])*k,(r[6]+r[4])*k]}
  const v=actor.binding.views[{enter:'front',exit:'rear',idle:'front'}[st.clip]],b=v?.bbox[st.frame];if(!b)return null;const k=actor.binding.design_scale||1.5;return b.map(n=>n*k)}
 function draw(){if(!alive)return;raf=0;const t=now(),st=walker.at(t),r=size();last=st;
  const sx=canvas.width/cam[2],sy=canvas.height/cam[3];ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b1112';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(sx,0,0,sy,-cam[0]*sx,-cam[1]*sy);
  const bgDraw=()=>{if(bgImage)ctx.drawImage(bgImage,0,0,bg.size[0],bg.size[1])};
  bgDraw(); // 1 background
  for(const o of bg.back_objects||[])if(o.image)ctx.drawImage(o.image,...o.rect); // 2 back objects (none authored yet)
  if(actor&&st.alpha>0&&(actorImage||actor.kind==='seq')){
   // The figure is painted on its own layer first so the scene's light wash (bg.figure_grade, the v05 renderer's
   // source-atop gradient) touches only the figure, then that layer goes onto the scene with the state's opacity.
   if(fig.width!==canvas.width||fig.height!==canvas.height){fig.width=canvas.width;fig.height=canvas.height}
   fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,fig.width,fig.height);fx.setTransform(sx,0,0,sy,-cam[0]*sx,-cam[1]*sy);ctx.globalAlpha=st.alpha;
   if(actor.kind==='still'){placed.shadows.forEach(s=>shadow(ctx,s));fx.drawImage(actorImage,placed.x,placed.y,placed.w,placed.h)} // 3 shadow, 4 character
   else if(actor.kind==='seq'){const g=seq&&st.seg&&seq.segments[st.seg];if(g){const i=g.offset+st.frame,r=seq.frames[i],im=pages[r[0]],k=seq.design_scale;
    // The frame's own contact shadows, then its trimmed rect at its own place on the fixed 720x1280 canvas (x1.5).
    (seq.shadows[i]||[]).forEach(s=>shadow(ctx,[s[0]*k,s[1]*k,s[2]*k,s[3]*k,s[4]]));if(im)fx.drawImage(im,r[1],r[2],r[3],r[4],r[5]*k,r[6]*k,r[3]*k,r[4]*k);host.dataset.seg=st.seg}}
   else if(st.clip){const k=actor.binding.design_scale||1.5,v=actor.binding.views[{enter:'front',exit:'rear',idle:'front'}[st.clip]];
    (v?.shadows[st.frame]||[]).forEach(s=>shadow(ctx,[s[0]*k,s[1]*k,s[2]*k,s[3]*k,s[4]]));
    const a=actor.atlas,c=actor.clips[st.clip],i=(c.offset||0)+st.frame,col=i%a.cols,row=Math.floor(i/a.cols),rr=a.rects?.[i];
    // Every frame is drawn into the same full-frame box: the clip canvas (720x1280) maps onto the whole background.
    if(rr)fx.drawImage(actorImage,rr[0],rr[1],rr[2],rr[3],rr[4]*k,rr[5]*k,rr[2]/a.scale*k,rr[3]/a.scale*k);
    else fx.drawImage(actorImage,col*a.cell[0],row*a.cell[1],a.cell[0],a.cell[1],0,0,bg.size[0],bg.size[1])}
   const g=bg.figure_grade;if(g){const lg=fx.createLinearGradient(0,g.y0,0,g.y1);lg.addColorStop(0,g.from);lg.addColorStop(1,g.to);fx.globalCompositeOperation='source-atop';fx.fillStyle=lg;fx.fillRect(cam[0],cam[1],cam[2],cam[3]);fx.globalCompositeOperation='source-over'}
   ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fig,0,0);ctx.setTransform(sx,0,0,sy,-cam[0]*sx,-cam[1]*sy);
   ctx.globalAlpha=1;
   for(const o of bg.occluders||[]){ctx.save();poly(ctx,o.polygon);ctx.clip();bgDraw();ctx.restore()} // 5 foreground occlusion
  }
  areas(r,st); // 6 UI (DOM buttons over the canvas)
  host.dataset.state=st.state;if(st.clip||st.seg)host.dataset.frame=String(st.frame);else delete host.dataset.frame;
  // Keep animating while something moves on screen; a hidden stage (0 px, other screen) stops until redraw().
  const moving=actor?.kind==='seq'?!['hidden','gone'].includes(st.state)&&!(reduced&&st.state==='idle'):st.state==='enter'||st.state==='exit';
  if(moving&&r.width>0)raf=requestAnimationFrame(draw)}
 function areas(r,st){const list=opts.areas||[],box=figureBox(st);
  for(const a of list){let b=layer.querySelector(`[data-area="${a.id}"]`);if(!b){b=document.createElement('button');b.type='button';b.className='stage-area';b.dataset.area=a.id;b.setAttribute('aria-label',a.label);b.onclick=()=>a.onClick?.(a.id);layer.append(b)}
   const rect=a.rect==='figure'?(box?[box[0],box[1],box[2]-box[0],box[3]-box[1]]:null):a.rect;b.hidden=!rect||st.state!=='idle'&&a.rect==='figure';
   if(rect){const s=areaStyle(rect,cam,r);Object.assign(b.style,{left:s.left+'px',top:s.top+'px',width:s.width+'px',height:s.height+'px'})}}}
 const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(!raf)draw()}):null;ro?.observe(host);
 const url=p=>(opts.base||'')+p;
 // A sequence loads its clip and the arrive + stay pages before it may start (reduced motion: the stay pages only, for
 // the still idle frame); the leave pages follow in the background. Nothing of it is decoded before this visitor.
 const loadSeq=async()=>{const rec=actor.record;seq=await loadClip(rec,opts.base||'');if(!alive)return;
  // Pages of a group that can no longer be shown are closed at once (arrive after the arrival, stay once the walk-off
  // starts), so a phone holds at most two groups decoded.
  const count=()=>{host.dataset.pages=String(Object.keys(pages).length)};
  const drop=g=>{seq?.pages.forEach((p,i)=>{if(p.group===g&&pages[i]){pages[i].close?.();delete pages[i]}});count()};
  walker=createSequence({segments:seq.segments,fps:seq.fps,instant:reduced,turnEntries:seq.turn_entries,onState:s=>{trail.push(s);host.dataset.trail=trail.join('>');if(s==='idle'&&!reduced)drop('arrive');if(s==='start')drop('stay');opts.onState?.(s)}});
  const take=g=>loadPages(seq,rec,g,opts.base||'').then(p=>{if(alive){Object.assign(pages,p);count()}else for(const im of Object.values(p))im?.close?.()});
  await Promise.all((reduced?['stay']:['arrive','stay']).map(take));leavePages=reduced?Promise.resolve():take('leave');leavePages.catch(()=>{})};
 const ready=Promise.all([loadImage(url(bg.file)).then(im=>{bgImage=im}),actor?.kind==='seq'?loadSeq().catch(useFallback):actor?.src?loadImage(url(actor.src)).then(im=>{actorImage=im}).catch(()=>{actorImage=null}):actor?.atlas?loadImage(url(actor.atlas.src)).then(im=>{actorImage=im}):null]).catch(()=>{});
 if(actor?.kind==='still')placed=placeStill(bg,bg.stand_points[opts.stand||'idle'],actor);
 const gone=()=>new Promise(ok=>{const wait=()=>{walker.at(now());if(!alive||walker.state==='gone'||walker.state==='hidden'){ok();return}requestAnimationFrame(wait)};wait()});
 const ctl={ready,
  // Start the arrival once the images are decoded, so the first visible frame is the clip's first frame.
  enter(){return ready.then(()=>{if(!alive||early)return;walker.start(now());draw()})},
  // Leaving: a sequence first needs its exit pages; if they cannot be had, the figure fades out where it stands.
  // Resolves once the figure is gone (or at once if it never came on stage).
  leave(){if(walker.state==='hidden'){early=true;return Promise.resolve()}
   if(actor?.kind==='seq'&&!reduced)return Promise.resolve(leavePages).then(()=>{if(alive)walker.leave(now())},e=>{console.error(`[stage] ${actor.id} exit pages unavailable, fading out in place: ${e?.message||e}`);host.dataset.fallback='vanish';walker.vanish(now())}).then(()=>{if(!raf)draw();return gone()});
   walker.leave(now());if(!raf)draw();return gone()},
  redraw(){if(!raf)draw()},
  get state(){return walker.state},
  get plays(){return actor?.kind==='seq'&&!reduced&&walker.state!=='hidden'},
  budget(){return walker.budget?.()??1},
  debug(){const r=host.getBoundingClientRect();return {background,camera,cam,actor:actor?`${actor.kind}:${actor.id}`:null,state:walker.state,frame:last?.frame??null,seg:last?.seg??null,trail:[...trail],pages:Object.keys(pages).length,placed,canvas:[canvas.width,canvas.height],css:[r.width,r.height]}},
  destroy(){alive=false;cancelAnimationFrame(raf);ro?.disconnect();releasePages();seq=null}};
 ready.then(()=>{if(alive&&!raf)draw()});
 return ctl}
