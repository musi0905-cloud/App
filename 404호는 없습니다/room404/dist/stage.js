// Layered scene stage (v0.16.0): background -> back objects -> contact shadow -> character -> foreground occlusion -> UI.
// Coordinates are the background's design space (1080x1920, data/scene_layout.json). A camera is a fixed crop of that
// space; the canvas keeps one transform for the whole scene, so clip frames (root motion baked in) are never re-centred.
// Characters: a still image standing at a stand point (scaled by the camera model, never moved), or a walk clip whose
// frames cover the whole background frame (walk_clips.json, design_scale 1.5). Timing comes from walk.js.
import {createWalker} from './walk.js';
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
// A walk clip may stand in a game scene only when its package QA status is PASS (README_CLAUDE_CODE_v02 3항); the QA viewer
// passes allowRevise. Returns the stage actor for an npc entry of walk_clips.json and its imported atlas.json, or null.
export function clipActor(id,entry,atlas,{allowRevise=false}={}){if(!entry||!atlas||!(entry.qa_status==='PASS'||allowRevise))return null;
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
//  areas: [{id, rect|'figure', label, onClick}] (shown as buttons), reduced: no timed motion, label: canvas description,
//  stand: stand point name (default 'idle'), base: prefix for file paths (the QA viewer lives outside dist/).
export function mountStage(host,opts){
 const {layout,background,camera='full',reduced=false}=opts,{bg,rect:cam}=cameraOf(layout,background,camera);let actor=opts.actor||null;
 host.classList.add('stage');host.dataset.background=background;host.dataset.camera=camera;host.dataset.actor=actor?`${actor.kind}:${actor.id}`:'';
 let canvas=host.querySelector('canvas.stage-canvas');if(!canvas){canvas=document.createElement('canvas');canvas.className='stage-canvas';host.prepend(canvas)}
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',opts.label||bg.name);
 let layer=host.querySelector('.stage-areas');if(!layer){layer=document.createElement('div');layer.className='stage-areas';canvas.after(layer)}
 const ctx=canvas.getContext('2d'),fig=document.createElement('canvas'),fx=fig.getContext('2d');let bgImage=null,actorImage=null,raf=0,alive=true,placed=null,last=null;
 const fps=actor?.binding?.fps||24,clipOf=k=>actor?.kind==='clip'&&actor.clips?.[k]?{frames:actor.clips[k].frames}:null;
 let walker=createWalker({clips:{enter:clipOf('enter'),exit:clipOf('exit'),idle:clipOf('idle')},fps,instant:reduced});
 const now=()=>performance.now()/1000;
 function size(){const r=host.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}return r}
 function figureBox(st){if(!actor||st.alpha<=0)return null;if(actor.kind==='still')return placed.box;
  const v=actor.binding.views[{enter:'front',exit:'rear',idle:'front'}[st.clip]],b=v?.bbox[st.frame];if(!b)return null;const k=actor.binding.design_scale||1.5;return b.map(n=>n*k)}
 function draw(){if(!alive)return;raf=0;const t=now(),st=walker.at(t),r=size();last=st;
  const sx=canvas.width/cam[2],sy=canvas.height/cam[3];ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b1112';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(sx,0,0,sy,-cam[0]*sx,-cam[1]*sy);
  const bgDraw=()=>{if(bgImage)ctx.drawImage(bgImage,0,0,bg.size[0],bg.size[1])};
  bgDraw(); // 1 background
  for(const o of bg.back_objects||[])if(o.image)ctx.drawImage(o.image,...o.rect); // 2 back objects (none authored yet)
  if(actor&&st.alpha>0&&actorImage){
   // The figure is painted on its own layer first so the scene's light wash (bg.figure_grade, the v05 renderer's
   // source-atop gradient) touches only the figure, then that layer goes onto the scene with the state's opacity.
   if(fig.width!==canvas.width||fig.height!==canvas.height){fig.width=canvas.width;fig.height=canvas.height}
   fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,fig.width,fig.height);fx.setTransform(sx,0,0,sy,-cam[0]*sx,-cam[1]*sy);ctx.globalAlpha=st.alpha;
   if(actor.kind==='still'){placed.shadows.forEach(s=>shadow(ctx,s));fx.drawImage(actorImage,placed.x,placed.y,placed.w,placed.h)} // 3 shadow, 4 character
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
  host.dataset.state=st.state;if(st.clip)host.dataset.frame=String(st.frame);else delete host.dataset.frame;
  if(st.state==='enter'||st.state==='exit')raf=requestAnimationFrame(draw)}
 function areas(r,st){const list=opts.areas||[],box=figureBox(st);
  for(const a of list){let b=layer.querySelector(`[data-area="${a.id}"]`);if(!b){b=document.createElement('button');b.type='button';b.className='stage-area';b.dataset.area=a.id;b.setAttribute('aria-label',a.label);b.onclick=()=>a.onClick?.(a.id);layer.append(b)}
   const rect=a.rect==='figure'?(box?[box[0],box[1],box[2]-box[0],box[3]-box[1]]:null):a.rect;b.hidden=!rect||st.state!=='idle'&&a.rect==='figure';
   if(rect){const s=areaStyle(rect,cam,r);Object.assign(b.style,{left:s.left+'px',top:s.top+'px',width:s.width+'px',height:s.height+'px'})}}}
 const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(!raf)draw()}):null;ro?.observe(host);
 const url=p=>(opts.base||'')+p;
 const ready=Promise.all([loadImage(url(bg.file)).then(im=>{bgImage=im}),actor?.src?loadImage(url(actor.src)).then(im=>{actorImage=im}).catch(()=>{actorImage=null}):actor?.atlas?loadImage(url(actor.atlas.src)).then(im=>{actorImage=im}):null]).catch(()=>{});
 if(actor?.kind==='still')placed=placeStill(bg,bg.stand_points[opts.stand||'idle'],actor);
 const ctl={ready,
  // Start the arrival once the images are decoded, so the first visible frame is the clip's first frame.
  enter(){return ready.then(()=>{if(!alive)return;walker.start(now());draw()})},
  leave(){walker.leave(now());if(!raf)draw();return new Promise(ok=>{const wait=()=>{if(!alive||walker.state==='gone'){ok();return}requestAnimationFrame(wait)};wait()})},
  redraw(){if(!raf)draw()},
  get state(){return walker.state},
  debug(){const r=host.getBoundingClientRect();return {background,camera,cam,actor:actor?`${actor.kind}:${actor.id}`:null,state:walker.state,frame:last?.frame??null,placed,canvas:[canvas.width,canvas.height],css:[r.width,r.height]}},
  destroy(){alive=false;cancelAnimationFrame(raf);ro?.disconnect()}};
 ready.then(()=>{if(alive&&!raf)draw()});
 return ctl}
