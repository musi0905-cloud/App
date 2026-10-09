// Five-night story in a real browser (v0.14.0): real clicks through N1-N5, save/reload, archive endings, the final
// board, blocked endings, legacy save migration, and the cutscene + spoken lines of all 30 endings.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';import {startServer} from './static-server.mjs';
import * as S from '../dist/story.js';import {newRun,decideRun,advance} from '../dist/engine.js';
import {data,gates,endings,playTo,playNight,archiveWork,defaultChoice,read} from './story-helpers.mjs';
const characterAssets=read('character_assets');
const root=resolve('dist'),art=resolve('test-artifacts');await mkdir(art,{recursive:true});
const {server,origin}=await startServer(root);const results=[];let failed=false;
async function check(name,fn){const t0=Date.now();try{await fn();results.push({test:name,status:'PASS',ms:Date.now()-t0});console.log('PASS',name)}catch(e){failed=true;results.push({test:name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message)}}
const slot=id=>data.slots.find(s=>s.scene_id===id),scene=(n,i)=>S.sceneId(n,i+1);
const story=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('404_story_v3')));
// Leave the game first (it saves its in-memory state when the page is hidden), write the saves, then open the game again.
async function inject(page,{storyState=null,daily=null,last='story',extra={}}){
 await page.goto(origin+'/manifest.webmanifest');
 await page.evaluate(({st,d,last,extra})=>{localStorage.clear();if(st)localStorage.setItem('404_story_v3',JSON.stringify(st));if(d)localStorage.setItem('404_active_v2',JSON.stringify(d));localStorage.setItem('404_last_mode',JSON.stringify(last));for(const [k,v] of Object.entries(extra))localStorage.setItem(k,v)},{st:storyState,d:daily,last,extra});
 await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled)}
async function resume(page){await page.locator('#resume').click()}
// One night through the real buttons: right door decision, then (nights 2-5) the story card: re-check and handling choice.
async function playNightUI(page,n,{choose=defaultChoice,check=()=>true,afterCase=null}={}){
 for(let i=0;i<8;i++){const sc=scene(n,i),sl=slot(sc);
  await page.locator('#game').waitFor({state:'visible'});assert.equal(await page.locator('#storyCard').isVisible(),false,'no story card on the decision screen');
  if(n>1){const txt=await page.locator('#game').innerText();assert.ok(!txt.includes(sl.story_contact_arrival)&&!/EV\d\d|E\d\d/.test(txt),'decision screen leaks nothing of the story record: '+sc)}
  await page.locator(sl.gate_outcome==='allow'?'#allow':'#deny').click();await page.locator('#feedback').waitFor({state:'visible'});
  if(n>1){assert.ok(await page.locator('#storyCard').isVisible(),sc);const fig=characterAssets.contacts[sc]||null;assert.equal(await page.locator('#contactScreen').isVisible(),!!fig,sc+' portrait shown only for an approved figure');if(fig)assert.equal(await page.locator('#contactPortrait [data-character]').getAttribute('data-character'),fig,sc);assert.match(await page.locator('#contactLine').innerText(),new RegExp(sl.story_contact_arrival.slice(0,6)));
   const opts=data.flow.choices[sc];if(opts)assert.ok(await page.locator('#next').isDisabled(),'a handling choice is required: '+sc);
   if(check(sc)){await page.locator('#contactRecheck').click();for(const ev of sl.story_ev_candidates)assert.match(await page.locator('#contactResult').innerText(),new RegExp(ev))}
   if(opts){await page.locator(`[data-choice="${choose(sc)}"]`).click();assert.equal(await page.locator(`[data-choice="${choose(sc)}"]`).getAttribute('aria-pressed'),'true')}}
  if(afterCase)await afterCase(i,sc);
  await page.locator('#next').click()}
 await page.locator('#result').waitFor({state:'visible'})}
// Archive work through the UI: every possible cross-check, then every ready puzzle (one wrong order first, which must be a retry).
async function archiveUI(page,{wrongFirst=false}={}){await page.locator('#archiveTabs [data-tab="evidence"]').click();
 for(let k=0;k<40;k++){const b=page.locator('[data-verify]').first();if(!await b.count())break;await b.click()}
 await page.locator('#archiveTabs [data-tab="puzzles"]').click();
 for(const p of data.evidence.puzzles){if(!await page.locator(`[data-solve="${p.id}"]`).count())continue;const sel=page.locator(`[data-order="${p.id}"]`);
  if(wrongFirst){for(let i=0;i<3;i++)await sel.nth(i).selectOption(p.order[2-i]);await page.locator(`[data-solve="${p.id}"]`).click();assert.match(await page.locator('#archiveStatus').innerText(),/순서가 맞지 않아요/);wrongFirst=false}
  for(let i=0;i<3;i++)await page.locator(`[data-order="${p.id}"]`).nth(i).selectOption(p.order[i]);await page.locator(`[data-solve="${p.id}"]`).click();assert.match(await page.locator('#archiveStatus').innerText(),/풀었어요/)}}
async function expectEnding(page,id){await page.locator('#result').waitFor({state:'visible'});assert.equal(await page.locator('#ending').getAttribute('data-ending-id'),id);
 const se=endings.find(e=>e.id===id);assert.equal(await page.locator('#ending').innerText(),se.title,id);assert.equal(await page.locator('#cutDots span').count(),4,id);
 assert.equal(await page.locator('#cutCaption').innerText(),se.cutscene[0].caption,id+' first shot');assert.equal(await page.locator('#cutLines li').count(),se.dialogue.length,id);
 assert.match(await page.locator('#cutLines').innerText(),new RegExp(se.dialogue[0].text.slice(0,8).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),id);
 await page.locator('#cutCaption').click();assert.equal(await page.locator('#cutCaption').innerText(),se.cutscene[1].caption,id+' tap goes to shot 2')}

let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 await context.addInitScript(()=>{const synth={speak(u){setTimeout(()=>u.onend&&u.onend(),5)},cancel(){},getVoices(){return[]}};Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});window.SpeechSynthesisUtterance=function(t){this.text=t}});
 page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled);
 let finalSnapshot=null;
 await check('five nights by real clicks: N1 -> N5, archive ending E07 on the way, E30 at the end, reload in between',async()=>{
  await inject(page,{});await page.locator('#startStory').click();
  await playNightUI(page,1);assert.equal(await page.locator('#ending').getAttribute('data-ending-id'),'E06','night 1 keeps the engine ending (no investigation -> 첫 기록)');
  assert.equal(await page.locator('#nextNight').innerText(),'2야간 근무 시작');await page.screenshot({path:art+'/story-n1-result.png',fullPage:true});
  for(let n=2;n<=5;n++){await page.locator('#nextNight').click();await page.locator('#nightIntro').waitFor({state:'visible'});assert.equal(await page.locator('#introTitle').innerText(),data.flow.nights[n].title);
   if(n===2)await page.screenshot({path:art+'/story-n2-intro.png',fullPage:true});
   await page.locator('#beginShift').click();assert.match(await page.locator('#shiftLabel').innerText(),new RegExp(n+'야간'));
   await playNightUI(page,n,{choose:sc=>sc==='N2_01'?'accept_unverified_replacement':defaultChoice(sc),afterCase:async(i,sc)=>{
    if(n===2&&i===0)await page.screenshot({path:art+'/story-n2-card.png',fullPage:true});
    if(n===4&&i===3){await page.waitForFunction(()=>getComputedStyle(document.querySelector('#contactPortrait .person-sprite')).backgroundImage.includes('bust-CH09'));await page.screenshot({path:art+'/story-contact-portrait.png',fullPage:false})}
    if(n===3&&i===2){const before=await story(page);await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);assert.match(await page.locator('#resume').innerText(),/3야간/);await resume(page);
     await page.locator('#feedback').waitFor({state:'visible'});const after=await story(page);assert.deepEqual(after,before,'reload keeps the whole story state');assert.ok(await page.locator('#storyCard').isVisible())}}});
   const st=await story(page);assert.equal(st.nightCompleted,n);assert.equal(st.completedScenes.length,8*n);
   assert.match(await page.locator('#ending').innerText(),new RegExp(n+'야간 근무 종료'));
   if(n<5){await page.locator('#openArchive').click();await archiveUI(page,{wrongFirst:n===2});
    if(n===2){await page.screenshot({path:art+'/story-archive-puzzle.png',fullPage:true});await page.locator('#archiveTabs [data-tab="records"]').click();await page.locator('[data-select="N2_08"]').click();await page.locator('[data-finish="N2_08"]').click();assert.match(await page.locator('.hint-list').innerText(),/따로 마무리할 결말이 없어요/);
     await page.locator('[data-select="N2_01"]').click();await page.locator('[data-finish="N2_01"]').click();await expectEnding(page,'E07');await page.screenshot({path:art+'/story-ending-E07.png',fullPage:true});
     const kept=await story(page);assert.equal(kept.nightCompleted,2);assert.equal(kept.archiveEndingConfirmed,false);assert.ok(kept.endingsUnlocked.includes('E07'));await page.locator('#archiveReturn').click()}
    await page.locator('#archiveBack').click();await page.locator('#result').waitFor({state:'visible'})}}
  assert.equal(await page.locator('#nextNight').innerText(),'최종 증거보드 열기');await page.locator('#nextNight').click();
  await page.locator('#archiveTabs [data-tab="final"]').waitFor({state:'visible'});const submit=page.locator('[data-final="submit_verified_evidence"]');
  assert.ok(await submit.isDisabled(),'submit is off while evidence/puzzles are missing');const hints=await page.locator('.hint-list').innerText();assert.match(hints,/교차 확인하지 않은 핵심 자료|기록 대조/);assert.doesNotMatch(hints,/E\d\d|강태준/);
  await page.screenshot({path:art+'/story-final-blocked.png',fullPage:true});
  await page.locator('[data-goto="evidence"]').click();await archiveUI(page);await page.locator('#archiveTabs [data-tab="final"]').click();
  assert.ok(await submit.isEnabled(),'submit opens once everything is verified, solved, preserved and the route is open');
  finalSnapshot=await story(page);await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);assert.equal(await page.locator('#resume').innerText(),'최종 증거보드 열기');await resume(page);
  assert.ok(await page.locator('[data-final="submit_verified_evidence"]').isEnabled(),'conditions survive a restart');
  await page.locator('[data-final="submit_verified_evidence"]').click();await expectEnding(page,'E30');await page.screenshot({path:art+'/story-ending-E30.png',fullPage:true});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);assert.equal(await page.locator('#resume').innerText(),'지난 결과 보기');await resume(page);assert.equal(await page.locator('#ending').getAttribute('data-ending-id'),'E30');
 });
 await check('final choices E28 and E29 from the saved final board (restart in between)',async()=>{assert.ok(finalSnapshot,'needs the playthrough snapshot');
  for(const [v,id] of [['seal_archive','E28'],['resign','E29']]){await inject(page,{storyState:finalSnapshot});await resume(page);await page.locator(`[data-final="${v}"]`).click();await expectEnding(page,id);const st=await story(page);assert.equal(st.ending,id);assert.equal(st.finalChoice,v)}});
 await check('blocked archive ending: missing evidence is named without spoilers, recovered from the archive, then allowed',async()=>{
  const skip=new Set(['N2_01','N2_04','N2_08']);const st=playTo(2,{check:sc=>!skip.has(sc),choose:sc=>sc==='N2_01'?'accept_unverified_replacement':defaultChoice(sc)});
  await inject(page,{storyState:st});await resume(page);await page.locator('#openArchive').click();await page.locator('#archiveTabs [data-tab="records"]').click();await page.locator('[data-select="N2_01"]').click();
  await page.locator('[data-finish="N2_01"]').click();assert.ok(await page.locator('#archive').isVisible(),'no ending');const h=await page.locator('.hint-list').innerText();assert.match(h,/자료를 아직 입수하지/);assert.doesNotMatch(h,/E07|가짜 교대자/);
  await page.screenshot({path:art+'/story-archive-blocked.png',fullPage:true});
  await page.locator('[data-recover="N2_01"]').click();assert.match(await page.locator('#archiveStatus').innerText(),/복구/);await page.locator('[data-finish="N2_01"]').click();await expectEnding(page,'E07');
  const other=playTo(2);await inject(page,{storyState:other});await resume(page);await page.locator('#openArchive').click();await page.locator('#archiveTabs [data-tab="records"]').click();await page.locator('[data-select="N2_01"]').click();await page.locator('[data-finish="N2_01"]').click();assert.match(await page.locator('.hint-list').innerText(),/처리 기록/);
 });
 await check('all 30 endings: each one shows its own title, four shots and spoken lines in the page',async()=>{const seen=[];
  // E01: daily shift ending (engine). E02-E06: night 1 of the story (engine). States come from playing with the game's own functions.
  const d=newRun('story',data.visitors,data.anomalies,'2026-10-08');d.mode='daily';for(const c of d.cases){decideRun(d,data.anomalies.find(a=>a.id===c.anomaly).safe,data.anomalies);advance(d)}
  await inject(page,{daily:d,last:'daily'});await resume(page);await expectEnding(page,'E01');seen.push('E01');
  const ok=[true,false,true,false,true,false,true,false];
  for(const [id,choices,inv] of [['E02',ok,true],['E03',[true,true,true,true,true,false,true,false],false],['E04',Array(8).fill(false),false],['E05',Array(8).fill(true),false],['E06',ok,false]]){let i=0;const st=playNight(S.startStory(data,'2026-10-08'),{decide:()=>choices[i++],investigate:inv});await inject(page,{storyState:st});await resume(page);await expectEnding(page,id);seen.push(id)}
  for(const g of gates.filter(g=>g.type==='optional_archive_resolution')){const ch=g.conditions.find(c=>c.op==='choice'),min=g.conditions.find(c=>c.op==='night').min;const st=playTo(min,{choose:sc=>sc===ch.scene?ch.value:defaultChoice(sc)});
   await inject(page,{storyState:st});await resume(page);await page.locator('#openArchive').click();await page.locator('#archiveTabs [data-tab="records"]').click();await page.locator(`[data-select="${ch.scene}"]`).click();await page.locator(`[data-finish="${ch.scene}"]`).click();await expectEnding(page,g.id);seen.push(g.id)}
  const fin=playTo(5);archiveWork(fin);S.openFinal(fin);for(const [v,id] of [['seal_archive','E28'],['resign','E29'],['submit_verified_evidence','E30']]){await inject(page,{storyState:fin});await resume(page);await page.locator(`[data-final="${v}"]`).click();await expectEnding(page,id);seen.push(id)}
  assert.deepEqual(seen.sort(),gates.map(g=>g.id).sort());
 });
 await check('old 404_active_v2 first-shift save becomes night 1 of the story; the original is kept',async()=>{
  const old=newRun('story',data.visitors,data.anomalies,'2026-10-07');decideRun(old,true,data.anomalies);advance(old);old.seen=['CCTV'];
  await inject(page,{daily:old,last:'story'});const st=await story(page);assert.equal(st.migration.fromLegacy.decided,1);assert.deepEqual(st.completedScenes,['N1_01']);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('404_active_v2_backup'))),old);await resume(page);await page.locator('#game').waitFor({state:'visible'});assert.match(await page.locator('#progress').innerText(),/02 \/ 08/);assert.match(await page.locator('#evidence').innerText(),/CCTV/);
 });
 await check('narrow phone (320px): story screens do not scroll sideways',async()=>{await page.setViewportSize({width:320,height:640});
  const st=playTo(2);await inject(page,{storyState:st});await resume(page);for(const tab of ['evidence','puzzles','records']){await page.locator('#openArchive').isVisible()&&await page.locator('#openArchive').click();await page.locator(`#archiveTabs [data-tab="${tab}"]`).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab)}
  await page.screenshot({path:art+'/story-archive-320.png',fullPage:true});await page.setViewportSize({width:390,height:844})});
 await check('120 restarts: every one of the 40 scenes is closed and reopened before, during and after its decision',async()=>{let restarts=0;
  const restart=async(expect)=>{const before=await story(page);await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await resume(page);restarts++;
   const after=await story(page);assert.deepEqual(after,before,`state kept at restart ${restarts}`);await page.locator(expect).waitFor({state:'visible'})};
  await inject(page,{});await page.locator('#startStory').click();
  for(let n=1;n<=5;n++){if(n>1){await page.locator('#nextNight').click();await page.locator('#beginShift').click()}
   for(let i=0;i<8;i++){const sc=scene(n,i),sl=slot(sc);
    await restart('#game');assert.match(await page.locator('#progress').innerText(),new RegExp(String(i+1).padStart(2,'0')+' / 08'),sc);
    await page.locator('[data-tool="CCTV"]').click();await page.locator('#toolAction').click();await page.locator('#backDesk').click();
    await restart('#game');assert.deepEqual((await story(page)).run.seen,['CCTV'],sc+' open evidence kept');
    await page.locator(sl.gate_outcome==='allow'?'#allow':'#deny').click();
    if(n>1){await page.locator('#contactRecheck').click();if(data.flow.choices[sc])await page.locator(`[data-choice="${defaultChoice(sc)}"]`).click()}
    await restart('#feedback');const st=await story(page);assert.ok(st.completedScenes.includes(sc),sc);
    if(n>1){assert.ok(st.sceneChecks.includes(sc));assert.equal(await page.locator('#contactRecheck').isVisible(),false,'re-check is not offered twice');if(data.flow.choices[sc])assert.equal(await page.locator(`[data-choice="${defaultChoice(sc)}"]`).getAttribute('aria-pressed'),'true')}
    await page.locator('#next').click()}
   await page.locator('#result').waitFor({state:'visible'});const st=await story(page);assert.equal(st.nightCompleted,n);assert.equal(st.accessHistory.length,n,'a night is counted once')}
  assert.equal(restarts,120);const end=await story(page);assert.equal(end.completedScenes.length,40);assert.equal(end.sceneChecks.length,32);
  await page.locator('#nextNight').click();await page.locator('[data-goto="evidence"]').click();await archiveUI(page);await page.locator('#archiveTabs [data-tab="final"]').click();
  await page.reload();await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await resume(page);await page.locator('[data-final="submit_verified_evidence"]').click();await expectEnding(page,'E30');
 });
 await check('zero uncaught JavaScript errors in the story run',async()=>assert.deepEqual(errors,[]));
 await context.close();
}catch(e){failed=true;results.push({test:'story browser infrastructure',status:'FAIL',error:e.message});console.error(e)}finally{await browser.close();server.close();await writeFile(art+'/story-ui-results.json',JSON.stringify({timestamp:new Date().toISOString(),results},null,2))}
if(failed)process.exitCode=1;
