// Internal QA viewer and the layered stage in a real browser (v0.17.0): imported sprite frames on the fixed canvas, three
// views and the enter -> idle -> exit sequence (NPC06 seam), frame step, one-pass playback that never wraps, MP4 review
// frames with the binding data on top, background swap, and the stage layers checked by pixels:
// the foreground occluder hides the figure, the contact shadow darkens the floor, the figure is drawn over its shadow.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';import {startServer} from './static-server.mjs';
const art=resolve('test-artifacts');await mkdir(art,{recursive:true});
const {server,origin}=await startServer(resolve('..'));const url=origin+'/room404/qa/';const results=[];let failed=false;
async function check(name,fn){const t0=Date.now();try{await fn();results.push({test:name,status:'PASS',ms:Date.now()-t0});console.log('PASS',name)}catch(e){failed=true;results.push({test:name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message)}}
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const frame=()=>page.locator('#clipCanvas').getAttribute('data-frame').then(Number);
// Average RGB of a canvas rectangle given in CSS pixels of the element.
const sample=(sel,[x,y,w,h])=>page.evaluate(({sel,x,y,w,h})=>{const c=document.querySelector(sel),k=c.width/c.getBoundingClientRect().width,d=c.getContext('2d').getImageData(Math.round(x*k),Math.round(y*k),Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k))).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}const n=d.length/4;return [r/n,g/n,b/n]},{sel,x,y,w,h});
const diff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
await check('viewer loads the nine v05 NPCs with their 144 imported frames; every view REVISE in the frame review',async()=>{await page.goto(url);await page.waitForFunction(()=>document.querySelector('#clipCanvas').dataset.frame==='0');
 const t=await page.locator('#clipStatus').innerText();assert.equal(await page.locator('#npc option').count(),9);assert.match(t,/REVISE/);assert.match(t,/144 \/ 144/);assert.match(t,/프레임 검수/);assert.doesNotMatch(t,/정면 PASS|후면 PASS/);
 assert.equal(await page.locator('#source').inputValue(),'frames');assert.equal(await page.locator('#source option[value=frames]').evaluate(o=>o.disabled),false);
 const box=await page.evaluate(()=>{const n=qa.walk.npcs.NPC03,b=n.views.front.bbox[0],c=document.querySelector('#clipCanvas'),s=c.getBoundingClientRect().width/1080;return [(b[0]+b[2])/2*1.5*s,(b[1]*.6+b[3]*.4)*1.5*s]});
 const sprite=await sample('#clipCanvas',[box[0]-4,box[1]-4,8,8]);await page.screenshot({path:art+'/qa-viewer-frames.png'});
 await page.selectOption('#source','rig');const rig=await sample('#clipCanvas',[box[0]-4,box[1]-4,8,8]);await page.screenshot({path:art+'/qa-viewer-rig.png'});
 assert.ok(diff(sprite,rig)>10,'the sprite layer draws the figure: '+sprite+' vs '+rig);await page.selectOption('#source','frames')});
await check('three views and frame step; playback runs once and stops on frame 47 (no wrap)',async()=>{
 for(const v of ['side','rear','front']){await page.locator(`button[data-view="${v}"]`).click();assert.equal(await page.locator('#clipCanvas').getAttribute('data-clip-view'),v)}
 await page.locator('#next').click();await page.locator('#next').click();assert.equal(await frame(),2);await page.locator('#prev').click();assert.equal(await frame(),1);
 await page.keyboard.press('ArrowRight');assert.equal(await frame(),2);
 const seen=[];await page.locator('#play').click();const t0=Date.now();while(Date.now()-t0<6000){seen.push(await frame());if(seen.at(-1)===47&&(await page.locator('#play').innerText()).includes('재생'))break;await page.waitForTimeout(40)}
 assert.equal(seen.at(-1),47,'reached the last frame');for(let i=1;i<seen.length;i++)assert.ok(seen[i]>=seen[i-1],'frames only move forward: '+seen.join(','));
 await page.waitForTimeout(300);assert.equal(await frame(),47,'stays on the last frame, does not wrap to 0')});
await check('NPC06 elder rig and the enter/exit gap warning; NPC03 carrying arm listed',async()=>{
 await page.selectOption('#npc','NPC06');const t=await page.locator('#clipStatus').innerText();assert.match(t,/walk_rig_elder_v04\.json/);assert.match(t,/이음 끊김/);
 await page.selectOption('#npc','NPC03');const t3=await page.locator('#clipStatus').innerText();assert.match(t3,/Lshoulder/);assert.doesNotMatch(t3,/이음 끊김/)});
await check('MP4 review frames (opaque composite) with the computed feet and shadows on top',async()=>{
 await page.selectOption('#source','mp4');await page.locator('button[data-view="front"]').click();await page.locator('#frame').fill('24');await page.waitForTimeout(800);
 const fill=await sample('#clipCanvas',[200,200,40,40]);assert.ok(Math.max(...fill)>20,'video frame drawn');await page.screenshot({path:art+'/qa-viewer-mp4-front24.png'});
 await page.locator('button[data-view="rear"]').click();await page.locator('#frame').fill('0');await page.waitForTimeout(800);await page.screenshot({path:art+'/qa-viewer-mp4-rear0.png'});
 await page.selectOption('#npc','NPC04');assert.equal(await page.locator('#source').inputValue(),'frames','no MP4 for NPC04: back to the sprite frames')});
await check('enter -> idle -> exit sequence: NPC06 seam shown on the real frames (front 47 held, then rear 0)',async()=>{
 await page.selectOption('#npc','NPC06');await page.selectOption('#source','frames');await page.locator('button[data-view="seq"]').click();
 const t=await page.locator('#clipStatus').innerText();assert.match(t,/BLOCKED/);assert.match(t,/PATH_GAP/);assert.match(t,/이음 끊김/);assert.match(t,/\+150px/);
 await page.locator('#frame').fill('47');await page.waitForTimeout(300);assert.equal(await page.locator('#clipCanvas').getAttribute('data-drawn-view'),'front');await page.screenshot({path:art+'/qa-viewer-seq-NPC06-enter47.png'});
 await page.locator('#frame').fill('60');await page.waitForTimeout(300);assert.match(await page.locator('#frameLabel').innerText(),/대기/);assert.equal(await page.locator('#clipCanvas').getAttribute('data-drawn-frame'),'47');
 await page.locator('#frame').fill('72');await page.waitForTimeout(300);assert.equal(await page.locator('#clipCanvas').getAttribute('data-drawn-view'),'rear');assert.equal(await page.locator('#clipCanvas').getAttribute('data-drawn-frame'),'0');await page.screenshot({path:art+'/qa-viewer-seq-NPC06-exit0.png'});
 await page.locator('#frame').fill('119');await page.locator('#next').click();assert.equal(await frame(),119,'the sequence ends on exit 47, no wrap');
 await page.locator('button[data-view="front"]').click();assert.equal(await frame(),47,'back to a single clip: frame clamped to 47')});
await check('background swap: other backgrounds are marked as not calibrated for the clip',async()=>{
 await page.selectOption('#bg','BG12');assert.match(await page.locator('#clipStatus').innerText(),/BG02 카메라 기준/);await page.locator('[data-ov="cam"]').check();await page.screenshot({path:art+'/qa-viewer-bg12.png'});await page.selectOption('#bg','BG02')});
await check('v06 (render_v06.js): NPC06 enter -> settle -> idle -> turn -> start -> exit on the real frames, frame step, slow playback runs once',async()=>{
 await page.selectOption('#npc','NPC06');await page.selectOption('#rev','v06');await page.locator('button[data-view="seq"]').click();await page.waitForTimeout(300);
 const t=await page.locator('#clipStatus').innerText();assert.match(t,/v06/);assert.match(t,/입장→대기→회전→퇴장 PASS/);assert.match(t,/정면 REVISE/);assert.match(t,/측면 PASS/);
 const at=async n=>{await page.locator('#frame').fill(String(n));await page.waitForTimeout(120);return [await page.locator('#clipCanvas').getAttribute('data-segment'),await page.locator('#clipCanvas').getAttribute('data-drawn-view')]};
 const segs=[];for(const n of [0,47,48,63,64,111,112,151,152,166,167,214])segs.push((await at(n))[0]);
 assert.deepEqual(segs,['enter','enter','settle','settle','idle','idle','turn','turn','start','start','exit','exit']);
 assert.deepEqual(await at(113),['turn','front']);assert.deepEqual(await at(132),['turn','side']);await page.screenshot({path:art+'/qa-viewer-v06-NPC06-turn-side.png'});assert.deepEqual(await at(150),['turn','rear']);
 await at(80);await page.screenshot({path:art+'/qa-viewer-v06-NPC06-idle.png'});await at(167);await page.screenshot({path:art+'/qa-viewer-v06-NPC06-exit0.png'});
 await at(214);await page.locator('#next').click();assert.equal(await frame(),214,'the sequence ends on exit 47, no wrap');
 await page.selectOption('#speed','8');await at(205);await page.locator('#play').click();const t0=Date.now();while(Date.now()-t0<4000&&(await page.locator('#play').innerText()).includes('멈춤'))await page.waitForTimeout(100);
 assert.equal(await frame(),214,'8 fps playback reached the end and stopped');assert.ok(Date.now()-t0>900,'slow: 9 frames at 8 fps take about a second');
 await page.selectOption('#speed','24');await page.selectOption('#rev','v05');await page.selectOption('#npc','NPC03')});
await check('still stage: enter -> idle -> leave -> gone; occluder hides the figure, shadow darkens the floor',async()=>{
 await page.locator('[data-mode="still"]').click();await page.selectOption('#figure','CH09');await page.selectOption('#scene','BG12:full:clerk');await page.locator('#sOverlay').uncheck();
 await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='idle');
 const box=await page.evaluate(()=>{const d=qa.still().debug(),r=document.querySelector('#stillStage').getBoundingClientRect(),s=r.width/d.cam[2];return {s,box:d.placed.box}});
 const s=box.s,[x0,y0,x1]=box.box,cx=(x0+x1)/2;
 const counter=[cx*s-6,(900)*s,12,12],torso=[cx*s-6,(y0+60)*s,12,12];
 const withFig={counter:await sample('#stillStage canvas',counter),torso:await sample('#stillStage canvas',torso)};
 await page.locator('#sLeave').click();await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='gone');
 const bgOnly={counter:await sample('#stillStage canvas',counter),torso:await sample('#stillStage canvas',torso)};
 assert.ok(diff(withFig.counter,bgOnly.counter)<2,'inside the counter occluder the figure is hidden: '+withFig.counter+' vs '+bgOnly.counter);
 assert.ok(diff(withFig.torso,bgOnly.torso)>10,'above the counter the figure is visible');
 await page.selectOption('#scene','BG02:full:idle');await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='idle');
 const d=await page.evaluate(()=>{const d=qa.still().debug(),r=document.querySelector('#stillStage').getBoundingClientRect();return {s:r.width/d.cam[2],sh:d.placed.shadows}});
 const [sx,sy,rx]=d.sh[0],gap=[(sx-rx*.98)*d.s,(sy-2)*d.s,3,3];const lit=await sample('#stillStage canvas',gap);
 await page.locator('#sLeave').click();await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='gone');const plain=await sample('#stillStage canvas',gap);
 assert.ok(lit.reduce((a,b)=>a+b)<plain.reduce((a,b)=>a+b),'the contact shadow darkens the floor at the shadow edge: '+lit+' vs '+plain);
 await page.locator('#sReset').click();await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='idle');await page.locator('#sOverlay').check();await page.screenshot({path:art+'/qa-viewer-still-bg02.png'})});
await check('still mode chosen while the frame atlases are still loading opens without an error (race found 2026-10-14)',async()=>{
 const p2=await browser.newPage();const e2=[];p2.on('pageerror',e=>e2.push(e.message));await p2.route(/frames\/NPC\d\d\/atlas\.json$/,async r=>{await new Promise(f=>setTimeout(f,1500));await r.continue()});
 await p2.goto(url,{waitUntil:'domcontentloaded'});await p2.waitForSelector('[data-mode="still"]');await p2.waitForTimeout(300);await p2.locator('[data-mode="still"]').click();
 await p2.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='idle');assert.deepEqual(e2,[]);await p2.close()});
await check('zero uncaught JavaScript errors in the QA viewer',async()=>{assert.deepEqual(errors,[])});
await browser.close();server.close();
await writeFile(art+'/qa-ui-results.json',JSON.stringify(results,null,1));
if(failed)process.exit(1);
