// Static figure check on the game's own stage (v0.18.0): every approved full-body figure in character_assets.json and the
// legacy gate-visitor looks, on BG02 through the intercom camera (what the game shows), via the QA viewer's still mode.
//   node tests/figures-qa.mjs  -> test-artifacts/figures/<id>.png (stage only), test-artifacts/figures/figures_qa.json
// Measured per figure: feet on the stand point, figure height on screen against height_m (same depth, same camera),
// both contact shadows under the soles, the figure's mean light against the background next to it. The pictures are for
// the visual review (head size, light, shadow, occlusion); this script does not grade them.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {brotliDecompressSync} from 'node:zlib';
import {startServer} from './static-server.mjs';
const out=resolve('test-artifacts','figures');await mkdir(out,{recursive:true});
const {server,origin}=await startServer(resolve('..'));
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='linux'){executablePath=resolve(tmpdir(),'room404-chromium');const size=await stat(executablePath).then(s=>s.size).catch(()=>0);if(size<1000000)await writeFile(executablePath,brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/chromium.br')),{mode:0o755})}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1280,height:1400}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/room404/qa/');await page.locator('[data-mode="still"]').click();
const ids=await page.locator('#figure option').evaluateAll(o=>o.map(x=>x.value));const rows=[];
for(const scene of ['BG02:intercom:idle'])for(const id of ids){
 await page.selectOption('#scene',scene);await page.selectOption('#figure',id);await page.locator('#sOverlay').uncheck();
 await page.waitForFunction(()=>document.querySelector('#stillStage').dataset.state==='idle');await page.waitForTimeout(80);
 const m=await page.evaluate(()=>{const d=qa.still().debug(),c=document.querySelector('#stillStage canvas'),g=c.getContext('2d'),k=c.width/d.cam[2];
  const px=(x,y)=>[Math.round((x-d.cam[0])*k),Math.round((y-d.cam[1])*k)];const [x0,y0]=px(d.placed.box[0],d.placed.box[1]),[x1,y1]=px(d.placed.box[2],d.placed.box[3]);
  const lum=(x,y,w,h)=>{const a=g.getImageData(Math.max(0,x),Math.max(0,y),Math.max(1,w),Math.max(1,h)).data;let s=0;for(let i=0;i<a.length;i+=4)s+=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];return s/(a.length/4)};
  const w=x1-x0,h=y1-y0;return {box:d.placed.box,z:d.placed.z,scale:d.placed.scale,shadows:d.placed.shadows,canvas:[c.width,c.height],
   torso_lum:Math.round(lum(x0+w*.3,y0+h*.3,w*.4,h*.2)),beside_lum:Math.round((lum(x0-w*.5,y0+h*.3,w*.3,h*.2)+lum(x1+w*.2,y0+h*.3,w*.3,h*.2))/2)}});
 await page.locator('#stillStage').screenshot({path:`${out}/${id}.png`});
 rows.push({id,scene,...m})}
const chars=JSON.parse(await readFile('dist/data/character_assets.json','utf8')),layout=JSON.parse(await readFile('dist/data/scene_layout.json','utf8'));
const bg=layout.backgrounds.BG02,c=bg.camera_model,sp=bg.stand_points.idle;
for(const r of rows){const f=(chars.assets[r.id]||chars.visitor_role_figures?.[r.id])?.figure||chars.legacy.figures[r.id];r.height_m=f.height_m;r.screen_height_design_px=+(r.box[3]-r.box[1]).toFixed(1);
 r.expected_height_design_px=+(f.height_m*c.focal_px/sp.z).toFixed(1);r.feet_on_stand_point=Math.abs(r.box[3]-sp.y)<1e-6;r.shadows_under_soles=r.shadows.length===2&&r.shadows.every(s=>s[1]===sp.y);r.kind=chars.assets[r.id]?'approved':chars.visitor_role_figures?.[r.id]?'role_off':'legacy'}
await writeFile(`${out}/figures_qa.json`,JSON.stringify({generated:new Date().toISOString().slice(0,10),scene:'BG02 intercom idle',stand_point:sp,errors,rows},null,1));
for(const r of rows)console.log(r.id.padEnd(11),r.kind.padEnd(8),'h',r.screen_height_design_px,'/',r.expected_height_design_px,'feet',r.feet_on_stand_point,'shadow',r.shadows_under_soles,'lum fig/bg',r.torso_lum,r.beside_lum);
await browser.close();server.close();if(errors.length){console.error(errors);process.exit(1)}
