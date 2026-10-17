// v0.19.0 in the real game page (mobile emulation, Chromium): NPC06 v10r5 plays its whole visit on the intercom
// (enter -> settle -> idle -> turn -> start -> exit), a decision is taken once, a visitor swap leaves nothing behind,
// intercom and CCTV draw the same person, reduced motion and a failed clip file still let the case go on.
// Writes test-artifacts/npc06_v10r5/: flow.json (sampled states and frames, checks), JPEG captures per segment,
// and npc06_flow.mp4 from the game canvas when FFMPEG points to an ffmpeg binary.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat,rm} from 'node:fs/promises';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';import {startServer} from './static-server.mjs';
import {newRun} from '../dist/engine.js';
const art=resolve('test-artifacts/npc06_v10r5');await rm(art,{recursive:true,force:true});await mkdir(art,{recursive:true});
const read=n=>JSON.parse(readFileSync(resolve('dist/data/'+n+'.json'),'utf8'));
const visitors=read('visitors'),anomalies=read('anomalies'),pairs=Object.fromEntries(read('story_visitors').map(v=>[v.id,v.anomaly_id])),figs=read('visitor_figures');
const clip=JSON.parse(readFileSync(resolve('dist/assets/clips/NPC06_v10r5/clip.json'),'utf8'));
const {server,origin}=await startServer(resolve('dist'));const results=[];let failed=false;const record={started:new Date().toISOString(),environment:'Chromium headless, mobile emulation 390x844 DPR 2 (실기기 아님)',checks:{}};
async function check(name,fn){const t0=Date.now();try{await fn();results.push({test:name,status:'PASS',ms:Date.now()-t0});console.log('PASS',name)}catch(e){failed=true;results.push({test:name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message)}}
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
// A daily run whose first cases are the given visitors with their own pinned anomalies (as the game deals them).
function daily(ids){const r=newRun('daily',visitors,anomalies,'2026-10-17',pairs);ids.forEach((id,i)=>{const j=r.cases.findIndex(c=>c.visitor===id);if(j>=0)r.cases[j]=r.cases[i];r.cases[i]={visitor:id,anomaly:pairs[id]}});return r}
// Records the intercom's state/segment/frame on every animation frame, plus canvas captures for the video.
const SAMPLER=()=>{window.__s=[];window.__shots={};window.__video=[];window.__rec=false;const want={enter:[0,24,47],settle:[8],idle:[12],turn:[10,20,30,39],start:[7],exit:[0,24,47]};
 const loop=t=>{const p=document.getElementById('portrait');if(p){const d=p.dataset,last=window.__s.at(-1),row={t:+(t/1000).toFixed(4),state:d.state||'',seg:d.seg||'',frame:d.frame===undefined?null:+d.frame,actor:d.actor||''};
  if(!last||last.state!==row.state||last.seg!==row.seg||last.frame!==row.frame||last.actor!==row.actor)window.__s.push(row);const c=p.querySelector('canvas');
  if(c&&row.seg&&want[row.seg]){for(const f of want[row.seg]){const k=row.seg+'_'+f;if(!window.__shots[k]&&row.frame>=f&&row.frame<=f+2&&row.state===row.seg)window.__shots[k]=c.toDataURL('image/jpeg',.9)}}
  if(window.__rec&&c)window.__video.push([t,c.toDataURL('image/jpeg',.9)])}requestAnimationFrame(loop)};requestAnimationFrame(loop)};
async function open(ctxOpts={},{route=null}={}){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block',...ctxOpts});
 if(route)await context.route(route.pattern,route.handler);const page=await context.newPage();const log={errors:[],console:[],bad:[]};
 page.on('pageerror',e=>log.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')log.console.push(m.text())});page.on('response',r=>{if(r.status()>=400)log.bad.push(r.status()+' '+r.url())});page.on('requestfailed',r=>log.bad.push('failed '+r.url()));
 await page.addInitScript(SAMPLER);return {context,page,log}}
async function resumeDaily(page,run){await page.goto(origin+'/manifest.webmanifest');await page.evaluate(r=>{localStorage.clear();localStorage.setItem('404_active_v2',JSON.stringify(r));localStorage.setItem('404_last_mode','"daily"')},run);
 await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await page.locator('#resume').click()}
const portrait=(page,k)=>page.locator('#portrait').getAttribute('data-'+k);
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('404_active_v2')));
// States after the visit began (the stage reads 'hidden' while its pages load, before the first frame).
const trailOf=s=>{const t=s.filter(r=>r.actor.startsWith('seq:')).map(r=>r.state).filter((x,i,a)=>x&&x!==a[i-1]);return t.slice(t.indexOf('enter'))};
async function saveImg(name,dataUrl){await writeFile(join(art,name),Buffer.from(dataUrl.split(',')[1],'base64'))}

const v051=daily(['V051','V001']);
await check('NPC06 v10r5 full visit on the intercom: enter -> settle -> idle (loops) -> decision -> turn -> start -> exit -> result',async()=>{
 const {context,page,log}=await open();await resumeDaily(page,v051);
 await page.evaluate(()=>{window.__rec=true});
 assert.equal(await portrait(page,'actor'),'seq:NPC06_v10r5');assert.equal(await portrait(page,'figure'),'NPC06');
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});
 await page.waitForTimeout(2600); // at least one full idle loop
 const area=page.locator('#portrait [data-area="visitor"]');assert.ok(await area.isVisible(),'visitor click area while waiting');
 // Two decisions in the same tick and a third later: only the first counts.
 await page.evaluate(()=>{document.getElementById('deny').click();document.getElementById('allow').click();document.getElementById('deny').click()});
 assert.equal((await saved(page)).history.length,1,'one decision');assert.equal((await saved(page)).history[0].allow,false);assert.equal((await saved(page)).screen,'feedback','saved at once');
 assert.ok(await page.locator('#allow').isDisabled()&&await page.locator('#deny').isDisabled()&&await page.locator('#report').isDisabled(),'inputs wait while the visitor leaves');
 assert.ok(await page.locator('#leaveNote').isVisible());assert.ok(!(await page.locator('#game').isHidden()),'still on the intercom');
 await page.locator('#allow').click({force:true}).catch(()=>{});assert.equal((await saved(page)).history.length,1);
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='turn');assert.ok(!(await area.isVisible()),'no click area while moving');
 // Decoded pages: the arrive group was closed once the visitor stood; the stay group closes when the walk-off starts.
 assert.equal(await portrait(page,'pages'),String(clip.pages.filter(p=>p.group!=='arrive').length),'arrive pages released after the arrival');
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='exit');assert.equal(await portrait(page,'pages'),String(clip.pages.filter(p=>p.group==='leave').length),'stay pages released once leaving');
 await page.locator('#feedback').waitFor({timeout:15000});await page.evaluate(()=>{window.__rec=false});
 const s=await page.evaluate(()=>window.__s),shots=await page.evaluate(()=>window.__shots),video=await page.evaluate(()=>window.__video);
 const trail=trailOf(s);assert.deepEqual(trail,['enter','settle','idle','turn','start','exit','gone'],trail.join('>'));assert.equal(await portrait(page,'trail'),'enter>settle>idle>turn>start>exit>gone');
 const segs={};for(const r of s)if(r.seg&&r.state===r.seg)(segs[r.seg]??=[]).push(r.frame);
 for(const [k,n] of Object.entries({enter:48,settle:16,turn:40,start:15,exit:48})){const f=segs[k];assert.ok(f?.length,k);for(let i=1;i<f.length;i++)assert.ok(f[i]>=f[i-1],k+' never goes backwards / never wraps');assert.ok(Math.max(...f)>=n-2,k+' reaches its end ('+Math.max(...f)+')');assert.ok(f[0]<=2,k+' starts at its start')}
 const idle=segs.idle;assert.ok(idle.some((x,i)=>i&&x<idle[i-1]),'idle loops');
 const before=s.findIndex(r=>r.state==='turn');const lastIdle=s.slice(0,before).filter(r=>r.state==='idle').at(-1).frame;assert.ok([22,23,46,47].includes(lastIdle),'turn starts after a turn-entry idle frame ('+lastIdle+')');
 assert.equal(s.filter(r=>r.state==='turn'&&r.frame===0).length<=1,true);
 for(const [k,u] of Object.entries(shots))await saveImg(`intercom_${k}.jpg`,u);
 await page.locator('#feedback').screenshot({path:join(art,'feedback_after_exit.jpg'),type:'jpeg',quality:85});
 record.checks.full_flow={trail,frames_seen:Object.fromEntries(Object.entries(segs).map(([k,f])=>[k,{count:f.length,min:Math.min(...f),max:Math.max(...f)}])),idle_before_turn:lastIdle,samples:s.length,captures:Object.keys(shots).sort()};
 // Video of the canvas as it played: one picture per 1/24 s from the samples (nearest earlier capture).
 if(process.env.FFMPEG&&video.length){const dir=join(tmpdir(),'npc06-video');await rm(dir,{recursive:true,force:true});await mkdir(dir);const t0=video[0][0],t1=video.at(-1)[0];let j=0,n=0;
  for(let t=t0;t<=t1;t+=1000/24){while(j+1<video.length&&video[j+1][0]<=t)j++;await writeFile(join(dir,String(n++).padStart(5,'0')+'.jpg'),Buffer.from(video[j][1].split(',')[1],'base64'))}
  execFileSync(process.env.FFMPEG,['-y','-loglevel','error','-framerate','24','-i',join(dir,'%05d.jpg'),'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','20',join(art,'npc06_flow.mp4')]);record.checks.video={file:'npc06_flow.mp4',frames:n,fps:24,seconds:+((t1-t0)/1000).toFixed(2)};await rm(dir,{recursive:true,force:true})}
 assert.deepEqual(log.errors,[]);assert.deepEqual(log.console,[]);assert.deepEqual(log.bad,[]);
 // Visitor swap: the next case (legacy look) is drawn exactly as on a fresh load: no frame, prop or shadow left over.
 await page.waitForTimeout(1500);await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle');
 assert.match(await portrait(page,'actor'),/^still:visitor-0\d$/);assert.equal(await portrait(page,'trail'),null);assert.equal(await portrait(page,'seg'),null);
 const pix=()=>page.evaluate(()=>document.querySelector('#portrait canvas').toDataURL('image/png'));const jpg=()=>page.evaluate(()=>document.querySelector('#portrait canvas').toDataURL('image/jpeg',.9));const swapped=await pix();
 await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await page.locator('#resume').click();await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle');
 const fresh=await pix();assert.equal(swapped,fresh,'swapped-in visitor identical to a fresh load');await saveImg('swap_next_visitor.jpg',await jpg());
 record.checks.swap={next_actor:await portrait(page,'actor'),identical_to_fresh_load:true};
 await context.close()});

await check('a decision during the arrival waits for it; a screen change mid-arrival does not restart it',async()=>{
 const {context,page,log}=await open();await resumeDaily(page,daily(['V052']));
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.seg==='enter');
 await page.locator('[data-tool="CCTV"]').click();await page.waitForTimeout(1200);await page.locator('#backDesk').click();
 await page.waitForFunction(()=>['settle','idle'].includes(document.getElementById('portrait').dataset.state));
 await page.locator('#allow').click();assert.equal((await saved(page)).history.length,1);
 await page.locator('#feedback').waitFor({timeout:15000});const trail=trailOf(await page.evaluate(()=>window.__s));
 assert.deepEqual(trail,['enter','settle','idle','turn','start','exit','gone'],trail.join('>'));
 assert.deepEqual(log.errors,[]);assert.deepEqual(log.bad,[]);record.checks.decide_during_arrival={trail};await context.close()});

await check('intercom and CCTV show the same person: NPC06 still + its side walk; a legacy case keeps one look in both',async()=>{
 const {context,page,log}=await open();await resumeDaily(page,daily(['V051','V001']));await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});
 await page.locator('[data-tool="CCTV"]').click();await page.locator('#toolAction').click();const c=page.locator('#caseReplay canvas');await c.waitFor();
 await page.waitForFunction(()=>document.querySelector('#caseReplay canvas')?.dataset.figure);
 const seen={};for(const [i,b] of (await page.locator('#caseReplay [data-chapter]').all()).entries()){await b.click();await page.waitForTimeout(100);
  // Scene 2 is the cross: move into the walk with the seek bar so a side frame is on screen.
  if(i===1)await page.evaluate(()=>{const s=document.querySelector('#caseReplay input[type=range]');s.value=String(6+2.5);s.dispatchEvent(new Event('input'))});
  seen[i]=await c.getAttribute('data-figure');await c.screenshot({path:join(art,`cctv_V051_scene${i+1}.jpg`),type:'jpeg',quality:85})}
 assert.equal(seen[0],'NPC06:still');assert.equal(seen[1],'NPC06:side');assert.equal(seen[2],'NPC06:still');
 const row=figs.cases.find(r=>r.visitor==='V051');assert.equal(row.intercom,'seq:NPC06_v10r5');
 await page.locator('#backDesk').click();await page.locator('#deny').click();await page.locator('#feedback').waitFor({timeout:15000});await page.waitForTimeout(1500);await page.locator('#next').click();
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle');const look=await portrait(page,'figure');assert.match(look,/^visitor-0\d$/);
 await page.locator('[data-tool="CCTV"]').click();await page.locator('#toolAction').click();await page.waitForFunction(()=>document.querySelector('#caseReplay canvas')?.dataset.figure);
 assert.equal(await page.locator('#caseReplay canvas').getAttribute('data-figure'),look,'legacy case: the same look in both screens');
 assert.deepEqual(log.errors,[]);assert.deepEqual(log.bad,[]);record.checks.cctv_identity={V051:seen,V001:look};await context.close()});

await check('reduced motion: idle frame 0 shown still, the decision goes straight to the result, same saved progress',async()=>{
 const {context,page,log}=await open({reducedMotion:'reduce'});await resumeDaily(page,daily(['V060']));
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle');assert.equal(await portrait(page,'actor'),'seq:NPC06_v10r5');
 await page.waitForTimeout(800);assert.equal(await portrait(page,'frame'),'0');assert.equal(await portrait(page,'trail'),'idle');
 await page.locator('#portrait').screenshot({path:join(art,'reduced_motion_idle.jpg'),type:'jpeg',quality:85});
 await page.locator('#allow').click();assert.ok(await page.locator('#feedback').isVisible(),'result at once');const h=(await saved(page)).history;assert.equal(h.length,1);assert.equal(h[0].allow,true);
 assert.deepEqual(log.errors,[]);record.checks.reduced_motion={frame:0,result_immediate:true};await context.close()});

await check('a clip page that fails or does not match its SHA-256: the NPC06 still figure waits instead, the error is logged, the case goes on',async()=>{
 for(const [label,handler] of [['missing',r=>r.fulfill({status:404,body:'gone'})],['corrupt',async r=>{const res=await r.fetch();const b=Buffer.from(await res.body());b[b.length>>1]^=0xff;r.fulfill({response:res,body:b})}]]){
  const {context,page,log}=await open({},{route:{pattern:'**/assets/clips/NPC06_v10r5/stay-1.webp',handler}});await resumeDaily(page,daily(['V057']));
  await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});
  assert.equal(await portrait(page,'actor'),'still:NPC06',label);assert.equal(await portrait(page,'fallback'),'still');assert.ok(log.console.some(m=>/sequence unavailable/.test(m)),label+' logged');
  await page.locator('#portrait').screenshot({path:join(art,`fallback_${label}.jpg`),type:'jpeg',quality:85});await page.locator('#deny').click();await page.locator('#feedback').waitFor({timeout:5000});assert.equal((await saved(page)).history.length,1);
  record.checks['fallback_'+label]={actor:'still:NPC06',logged:log.console.find(m=>/sequence unavailable/.test(m))};await context.close()}
 // Exit pages broken: the visitor fades out where it stands and the result still comes.
 const {context,page,log}=await open({},{route:{pattern:'**/assets/clips/NPC06_v10r5/leave-0.webp',handler:r=>r.fulfill({status:404,body:''})}});await resumeDaily(page,daily(['V057']));
 await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});await page.locator('#allow').click();await page.locator('#feedback').waitFor({timeout:8000});
 assert.ok(log.console.some(m=>/exit pages unavailable/.test(m)));assert.equal((await saved(page)).history.length,1);record.checks.fallback_exit_pages={result:'faded out in place, result shown'};await context.close()});

await check('a different version is refused: clip.json with another revision or a PASS label never plays',async()=>{
 for(const edit of [c=>({...c,revision:'v09r'}),c=>({...c,visual_status:'PASS'})]){
  const {context,page,log}=await open({},{route:{pattern:'**/assets/clips/NPC06_v10r5/clip.json',handler:r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(edit(clip))})}});await resumeDaily(page,daily(['V051']));
  await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});assert.equal(await portrait(page,'actor'),'still:NPC06');assert.ok(log.console.some(m=>/SHA-256|approved version/.test(m)));await context.close()}
 record.checks.version_gate='altered clip.json refused (hash and version checks)'});

await check('screen sizes: desktop 1280x800 and a 320 px phone show the whole figure in every frame (no face or foot cropping), no sideways scroll',async()=>{
 // Data side: every frame rect (x1.5, design space) lies inside the intercom camera crop, so no aspect can cut it.
 const cam=JSON.parse(readFileSync(resolve('dist/data/scene_layout.json'),'utf8')).backgrounds.BG02.cameras.intercom;
 for(const [i,r] of clip.frames.entries()){const k=clip.design_scale,x0=r[5]*k,y0=r[6]*k,x1=(r[5]+r[3])*k,y1=(r[6]+r[4])*k;assert.ok(x0>=cam[0]&&y0>=cam[1]&&x1<=cam[0]+cam[2]&&y1<=cam[1]+cam[3],'frame '+i+' inside the intercom camera')}
 const sizes=[];for(const [label,vp,mobile] of [['desktop',{width:1280,height:800},false],['phone320',{width:320,height:640},true]]){
  const {context,page,log}=await open({viewport:vp,isMobile:mobile,hasTouch:mobile});await resumeDaily(page,daily(['V052']));await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});
  const b=await page.locator('#portrait').boundingBox();assert.ok(Math.abs(b.width/b.height-.75)<.02,label+' 3:4 camera');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' no sideways scroll');
  await page.locator('#portrait').scrollIntoViewIfNeeded();await page.screenshot({path:join(art,`size_${label}.jpg`),type:'jpeg',quality:85});assert.deepEqual(log.errors,[]);sizes.push({label,viewport:vp,camera_css:[Math.round(b.width),Math.round(b.height)]});await context.close()}
 record.checks.sizes=sizes});

await check('offline: after the first visit the NPC06 clip plays from the offline cache; an existing save resumes where it was',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(SAMPLER);
 // An existing save from before this build: a daily run already one case in, the NPC06 visitor next.
 const run=daily(['V001','V060']);run.history=[{...run.cases[0],allow:true,correct:anomalies.find(a=>a.id===run.cases[0].anomaly).safe===true,seen:[],verified:false}];run.index=1;run.screen='game';
 await page.goto(origin+'/manifest.webmanifest');await page.evaluate(r=>{localStorage.clear();localStorage.setItem('404_active_v2',JSON.stringify(r));localStorage.setItem('404_last_mode','"daily"')},run);
 await page.goto(origin);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const cached=await page.evaluate(async()=>{const keys=await caches.keys(),c=await caches.open(keys.find(k=>k.startsWith('room404-')));return {name:keys.find(k=>k.startsWith('room404-')),clip:!!(await c.match('./assets/clips/NPC06_v10r5/clip.json')),pages:(await c.keys()).filter(r=>/clips\/NPC06_v10r5\/.*\.webp$/.test(r.url)).length,side:(await c.keys()).filter(r=>/clips\/side\//.test(r.url)).length}});
 assert.equal(cached.name,'room404-v0.19.0');assert.ok(cached.clip);assert.equal(cached.pages,clip.pages.length);assert.equal(cached.side,4);
 try{await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await page.locator('#resume').click();
  assert.equal(await portrait(page,'actor'),'seq:NPC06_v10r5');await page.waitForFunction(()=>document.getElementById('portrait').dataset.state==='idle',null,{timeout:20000});
  assert.equal(await page.locator('#progress').innerText(),'02 / 08','resumed at the saved case');assert.equal((await saved(page)).history.length,1,'earlier decision kept');
  await page.locator('#allow').click();await page.locator('#feedback').waitFor({timeout:15000});assert.equal((await saved(page)).history.length,2);
  const trail=await portrait(page,'trail');assert.equal(trail,'enter>settle>idle>turn>start>exit>gone','played offline');record.checks.offline={cache:cached,trail,resumed_case:2}}
 finally{await context.setOffline(false)}
 assert.deepEqual(errors,[]);await context.close()});

await browser.close();server.close();
record.results=results;await writeFile(join(art,'flow.json'),JSON.stringify(record,null,1));await writeFile(resolve('test-artifacts/npc06-flow-results.json'),JSON.stringify(results,null,1));
if(failed)process.exit(1);
