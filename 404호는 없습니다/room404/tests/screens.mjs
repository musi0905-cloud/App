// Screenshots of the real game screens for visual review (not a pass/fail test).
//   node tests/screens.mjs [outdir]      default outdir: test-artifacts/screens
// Captures the gate visitor desk, the night-2 story contact card, the archive evidence viewer and a story ending, each at
// phone (390x844) and desktop (1280x900) width. Saves are injected the same way story-ui.mjs does.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import {startServer} from './static-server.mjs';
import * as S from '../dist/story.js';
import {data,playTo,archiveWork} from './story-helpers.mjs';
const out=resolve(process.argv[2]||'test-artifacts/screens');await mkdir(out,{recursive:true});
const {server,origin}=await startServer(resolve('dist'));
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
async function inject(page,st){await page.goto(origin+'/manifest.webmanifest');await page.evaluate(st=>{localStorage.clear();localStorage.setItem('404_story_v3',JSON.stringify(st));localStorage.setItem('404_last_mode','"story"')},st);await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled)}
const settle=page=>page.waitForTimeout(900);
for(const [label,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1280,height:900}]]){
 const page=await browser.newPage({viewport,deviceScaleFactor:2});
 // 1) Night 1 desk with the first gate visitor.
 await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startStory').disabled);await page.locator('#startStory').click();await page.locator('#game').waitFor();await settle(page);
 await page.screenshot({path:`${out}/${label}-1-desk.png`,fullPage:true});
 // 2) Night 3, first case decided and re-checked: the story contact card (N3_01 has an approved figure, MC15).
 const s2=playTo(2);S.nextNight(s2,data);S.beginShift(s2);await inject(page,s2);await page.locator('#resume').click();await page.locator('#game').waitFor();
 await page.locator('#allow').click();await page.locator('#feedback').waitFor();await page.waitForTimeout(1600);await page.locator('#contactRecheck').click();await settle(page);
 await page.screenshot({path:`${out}/${label}-2-contact.png`,fullPage:true});
 // 3) Archive evidence list after five nights, with every check done.
 const s5=archiveWork(playTo(5));S.openFinal(s5);await inject(page,s5);await page.locator('#resume').click();await settle(page);
 await page.screenshot({path:`${out}/${label}-3-final.png`,fullPage:true});
 await page.locator('#archiveTabs [data-tab="evidence"]').click();await settle(page);
 await page.screenshot({path:`${out}/${label}-4-evidence.png`,fullPage:true});
 await page.locator('[data-read="EV06"]').click();await settle(page);await page.screenshot({path:`${out}/${label}-5-document.png`});
 await page.locator('#docIn').click();await page.locator('#docIn').click();await page.screenshot({path:`${out}/${label}-6-document-zoom.png`});await page.keyboard.press('Escape');
 await page.close();
}
await browser.close();server.close();console.log('screens written to',out);
