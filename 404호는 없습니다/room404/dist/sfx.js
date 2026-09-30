// Small synthesized sounds (no audio files): intercom ring, door latch, door shut. Follows the same sound switch as the voice.
import {soundOn} from './voice.js';
let ctx=null;
function audio(){try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx}catch{return null}}
function tone(freq,start,dur,{type='sine',gain=.08,to=null}={}){
 const c=audio();if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+start;
 o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.05);
}
// One intercom ring (two short bursts); resolves when the other side would pick up.
export function ring(){if(!soundOn())return Promise.resolve();for(const t of [0,.5]){tone(440,t,.4,{gain:.045});tone(480,t,.4,{gain:.045})}return new Promise(r=>setTimeout(r,1100))}
export function doorOpen(){if(!soundOn())return;tone(1800,0,.05,{type:'square',gain:.025});tone(220,.08,.5,{gain:.06,to:120})}
export function doorShut(){if(!soundOn())return;tone(1200,0,.03,{type:'square',gain:.02});tone(90,.02,.35,{gain:.12,to:50})}
