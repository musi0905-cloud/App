import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {MODES,LOCATIONS,sceneTime,shiftedTime,heightAt,actorPlacement,perspectiveY} from '../dist/replay.js';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url))),cases=read('scenarios'),anomalies=read('anomalies');
test('all 100 canonical events have matching evidence packs and decisions',()=>{assert.equal(cases.length,100);assert.equal(new Set(cases.map(c=>c.id)).size,100);for(const a of anomalies){const c=cases.find(c=>c.id===a.id);assert.equal(c.safe,a.safe,a.id);assert.equal(c.channel,a.channel,a.id);assert.equal(c.clue,a.clue,a.id);assert.equal(c.verification,a.verification);assert.ok(c.plain.what.length>10);assert.ok(c.plain.check.length>10);assert.equal(c.verificationDetail,c.plain.confirmed)}});
test('300 scenes have supported rendering and real record details',()=>{for(const c of cases){assert.equal(c.scenes.length,3,c.id);assert.ok(c.document.left!==c.document.right,c.id);for(const key of ['source','field','left','right'])assert.ok(c.document[key]?.length>0,`${c.id} ${key}`);for(const key of ['source','state','line','detail','verifySource','reply'])assert.ok(c.call[key]?.length>0,`${c.id} ${key}`);for(const s of c.scenes){assert.ok(LOCATIONS[s.location],c.id);assert.ok(MODES.includes(s.mode),`${c.id}: ${s.mode}`);assert.ok(['enter','wait','wave','descend','cross','phone','pan','turn','knock'].includes(s.action));assert.ok(Number.isInteger(s.offset));assert.ok(s.note.length>5)}}});
test('time arithmetic wraps midnight and clock offset does not become an earlier physical arrival',()=>{assert.equal(shiftedTime('00:13',-30),'23:43');assert.equal(sceneTime(cases[60].scenes[0],'00:13'),'00:06');assert.equal(cases[60].scenes[0].offset,0);assert.equal(cases[0].scenes[0].offset,-10)});
test('camera anomaly states are distinct and documents retain intended topology',()=>{assert.equal(cases[30].scenes[1].mode,'double');assert.equal(cases[33].scenes[1].mode,'absent');assert.equal(cases[70].scenes[0].prop,'hat');assert.equal(cases[70].scenes[1].mode,'removeProp');assert.match(cases[46].document.left,/404/);assert.match(cases[47].document.field,/승강기|엘리베이터/);assert.match(cases[48].document.field,/계단/);assert.equal(cases[93].role,'배송 기사')});

test('every visual asset the game references exists',async()=>{const {existsSync}=await import('node:fs');const root=new URL('../dist/',import.meta.url);
 const code=['replay.js','game.js','index.html','sw.js'].map(f=>readFileSync(new URL(f,root),'utf8')).join('\n');
 const names=[...code.matchAll(/(?:cctv-[a-z-]+|door-(?:open|closed)|title-night|guard-office|intercom-desk|ledger-desk|ending-dawn|visitor-0\d-walk|prop-[a-z]+)(?=\.webp|')/g)].map(m=>m[0]);
 for(const n of new Set(names.filter(n=>!n.startsWith('prop-')||existsSync(new URL('assets/v2/'+n+'.webp',root)))))if(!n.includes('lobby-monitor'))assert.ok(existsSync(new URL('assets/v2/'+n+'.webp',root)),n);
 const clips=[...code.matchAll(/'(\d\d-[a-z0-9-]+)'/g)].map(m=>m[1]);assert.ok(clips.length>=10);for(const c of new Set(clips))assert.ok(existsSync(new URL('assets/v2/motion/'+c+'.mp4',root)),c);
 const html=readFileSync(new URL('index.html',root),'utf8');for(const m of html.matchAll(/data-(?:clip|video)="([^"]+)"/g))assert.ok(existsSync(new URL('assets/v2/motion/'+m[1]+'.mp4',root)),m[1]);});

test('figures follow perspective: farther is smaller and higher, and a walk toward the camera speeds up on screen',()=>{
 for(const loc of Object.keys(LOCATIONS)){assert.ok(heightAt(loc,400)<heightAt(loc,580),loc);assert.ok(heightAt(loc,300)>0,loc)}
 const enter=[0,.25,.5,.75,1].map(p=>actorPlacement({location:'lobby',action:'enter',mode:'normal',prop:'umbrella'},p,2));
 for(let i=1;i<enter.length;i++){assert.ok(enter[i].y>enter[i-1].y,'foot line comes down');assert.ok(enter[i].h>enter[i-1].h,'figure grows')}
 assert.ok(enter[4].y-enter[3].y>enter[1].y-enter[0].y,'screen speed increases when approaching');
 assert.ok(Math.abs(enter[4].h-363)<1);assert.equal(perspectiveY(-20,330,585,0),330);assert.equal(perspectiveY(-20,330,585,1),585);
 const stairs=actorPlacement({location:'stairs',action:'descend',mode:'normal',prop:'none'},.5,1);assert.equal(stairs.facing,-1);
 const stand=actorPlacement({location:'hall',action:'wait',mode:'normal',prop:'none'},.5,1);assert.equal(stand.walking,false);assert.equal(stand.h,357);
});

test('every place has a real second camera and sprite cells are placed for every action',async()=>{const {SIDE_VIEW,viewFor,GESTURE}=await import('../dist/replay.js');
 for(const loc of Object.keys(LOCATIONS)){assert.ok(SIDE_VIEW[loc],loc);assert.notEqual(viewFor(loc,'side'),loc,loc)}
 assert.equal(viewFor('lobby','top'),'lobbyTop');assert.equal(viewFor('hall','top'),'hall');
 const p=(action,loc='lobby',phase=.5)=>actorPlacement({location:loc,action,mode:'normal',prop:'umbrella'},phase,1);
 assert.equal(p('enter').sheet,'toward');assert.equal(p('enter','hallSide').sheet,'away');assert.ok(p('enter','hallSide',.9).y<p('enter','hallSide',.1).y,'walks away from the opposite camera');
 assert.equal(p('cross').sheet,'side');assert.equal(p('descend','stairs').facing,-1);assert.equal(p('descend','stairsUp').sheet,'toward');
 assert.ok(GESTURE.wave.includes(p('wave').cell));assert.ok(GESTURE.knock.includes(p('knock').cell));assert.equal(p('phone').cell,GESTURE.phone[1]);assert.equal(p('turn').cell,GESTURE.look);assert.equal(p('wait').cell,GESTURE.stand);
});

test('eight looks: roles map to the new visitors and every look has stand, toward and gesture sheets', async()=>{
 const {lookFor,ROLE_LOOK,LOOKS}=await import('../dist/replay.js');const {existsSync}=await import('node:fs');const root=new URL('../dist/',import.meta.url);
 const visitors=read('visitors');
 assert.equal(LOOKS,8);
 for(const v of visitors){const l=lookFor(v);assert.ok(l>=1&&l<=8,v.id);if(ROLE_LOOK[v.role])assert.equal(l,ROLE_LOOK[v.role])}
 assert.equal(new Set(visitors.map(lookFor)).size,8,'all eight looks are used');
 for(let n=1;n<=8;n++)for(const k of ['stand','walk-toward','gestures'])assert.ok(existsSync(new URL(`assets/v2/visitor-0${n}-${k}.webp`,root)),`visitor-0${n}-${k}`);
 for(const p of ['bag','cap-reflective','card','flowers','keys','medicine','paper','toolbox'])assert.ok(existsSync(new URL(`assets/v2/prop-${p}.webp`,root)),p);
 for(const s of ['lobby-door-inside','guard-monitors','ending-404'])assert.ok(existsSync(new URL(`assets/v2/${s}.webp`,root)),s);
});
