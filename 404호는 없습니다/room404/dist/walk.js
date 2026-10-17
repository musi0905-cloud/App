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
// A full visitor sequence on one fixed canvas (v0.19.0, NPC06 v10r5): enter -> settle -> idle (the only loop) ->
// turn -> start -> exit -> gone. Every segment plays forward once and hands over to the next; nothing wraps except idle.
// Leaving is a request: an arrival is never cut short, and the turn begins only right after an idle frame listed in
// turnEntries (the frames whose picture meets turn frame 0, measured by build-runtime-clips.py), so the hand-over is the
// authored one. onState(state, t) fires once per state change, in order (no duplicate end events).
// instant (reduced motion): the figure shows idle frame 0 without timed motion and leaves at once.
export const SEQ_STATES=['hidden','enter','settle','idle','turn','start','exit','gone'];
export function createSequence({segments,fps=24,fade=.25,instant=false,turnEntries=[0],onState=null}={}){
 for(const k of SEQ_STATES.slice(1,7))if(!(segments?.[k]?.frames>0))throw Error('sequence segment '+k);
 const L=segments.idle.frames,entries=turnEntries.filter(k=>Number.isInteger(k)&&k>=0&&k<L);if(!entries.length)throw Error('no turn entry');
 // EPS: one tolerance for frame indexes and hand-overs, so a frame number never runs ahead of its segment change.
 let state='hidden',t0=0,leaveAt=null,turnAt=null,vanish=null;const len=k=>segments[k].frames/fps,EPS=1e-6/fps,done=(t,d)=>t-t0>=d-EPS;
 const go=(s,t)=>{state=s;t0=t;onState?.(s,t)};
 // End time of the first idle frame at or after time t whose index is a turn entry.
 const nextEntry=t=>{const k0=Math.max(0,Math.floor((t-t0+EPS)*fps));for(let k=k0;k<=k0+L;k++)if(entries.includes(k%L))return t0+(k+1)/fps};
 function step(t){for(let guard=0;guard<12;guard++){
  if(vanish&&state!=='gone'&&t-vanish.t>=fade-EPS){go('gone',vanish.t+fade);continue}
  if(vanish)break;
  if(state==='enter'&&done(t,len('enter'))){go('settle',t0+len('enter'));continue}
  if(state==='settle'&&done(t,len('settle'))){go('idle',t0+len('settle'));continue}
  if(state==='idle'&&leaveAt!==null){if(instant){go('gone',t);leaveAt=null;continue}turnAt??=nextEntry(Math.max(leaveAt,t0));if(t>=turnAt-EPS){const at=turnAt;leaveAt=turnAt=null;go('turn',at);continue}}
  if(state==='turn'&&done(t,len('turn'))){go('start',t0+len('turn'));continue}
  if(state==='start'&&done(t,len('start'))){go('exit',t0+len('start'));continue}
  if(state==='exit'&&done(t,len('exit')+fade)){go('gone',t0+len('exit')+fade);continue}
  break}}
 const frameOf=(t)=>{const dt=Math.max(0,t-t0+EPS),n=segments[state].frames;if(state==='idle')return instant?0:Math.floor(dt*fps)%L;return Math.min(n-1,Math.floor(dt*fps))};
 return {
  start(t){if(state!=='hidden')return false;leaveAt=turnAt=vanish=null;if(instant){go('idle',t)}else go('enter',t);step(t);return true},
  leave(t){if(vanish||!['enter','settle','idle'].includes(state)||leaveAt!==null)return false;leaveAt=t;step(t);return true},
  // Stop in place: fade out the frame on screen (used when the rest of the clip cannot be shown, e.g. a page failed).
  vanish(t){if(state==='hidden'||state==='gone'||vanish)return false;step(t);vanish={t,seg:state,frame:frameOf(t)};step(t);return true},
  get state(){return state},
  get leaving(){return leaveAt!==null||['turn','start','exit'].includes(state)||!!vanish},
  // Seconds until gone if leaving were asked now (upper bound, for the caller's watchdog).
  budget(){return (instant?0:1+(L+1)/fps+len('turn')+len('start')+len('exit')+fade+(state==='enter'?len('enter')+len('settle'):state==='settle'?len('settle'):0))},
  at(t){step(t);if(state==='hidden'||state==='gone')return {state,seg:null,frame:null,alpha:0,moving:false};
   if(vanish)return {state,seg:vanish.seg,frame:vanish.frame,alpha:Math.max(0,1-(t-vanish.t)/fade),moving:false};
   const dt=Math.max(0,t-t0),frame=frameOf(t);
   if(state==='enter')return {state,seg:'enter',frame,alpha:instant?1:Math.min(1,dt/fade),moving:true};
   if(state==='exit'){const tail=dt-len('exit');return {state,seg:'exit',frame,alpha:tail>0?Math.max(0,1-tail/fade):1,moving:tail<=0}}
   return {state,seg:state,frame,alpha:1,moving:state==='turn'||state==='start'}},
 };
}
