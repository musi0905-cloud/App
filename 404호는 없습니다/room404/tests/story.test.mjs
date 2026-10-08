import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {newRun,ending,ENDING_IDS,TIMES,decideRun,TOOLS} from '../dist/engine.js';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const visitors=read('visitors'),anomalies=read('anomalies'),sv=read('story_visitors'),scenes=read('story_scenes'),endings=read('story_endings');
const pairs=Object.fromEntries(sv.map(v=>[v.id,v.anomaly_id]));

test('story v1.1 visitors: one pinned anomaly each, consistent with the game data',()=>{
 assert.equal(sv.length,100);assert.equal(new Set(sv.map(v=>v.id)).size,100);
 assert.equal(new Set(sv.map(v=>v.anomaly_id)).size,100,'every anomaly is used exactly once');
 for(const v of sv){const g=visitors.find(x=>x.id===v.id),a=anomalies.find(x=>x.id===v.anomaly_id);assert.ok(g&&a,v.id);
  assert.equal(v.name,g.name,v.id);assert.equal(v.role,g.role,v.id);assert.equal(v.destination,g.unit,v.id);
  assert.equal(v.canonical_outcome==='allow',a.safe,`${v.id} outcome must match ${a.id}.safe`);assert.equal(v.anomaly_kind,a.category,v.id)}
 assert.equal(sv.filter(v=>v.canonical_outcome==='allow').length,50);
});

test('night 1 pins equal the engine first shift, slot by slot, with the same clock',()=>{
 const r=newRun('story',visitors,anomalies),pinned=sv.filter(v=>v.night1_pinned);
 assert.deepEqual(pinned.map(v=>[v.id,v.anomaly_id]),r.cases.map(c=>[c.visitor,c.anomaly]));
 const n1=scenes.filter(s=>s.night===1).sort((a,b)=>a.slot-b.slot);
 assert.equal(scenes.length,40);assert.deepEqual([1,2,3,4,5].map(n=>scenes.filter(s=>s.night===n).length),[8,8,8,8,8]);
 assert.deepEqual(n1.map(s=>s.local_time),TIMES);
 n1.forEach((s,i)=>{const a=anomalies.find(x=>x.id===r.cases[i].anomaly);assert.equal(s.intended_access==='allow',a.safe,s.id);assert.ok(s.dialogue.arrival.length>5,s.id)});
});

test('daily shift with the allowed-pair list: each visitor brings their own anomaly, 4 allow / 4 deny, repeatable',()=>{
 const r=newRun('daily',visitors,anomalies,'2026-10-08',pairs),again=newRun('daily',visitors,anomalies,'2026-10-08',pairs),other=newRun('daily',visitors,anomalies,'2026-10-09',pairs);
 assert.deepEqual(r.cases,again.cases);assert.notDeepEqual(r.cases,other.cases);
 assert.equal(new Set(r.cases.map(c=>c.visitor)).size,8);
 for(const c of r.cases)assert.equal(c.anomaly,pairs[c.visitor]);
 assert.equal(r.cases.filter(c=>anomalies.find(a=>a.id===c.anomaly).safe).length,4);
 const legacy=newRun('daily',visitors,anomalies,'2026-10-08');assert.equal(legacy.cases.length,8,'without pairs the old random draw still works');
});

test('the six reachable endings have v1.1 ids, titles, four shots and spoken lines; E07-E30 stay unreachable',()=>{
 assert.equal(endings.length,30);
 for(const [name,id] of Object.entries(ENDING_IDS)){const e=endings.find(x=>x.id===id);assert.ok(e,id);assert.ok(e.title.length>0);assert.equal(e.cutscene.length,4,id);assert.ok(e.dialogue.length>=3,id);assert.ok(e.cutscene.every(s=>s.caption&&s.duration_sec>0))}
 assert.equal(new Set(endings.map(e=>e.cutscene.map(s=>s.caption).join('|'))).size,30,'every ending has its own captions');
 const reachable=new Set(Object.values(ENDING_IDS));for(const e of endings)if(!reachable.has(e.id))assert.match(e.machine_gate.all[0].flag,/^ending_trigger_E\d\d$/,'placeholder gate, not implemented');
 const r=newRun('story',visitors,anomalies);for(let i=0;i<8;i++){r.seen=[...TOOLS];r.verified=true;decideRun(r,anomalies.find(a=>a.id===r.cases[i].anomaly).safe,anomalies);r.index++;r.seen=[];r.verified=false;r.screen='game'}r.screen='result';
 assert.equal(ENDING_IDS[ending(r,anomalies)],'E02');
});
