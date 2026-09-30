import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newRun,decideRun,advance,totals,ending,validRun,kstDate,TOOLS} from '../dist/engine.js';
const v=JSON.parse(readFileSync(new URL('../dist/data/visitors.json',import.meta.url))),a=JSON.parse(readFileSync(new URL('../dist/data/anomalies.json',import.meta.url)));
function play(choices,verify=false,mode='story'){const r=newRun('story',v,a);r.mode=mode;for(const choice of choices){if(verify){r.seen=[...TOOLS];r.verified=true}assert.ok(decideRun(r,choice,a));assert.ok(advance(r))}return r}
const correct=[true,false,true,false,true,false,true,false];
test('first shift: eight unique cases and balanced decisions',()=>{const r=newRun('story',v,a);assert.equal(new Set(r.cases.map(p=>p.anomaly)).size,8);assert.deepEqual(r.cases.map(p=>a.find(x=>x.id===p.anomaly).safe),correct);assert.ok(validRun(r,v,a))});
test('daily seed: repeatable, eight unique cases, new dates differ',()=>{const r=newRun('daily',v,a,'2026-09-29'),same=newRun('daily',v,a,'2026-09-29'),next=newRun('daily',v,a,'2026-09-30');assert.deepEqual(r,same);assert.notDeepEqual(r.cases,next.cases);assert.equal(new Set(r.cases.map(p=>p.anomaly)).size,8)});
test('Korean midnight independent of device timezone',()=>{assert.equal(kstDate(new Date('2026-09-29T14:59:59Z')),'2026-09-29');assert.equal(kstDate(new Date('2026-09-29T15:00:00Z')),'2026-09-30')});
test('double decision/next does not duplicate score or skip case',()=>{const r=newRun('story',v,a);assert.ok(decideRun(r,true,a));assert.equal(decideRun(r,true,a),false);assert.equal(r.history.length,1);assert.ok(advance(r));assert.equal(advance(r),false);assert.equal(r.index,1)});
test('all six ending branches',()=>{assert.equal(ending(play(correct,true),a),'신중한 경비원');assert.equal(ending(play(correct),a),'첫 근무의 기록');assert.equal(ending(play(correct,false,'daily'),a),'퇴근');assert.equal(ending(play(Array(8).fill(true)),a),'404호');assert.equal(ending(play(Array(8).fill(false)),a),'무고한 거부');assert.equal(ending(play([true,true,true,true,true,false,true,false]),a),'오판')});
test('all correct record remains valid at end and after serialization',()=>{const r=play(correct,true);assert.ok(validRun(JSON.parse(JSON.stringify(r)),v,a));assert.deepEqual(totals(r),{correct:8,threats:0,denials:0,investigations:24});assert.equal(advance(r),false);assert.equal(decideRun(r,false,a),false)});
test('reject corrupt or stale saved run',()=>{for(const mut of [r=>r.index=99,r=>r.version='old',r=>r.cases[0].anomaly='missing',r=>r.seen=['wrong'],r=>r.history=[{}]]){const r=newRun('story',v,a);mut(r);assert.equal(validRun(r,v,a),false)}});
