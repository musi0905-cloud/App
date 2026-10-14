// v0.16.0 features in the real game page: the layered intercom stage, desk and visitor click areas, the emergency report
// kept apart from the door decision, night + cumulative totals, the evidence text viewer (buttons, keys, pinch, focus),
// and the approved backgrounds on the night intro and the ending cutscene.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';import {startServer} from './static-server.mjs';
import * as S from '../dist/story.js';import {data,playTo,archiveWork} from './story-helpers.mjs';
const art=resolve('test-artifacts');await mkdir(art,{recursive:true});
const {server,origin}=await startServer(resolve('dist'));const results=[];let failed=false;
async function check(name,fn){const t0=Date.now();try{await fn();results.push({test:name,status:'PASS',ms:Date.now()-t0});console.log('PASS',name)}catch(e){failed=true;results.push({test:name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message)}}
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('404_story_v3')));
async function inject(st){await page.goto(origin+'/manifest.webmanifest');await page.evaluate(st=>{localStorage.clear();localStorage.setItem('404_story_v3',JSON.stringify(st));localStorage.setItem('404_last_mode','"story"')},st);await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled)}
const idle=sel=>page.waitForFunction(s=>document.querySelector(s)?.dataset.state==='idle',sel);
const box=sel=>page.locator(sel).boundingBox();

await check('intercom stage: BG02, intercom camera, the visitor waits in place; returning from a tool does not replay the arrival',async()=>{
 await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await page.locator('#startStory').click();await idle('#portrait');
 const p=page.locator('#portrait');assert.equal(await p.getAttribute('data-background'),'BG02');assert.equal(await p.getAttribute('data-camera'),'intercom');assert.match(await p.getAttribute('data-actor'),/^still:visitor-0\d$/);
 assert.equal(await p.getAttribute('data-frame'),null,'a still figure has no walk frames');const b=await box('#portrait');assert.ok(Math.abs(b.width/b.height-.75)<.02,'3:4 camera');
 const lum=await page.evaluate(()=>{const c=document.querySelector('#portrait canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4000)s+=d[i]+d[i+1]+d[i+2];return s});assert.ok(lum>0,'canvas painted');
 await page.locator('[data-tool="CCTV"]').click();await page.locator('#backDesk').click();assert.equal(await p.getAttribute('data-state'),'idle','no second arrival')});
await check('click areas: visitor -> CCTV, desk monitor / ledger / phone -> their tools; every target at least 44 px',async()=>{
 const v=page.locator('#portrait [data-area="visitor"]');const vb=await v.boundingBox();assert.ok(vb.width>=44&&vb.height>=44);await v.click();assert.match(await page.locator('#toolTitle').innerText(),/CCTV/);await page.locator('#backDesk').click();
 for(const [area,title] of [['monitor',/CCTV/],['ledger',/주민·방문 기록/],['phone',/전화/]]){const a=page.locator(`#desk [data-area="${area}"]`),ab=await a.boundingBox();assert.ok(ab.width>=44&&ab.height>=44,area);assert.match(await a.getAttribute('aria-label'),/—/);await a.click();assert.match(await page.locator('#toolTitle').innerText(),title,area);await page.locator('#backDesk').click()}
 assert.equal(await page.locator('#desk').getAttribute('data-background'),'BG01')});
await check('emergency report: separate from the decision, saved, once per case, noted on feedback, totals unchanged',async()=>{
 await page.locator('#report').click();assert.ok(await page.locator('#report').isDisabled());assert.match(await page.locator('#report').innerText(),/접수됨/);assert.deepEqual((await saved()).run.reports,[0]);
 assert.equal((await saved()).run.history.length,0,'reporting is not a decision');await page.reload();await page.locator('#resume').click();assert.ok(await page.locator('#report').isDisabled(),'kept across reload');
 await page.locator('#allow').click();await page.locator('#feedback').waitFor();assert.match(await page.locator('#reportNote').innerText(),/따로 접수/);const h=(await saved()).run.history[0];assert.equal(typeof h.correct,'boolean');
 await page.waitForTimeout(1500);await page.locator('#next').click();await idle('#portrait');assert.ok(await page.locator('#report').isEnabled(),'next visitor can be reported');assert.match(await page.locator('#reportStatus').innerText(),/따로 기록/)});
await check('N1_04 (V036, gas alarm): without a report the feedback names the separate emergency channel',async()=>{
 for(let i=1;i<3;i++){await page.locator('#deny').click();await page.locator('#feedback').waitFor();await page.waitForTimeout(1500);await page.locator('#next').click();await idle('#portrait')}
 assert.match(await page.locator('#identity').innerText(),/조성민/);await page.locator('#deny').click();await page.locator('#feedback').waitFor();
 assert.match(await page.locator('#reportNote').innerText(),/긴급 신고를 따로 할 수 있어요/);await page.waitForTimeout(1500)});
await check('night recap: tonight and the running total across nights, reports included',async()=>{
 const s=playTo(2);await inject(s);await page.locator('#resume').click();await page.locator('#result').waitFor();const t=await page.locator('#stats').innerText();assert.match(t,/오늘 밤:/);assert.match(t,/2밤 누적: 16명 중 \d+명 맞힘/);assert.match(t,/긴급 신고 0번/)});
await check('night intro shows the approved background for that night',async()=>{const s=playTo(1);S.nextNight(s,data);await inject(s);await page.locator('#resume').click();await page.locator('#nightIntro').waitFor();
 assert.equal(await page.locator('#nightIntro .scene-media').getAttribute('data-poster'),'bg:BG09');assert.match(await page.locator('#nightIntro .scene-media').evaluate(e=>e.style.backgroundImage),/assets\/bg\/BG09\.webp/)});
await check('evidence viewer: transcribed body, era backdrop, zoom by buttons, keys and pinch, Escape returns focus',async()=>{
 const s=archiveWork(playTo(3));await inject(s);await page.locator('#resume').click();await page.locator('#openArchive').click();await page.locator('#archive').waitFor();
 assert.equal(await page.locator('[data-read="EV10"]').count(),0,'no reader for evidence not found yet');const open=page.locator('[data-read="EV06"]');await open.click();const dlg=page.locator('#docViewer');assert.ok(await dlg.isVisible());
 assert.match(await page.locator('#docBody').innerText(),/최초 접수시각: 21:28/);assert.match(await page.locator('#docMeta').innerText(),/2004-11-18 21:28/);assert.match(await page.locator('#docMeta').innerText(),/원본 문서 사진이 아니에요/);
 assert.match(await page.locator('#docEra').innerText(),/2004년 기록/);const scale=()=>page.locator('#docPaper').evaluate(e=>Number(e.style.getPropertyValue('--doc-scale')));
 const fs=()=>page.locator('#docBody p').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));const f0=await fs();assert.ok(f0>=18,'readable base size '+f0);
 await page.locator('#docIn').click();assert.equal(await scale(),1.2);assert.ok(await fs()>f0);await page.keyboard.press('+');assert.equal(await scale(),1.4);await page.keyboard.press('-');assert.equal(await scale(),1.2);await page.keyboard.press('0');assert.equal(await scale(),1);
 for(let i=0;i<8;i++)await page.locator('#docIn').click().catch(()=>{});assert.equal(await scale(),2);assert.ok(await page.locator('#docIn').isDisabled());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no sideways page scroll at 200%');await page.screenshot({path:art+'/evidence-viewer-200.png'});
 await page.keyboard.press('0');await page.evaluate(()=>{const el=document.querySelector('#docPaper'),r=el.getBoundingClientRect(),t=(id,x)=>new Touch({identifier:id,target:el,clientX:r.left+x,clientY:r.top+60});
  el.dispatchEvent(new TouchEvent('touchstart',{touches:[t(1,100),t(2,160)],bubbles:true}));el.dispatchEvent(new TouchEvent('touchmove',{touches:[t(1,70),t(2,190)],bubbles:true}));el.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true}))});
 assert.equal(await scale(),2,'two-finger spread doubles the text');await page.keyboard.press('Escape');assert.ok(await dlg.isHidden());assert.equal(await page.evaluate(()=>document.activeElement?.dataset.read),'EV06','focus back on the opener')});
await check('photo evidence without its photo says so instead of inventing text; opening does not verify',async()=>{const before=(await saved()).evidenceVerified.length;
 await page.locator('[data-read="EV04"]').click();assert.match(await page.locator('#docBody').innerText(),/사진 원본이 아직 들어오지 않아/);await page.locator('#docClose').click();assert.equal((await saved()).evidenceVerified.length,before)});
await check('a paper found in the management office opens over BG08 (v0.18.0), labelled as where it was found, not as a 2026 record',async()=>{
 if(!await page.locator('#archive').isVisible()){await page.locator('#openArchive').click();await page.locator('#archive').waitFor()}
 const open=page.locator('[data-read="EV03"]');assert.equal(await open.count(),1,'EV03 found by night 3');await open.click();
 assert.equal(await page.locator('#docEra').innerText(),'찾은 곳 · 2026년 관리사무소');assert.match(await page.locator('#docViewer .doc-backdrop').evaluate(e=>e.style.backgroundImage),/assets\/bg\/BG08\.webp/);
 assert.match(await page.locator('#docMeta').innerText(),/2006/);await page.screenshot({path:art+'/evidence-viewer-found-at-BG08.png'});await page.locator('#docClose').click()});
await check('ending cutscene: the guard-room shot uses the approved BG01',async()=>{const s=playTo(1);await inject(s);await page.locator('#resume').click();await page.locator('#result').waitFor();
 const posters=[];for(let i=0;i<4;i++){posters.push(await page.locator('#result .scene-media').getAttribute('data-poster'));await page.locator('#result .scene-media').click()}assert.ok(posters.includes('bg:BG01'),posters.join(','))});
await check('zero uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
await browser.close();server.close();await writeFile(art+'/game-ui-results.json',JSON.stringify(results,null,1));if(failed)process.exit(1);
