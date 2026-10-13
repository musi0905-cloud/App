// v0.16.0: emergency report kept apart from the door decision, the evidence text layer, and the fixed world rules
// (01_WORLD_BIBLE / 02_TIMELINE / v1.2 contract) checked against everything the game ships in dist/data.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {newRun,decideRun,advance,totals,ending,validRun,reportRun,reportedAt,TOOLS} from '../dist/engine.js';
import * as S from '../dist/story.js';
import {data,playTo} from './story-helpers.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const ev=read('story_evidence').evidence,slots=read('story_slots'),sv=read('story_visitors'),endings=read('story_endings');
const roundTrip=x=>JSON.parse(JSON.stringify(x));

test('emergency report: only on the decision screen, once per case, never part of totals or the ending',()=>{
 const run=newRun('story',data.visitors,data.anomalies,'2026-10-13'),twin=roundTrip(run);
 assert.equal(reportedAt(run),false);assert.ok(reportRun(run));assert.equal(reportRun(run),false,'no duplicate report');assert.ok(reportedAt(run));assert.ok(validRun(roundTrip(run),data.visitors,data.anomalies));
 for(let i=0;i<8;i++){for(const r of [run,twin]){const a=data.anomalies.find(x=>x.id===r.cases[r.index].anomaly);r.seen=[...TOOLS];r.verified=true;assert.ok(decideRun(r,a.safe,data.anomalies))}
  assert.equal(reportRun(run),false,'not on the feedback screen');for(const r of [run,twin])advance(r);if(i<7&&i%2)assert.ok(reportRun(run))}
 assert.deepEqual(totals(run),totals(twin));assert.equal(ending(run,data.anomalies),ending(twin,data.anomalies));assert.deepEqual(run.reports,[0,2,4,6]);
 assert.ok(validRun(roundTrip(run),data.visitors,data.anomalies));assert.equal(reportRun(run),false,'not on the result screen')});
test('emergency report saves: bad report lists are refused, saves without reports stay valid',()=>{const run=newRun('daily',data.visitors,data.anomalies,'2026-10-13');
 assert.ok(validRun(run,data.visitors,data.anomalies));for(const bad of [[0,0],[5],[-1],['0'],'0'])assert.equal(validRun({...run,reports:bad},data.visitors,data.anomalies),false,JSON.stringify(bad))});
test('story: each night keeps its report count next to its totals; the 30 gates do not read it',()=>{const s=playTo(1);assert.equal(s.accessHistory[0].reports,0);
 const gates=readFileSync(new URL('../dist/data/story_gates.json',import.meta.url),'utf8');assert.doesNotMatch(gates,/report|신고 횟수/)});
test('decision screen offers the report for every visitor; the procedural hint exists for the visitors whose case allows it',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/id="report"[^>]*>긴급 신고</);
 const v036=sv.find(v=>v.id==='V036');assert.equal(v036.resolution.emergency_contact_available,true);assert.equal(v036.canonical_outcome,'deny')});
test('evidence text layer: body lines from evidence_readable_20_v03; photo evidence without a photo has no invented text',()=>{
 for(const x of ev){assert.ok(Array.isArray(x.body),x.id);assert.ok(['PASS','REVISE','BLOCKED'].includes(x.text_status),x.id);if(x.text_status==='BLOCKED')assert.equal(x.body.length,0,x.id);else assert.ok(x.body.length>0,x.id)}
 assert.deepEqual(ev.filter(x=>x.text_status==='BLOCKED').map(x=>x.id),['EV04','EV05']);
 const ev06=ev.find(x=>x.id==='EV06');assert.match(ev06.era,/21:28/);assert.ok(ev06.body.some(l=>l.includes('21:28')),'era and transcribed text agree');
 const ev08=ev.find(x=>x.id==='EV08');assert.ok(ev08.body.some(l=>l.includes('21:28')))});
test('no answer before its night: evidence text never states the murder, and slot evidence is only handed out after the decision',()=>{
 for(const x of ev)for(const l of x.body)assert.doesNotMatch(l,/살해|살인|죽였/,x.id+': '+l);
 for(const s of slots.filter(s=>s.night>1))for(const id of s.story_ev_candidates)assert.ok(ev.some(e=>e.id===id),s.scene_id)});
test('world: victims never appear alive in 2026; 1997 -> 2004 -> 2006 order; Park Young-sik not declared murdered; cover-up not all residents',()=>{
 const victims=['김정우','이수연','김하은'];for(const v of sv)assert.ok(!victims.includes(v.name),v.id);for(const s of slots)assert.ok(!victims.includes(s.story_contact),s.scene_id);
 const year=id=>Number(ev.find(x=>x.id===id).era.slice(0,4));assert.ok(year('EV01')===1997&&year('EV06')===2004&&year('EV03')===2006);
 const all=readdirSync(new URL('../dist/data/',import.meta.url)).filter(f=>f.endsWith('.json')).map(f=>readFileSync(new URL('../dist/data/'+f,import.meta.url),'utf8')).join('\n');
 for(const m of all.matchAll(/"[^"]*박영식[^"]*"/g))assert.doesNotMatch(m[0],/살해|살인|죽였|타살/,m[0]);
 for(const m of all.matchAll(/"([a-z_]+)": "[^"]*(?:주민 전체|모든 주민|주민 모두)[^"]*"/g))assert.equal(m[1],'not_proves',m[0]);
 for(const x of ev)for(const l of x.body)assert.doesNotMatch(l,/귀신|유령|저주|초자연/,x.id)});
test('2004 names stay in 2004: story contacts that mention a victim are other people (colleague, relative), never the victim',()=>{
 for(const s of slots)for(const v of ['김정우','이수연','김하은'])if(s.story_contact.includes(v))assert.notEqual(s.story_contact.trim(),v,s.scene_id)});
