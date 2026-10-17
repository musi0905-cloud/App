// Who is drawn for a gate visitor (v0.19.0). One decision per case (visitor + scenario), used by the intercom stage
// and by the CCTV replay, so both screens always show the same person (same clothes, props, direction; A001/A075 kind
// of clues compare the two). data/visitor_figures.json lists the result for every reachable case and why.
//
// A visitor gets the role figure (NPC01-NPC10, character_assets.visitor_role_figures) only when every CCTV scene of the
// case can be drawn with art of that same person:
//  - wait/pan: the approved still role figure;
//  - cross: the role's side walk (assets/clips/side, v06 side PASS frames) in its own direction, screen-left, never
//    mirrored, and only where the scenario's clue does not depend on the walking direction (direction_bound);
//  - enter, repeat, descend (the opposite stairs camera shows it walking at the camera) and the gestures
//    (turn/look back, phone, wave, knock) need art no role has, so those cases keep the legacy look in both screens.
// NPC06 additionally plays the v10r5 enter -> settle -> idle -> turn -> start -> exit sequence at the intercom. Its
// visual verdict stays REVISE; it runs only under the user's exception for that exact version (USER_EXCEPTIONS) and
// only after every file's SHA-256 matched (loadSequence). Global REVISE blocking (stage.js clipUsable) is untouched.
export const USER_EXCEPTIONS=Object.freeze({NPC06:Object.freeze({revision:'v10r5',manifest_sha256:'958468e58433d2c2e524e9a1b46eef61587a1c3996ed0de99a2d506325518e21'})});
const STAND_ACTIONS=new Set(['wait','pan']);
// What the CCTV replay must draw for a case, and whether the role `npc` has all of it. figs: visitor_figures.json.
export function cctvPlan(pack,npc,figs){
 const needs=[],missing=[];
 for(const s of pack?.scenes||[]){let need;
  if(s.mode==='repeat')need='walk_front_rear';else if(STAND_ACTIONS.has(s.action))need='stand';else if(s.action==='cross')need='walk_side';else if(s.action==='enter'||s.action==='descend')need='walk_front_rear';else need='gesture_'+s.action;
  if(!needs.includes(need))needs.push(need);
  if(need==='stand')continue;
  if(need==='walk_side'&&figs?.side_clips?.includes(npc)&&!figs?.direction_bound?.[pack.id])continue;
  const why=need==='walk_side'?(figs?.direction_bound?.[pack.id]?'direction_bound':'no_side_clip'):need;if(!missing.includes(why))missing.push(why)}
 return {ok:!missing.length&&needs.length>0,needs,missing}}
// visitor (with baseRole), pack (filled scenario), chars: character_assets.json, figs: visitor_figures.json, look: legacy look 1-8.
export function figureFor(v,pack,chars,figs,look){
 const npc=chars?.visitor_roles?.[v.baseRole||v.role]||null,role=npc&&chars.visitor_role_figures?.[npc],plan=cctvPlan(pack,npc,figs);
 const legacy=chars?.legacy?.figures?.[`visitor-0${look}`];
 if(!role?.figure||!plan.ok||figs?.enabled!==true)return {kind:'legacy',id:`visitor-0${look}`,look,npc,figure:legacy,plan,reason:!role?.figure?'no_role_figure':figs?.enabled!==true?'role_figures_off':plan.missing.join(',')};
 const clip=figs.intercom_clips?.[npc]||null;
 return {kind:'role',id:npc,npc,look,figure:role.figure,head:figs.role_heads?.[npc]||null,side:figs.side_clips.includes(npc)?npc:null,intercom:clip&&clip.runtime_enabled===true?clip:null,plan,reason:'cctv_drawable'}}
// The exception record (visitor_figures.json intercom_clips.NPC06) and the fetched clip.json must both name the exact
// version the user approved; anything else (other revision, other manifest, a PASS label, runtime off) is refused.
export function exceptionAllows(record,clip){const x=USER_EXCEPTIONS[record?.npc];
 return !!x&&record.revision===x.revision&&record.visual_status==='REVISE'&&record.runtime_enabled===true&&Array.isArray(record.user_accepted_limitations)&&record.user_accepted_limitations.length===4&&typeof record.approval_basis==='string'
  &&(!clip||(clip.npc===record.npc&&clip.revision===x.revision&&clip.visual_status==='REVISE'&&clip.source?.manifest_sha256===x.manifest_sha256))}

// SHA-256 of an ArrayBuffer as hex. Web Crypto when the page is a secure context, otherwise a small JS version, so a
// damaged or different file is refused on every origin (no "trust on size" fallback).
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256js(buf){const b=new Uint8Array(buf),n=b.length,len=((n+9+63)>>6)<<6,m=new Uint8Array(len);m.set(b);m[n]=0x80;const dv=new DataView(m.buffer);dv.setUint32(len-4,n*8>>>0);dv.setUint32(len-8,Math.floor(n/0x20000000));
 const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),W=new Uint32Array(64),r=(x,k)=>(x>>>k)|(x<<(32-k));
 for(let o=0;o<len;o+=64){for(let i=0;i<16;i++)W[i]=dv.getUint32(o+i*4);for(let i=16;i<64;i++){const a=W[i-15],c=W[i-2];W[i]=(W[i-16]+(r(a,7)^r(a,18)^(a>>>3))+W[i-7]+(r(c,17)^r(c,19)^(c>>>10)))>>>0}
  let [a,bb,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const t1=(h+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+W[i])>>>0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&bb)^(a&c)^(bb&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=bb;bb=a;a=(t1+t2)>>>0}
  H[0]+=a;H[1]+=bb;H[2]+=c;H[3]+=d;H[4]+=e;H[5]+=f;H[6]+=g;H[7]+=h}
 return [...H].map(x=>x.toString(16).padStart(8,'0')).join('')}
export async function sha256(buf){try{if(globalThis.crypto?.subtle){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch{}return sha256js(buf)}
async function fetchChecked(url,{bytes,sha}){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);const buf=await r.arrayBuffer();
 if(bytes!=null&&buf.byteLength!==bytes)throw Error(`${url}: ${buf.byteLength} bytes, expected ${bytes}`);const h=await sha256(buf);if(h!==sha)throw Error(`${url}: SHA-256 ${h.slice(0,12)}… is not ${sha.slice(0,12)}…`);return buf}
async function decode(buf){const blob=new Blob([buf],{type:'image/webp'});if(typeof createImageBitmap==='function')return createImageBitmap(blob);
 const url=URL.createObjectURL(blob);try{return await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(Error('decode'));im.src=url})}finally{URL.revokeObjectURL(url)}}
const clips=new Map();
// The verified clip.json for an exception record (cached per page load). Throws on any mismatch.
export function loadClip(record,base=''){const url=base+record.clip;if(!clips.has(url))clips.set(url,(async()=>{
 if(!exceptionAllows(record))throw Error(record?.npc+' '+record?.revision+': no user exception for this version');
 const clip=JSON.parse(new TextDecoder().decode(await fetchChecked(url,{sha:record.clip_sha256})));
 if(!exceptionAllows(record,clip))throw Error(url+': not the approved version');return clip})().catch(e=>{clips.delete(url);throw e}));return clips.get(url)}
// Pages of one load group, each checked (bytes + SHA-256) before decoding. Returns {index: image}.
export async function loadPages(clip,record,group,base=''){const dir=(base+record.clip).replace(/[^/]*$/,''),out={};
 await Promise.all(clip.pages.map((p,i)=>[p,i]).filter(([p])=>p.group===group).map(async([p,i])=>{out[i]=await decode(await fetchChecked(dir+p.file,{bytes:p.bytes,sha:p.sha256}))}));return out}
// Warm the HTTP/offline cache for the next visitor's clip without decoding anything (once per clip and page load).
const warmed=new Set();
export function prefetchClip(record,base=''){const key=base+record.clip;if(warmed.has(key))return;warmed.add(key);loadClip(record,base).then(clip=>{const dir=(base+record.clip).replace(/[^/]*$/,'');for(const p of clip.pages)fetch(dir+p.file).then(r=>r.arrayBuffer()).catch(()=>{})}).catch(()=>{})}
