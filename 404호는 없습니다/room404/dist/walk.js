// Enter -> idle -> exit for one figure on a fixed stage canvas (v0.16.0). Pure timing, no drawing and no positions:
// where the figure is comes only from its clip frames (root motion baked into a fixed canvas) or from the scene's stand
// point for a still image. Rules (scene_layout.json): a moving clip plays once and never wraps from its last frame back to
// the first, nothing plays backwards, and a still image is never slid or scaled to fake walking. Without a usable clip
// the figure appears and leaves in place by opacity only.
export const STATES=['hidden','enter','idle','exit','gone'];
// clips: {enter:{frames}, exit:{frames}, idle:{frames}} — any may be missing. fps: clip rate. fade: seconds of an
// in-place fade (still figures, and the first/last moment of a clip). instant: reduced motion, no timed transitions.
export function createWalker({clips={},fps=24,fade=.25,instant=false}={}){
 const enter=clips.enter?.frames>0?clips.enter:null,exit=clips.exit?.frames>0?clips.exit:null,idle=clips.idle?.frames>0?clips.idle:null;
 let state='hidden',t0=0,exitAsked=null;
 const len=c=>c?c.frames/fps:fade;
 function step(t){
  if(state==='enter'&&(instant||t-t0>=len(enter))){state='idle';t0=instant?t:t0+len(enter)}
  if(state==='idle'&&exitAsked!==null){state='exit';t0=Math.max(t0,exitAsked);exitAsked=null}
  if(state==='exit'&&(instant||t-t0>=len(exit)+(exit?fade:0))){state='gone';t0=instant?t:t0+len(exit)+(exit?fade:0)}
 }
 return {
  start(t){if(state!=='hidden'&&state!=='gone')return false;state='enter';t0=t;exitAsked=null;step(t);return true},
  // Leaving is only requested; it begins when the figure has finished arriving (an arrival is never cut short).
  leave(t){if(state==='enter'||state==='idle'){exitAsked=t;step(t);return true}return false},
  get state(){return state},
  at(t){step(t);const dt=Math.max(0,t-t0);
   if(state==='hidden'||state==='gone')return {state,clip:null,frame:null,alpha:0,moving:false};
   if(state==='enter'){if(!enter)return {state,clip:null,frame:null,alpha:Math.min(1,dt/fade),moving:false};
    const frame=Math.min(enter.frames-1,Math.floor(dt*fps));return {state,clip:'enter',frame,alpha:Math.min(1,dt/fade),moving:true}}
   if(state==='idle'){if(idle)return {state,clip:'idle',frame:Math.floor(dt*fps)%idle.frames,alpha:1,moving:false};
    if(enter)return {state,clip:'enter',frame:enter.frames-1,alpha:1,moving:false};return {state,clip:null,frame:null,alpha:1,moving:false}}
   // exit
   if(!exit){const from=enter&&!idle?{clip:'enter',frame:enter.frames-1}:idle?{clip:'idle',frame:0}:{clip:null,frame:null};return {state,...from,alpha:Math.max(0,1-dt/fade),moving:false}}
   const raw=Math.floor(dt*fps),frame=Math.min(exit.frames-1,raw),tail=dt-len(exit);
   return {state,clip:'exit',frame,alpha:tail>0?Math.max(0,1-tail/fade):1,moving:raw<exit.frames}},
 };
}
