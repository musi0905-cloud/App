// Open the real QA viewer (room404/qa) for NPC06, step v06 / v09 / v09r frame by frame (full, legs 3x, torso 3x), save the
// canvas PNGs and time 24 fps and 12 fps playback.  usage (from room404/): node ../asset-source/v09_NPC06/tools/viewer_capture.mjs <outdir>
const R=decodeURIComponent(new URL("../../../room404/",import.meta.url).pathname).replace(/\/$/,"");
const {chromium}=await import(R+'/node_modules/playwright/index.mjs');const {startServer}=await import(R+'/tests/static-server.mjs');
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
const out=process.argv[2];await mkdir(out,{recursive:true});const {server,origin}=await startServer(resolve(R,'..'));
let exe=resolve(tmpdir(),'room404-chromium');if(((await stat(exe).catch(()=>null))?.size||0)<1e6)await writeFile(exe,brotliDecompressSync(await readFile(R+'/node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755});
const b=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});const p=await b.newPage({viewport:{width:1280,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(origin+'/room404/qa/');await p.waitForFunction(()=>document.querySelector('#clipCanvas').dataset.frame==='0');
await p.selectOption('#npc','NPC06');for(const ov of ['foot','click','occ'])await p.locator(`[data-ov="${ov}"]`).uncheck();
const shot=async name=>{const d=await p.evaluate(()=>document.querySelector('#clipCanvas').toDataURL('image/png'));await writeFile(`${out}/${name}.png`,Buffer.from(d.split(',')[1],'base64'))};
const log={};
for(const rev of ['v06','v09','v09r']){await p.selectOption('#rev',rev);await p.locator('button[data-view="seq"]').click();await p.waitForTimeout(500);
 for(const zoom of ['full','legs','torso']){await p.selectOption('#zoom',zoom);
  for(const n of [0,24,32,64,121,122,141,142,152,180,200]){await p.locator('#frame').fill(String(n));await p.waitForTimeout(140);await shot(`${rev}_${zoom}_${String(n).padStart(3,'0')}`)}}
 await p.selectOption('#zoom','full');
 for(const fps of [24,12]){await p.selectOption('#speed',String(fps));await p.locator('#frame').fill('0');await p.waitForTimeout(150);const seen=[];const t0=Date.now();await p.locator('#play').click();
  while(Date.now()-t0<25000){seen.push(Number(await p.locator('#clipCanvas').getAttribute('data-frame')));if(!(await p.locator('#play').innerText()).includes('멈춤'))break;await p.waitForTimeout(20)}
  const ms=Date.now()-t0;log[`${rev}_${fps}`]={ms,last:seen.at(-1),monotonic:seen.every((v,i)=>!i||v>=seen[i-1]),fps_measured:+(214/(ms/1000)).toFixed(1)}}
 await p.selectOption('#speed','24')}
log.errors=errors;await writeFile(`${out}/playback.json`,JSON.stringify(log,null,1));console.log(JSON.stringify(log));await b.close();server.close();
