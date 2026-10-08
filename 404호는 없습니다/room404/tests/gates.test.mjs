// E01-E30 gate tests (v0.14.0). Fixture: story-plan/v1.3/simulation_witnesses_30.json.
import test from 'node:test';import assert from 'node:assert/strict';
import * as S from '../dist/story.js';
import {newRun,decideRun,advance,ending,ENDING_IDS,TOOLS,nightRun} from '../dist/engine.js';
import {data,gates,endings,plan,fromWitness,playTo,playNight,archiveWork,defaultChoice} from './story-helpers.mjs';
const witnesses=plan('v1.3/simulation_witnesses_30.json'),design=plan('v1.3/ending_gates_30_simulated.json');
const gate=id=>gates.find(g=>g.id===id);

test('runtime gates are a one-to-one conversion of the v1.3 design file',()=>{
 assert.equal(gates.length,30);
 for(const d of design){const g=gate(d.id),r=d.requires,ops=g.conditions.map(c=>c.op);
  assert.equal(g.title,d.title);assert.equal(g.priority,d.priority);assert.equal(g.terminal,d.terminal);assert.equal(g.type,d.type);assert.equal(g.cutscene,d.cutscene_ref);
  const expected=[['legacy_engine_result','legacy'],['min_night_completed','night'],['scene_completed','scene'],['evidence_acquired','evidence'],['verified_evidence_all','verified'],['puzzles_all','puzzles'],['victim_names_preserved','preserved'],['external_submission','submitted'],['explicit_confirm_ending','confirm'],['selected_archive_scene','archiveScene'],['final_choice','final']].filter(([k])=>k in r).map(([,op])=>op);
  for(const _ of Object.keys(r.choice_equals||{}))expected.push('choice');
  assert.deepEqual([...ops].sort(),expected.sort(),d.id);
 }
});

test('30 positive witnesses: each reaches exactly its own ending',()=>{
 for(const w of witnesses){const s=fromWitness(w.witness_state),r=S.resolveEnding(gates,s);assert.ok(r,w.id);assert.equal(r.id,w.id,w.id);assert.deepEqual(r.tied,[w.id],w.id);assert.ok(S.evaluateGate(gate(w.id),s).ok)}
});

// Break exactly one requirement at a time; the ending must not fire. List requirements are broken item by item.
function mutations(g,base){const out=[];for(const c of g.conditions){const m=(label,f)=>{const s=structuredClone(base);f(s);out.push([`${g.id} ${label}`,s])};switch(c.op){
 case 'legacy':m('legacy other',s=>{s.legacyEnding=c.id==='E01'?'E02':'E01'});break;
 case 'night':m('night-1',s=>{s.nightCompleted=c.min-1});break;
 case 'scene':m('scene missing',s=>{s.completedScenes=s.completedScenes.filter(x=>x!==c.id)});break;
 case 'evidence':for(const ev of c.ids)m('no '+ev,s=>{s.evidenceAcquired=s.evidenceAcquired.filter(x=>x!==ev);s.evidenceVerified=s.evidenceVerified.filter(x=>x!==ev)});break;
 case 'verified':for(const ev of c.ids)m('unverified '+ev,s=>{s.evidenceVerified=s.evidenceVerified.filter(x=>x!==ev)});break;
 case 'puzzles':for(const p of c.ids)m('unsolved '+p,s=>{s.puzzlesSolved=s.puzzlesSolved.filter(x=>x!==p)});break;
 case 'choice':m('other choice',s=>{s.sceneChoices[c.scene]=data.flow.choices[c.scene].find(o=>o.value!==c.value).value});m('no choice',s=>{delete s.sceneChoices[c.scene]});break;
 case 'confirm':m('not confirmed',s=>{s.archiveEndingConfirmed=false});break;
 case 'archiveScene':m('other record',s=>{s.selectedArchiveScene='N4_08'});m('no record',s=>{s.selectedArchiveScene=null});break;
 case 'preserved':m('names not preserved',s=>{s.victimNamesPreserved=false});break;
 case 'submitted':m('not submitted',s=>{s.externalSubmission=false});break;
 case 'final':for(const o of data.flow.finals.filter(o=>o.value!==c.value))m('final '+o.value,s=>{s.finalChoice=o.value});m('no final',s=>{s.finalChoice=null});break;
 default:throw Error('untested op '+c.op);
}}return out}
test('negative mutations: removing any single requirement blocks the ending (every field covered)',()=>{let n=0;const ops=new Set();
 for(const w of witnesses){const g=gate(w.id),base=fromWitness(w.witness_state);for(const c of g.conditions)ops.add(c.op);
  for(const [label,s] of mutations(g,base)){n++;assert.equal(S.evaluateGate(g,s).ok,false,label);assert.notEqual(S.resolveEnding(gates,s)?.id,w.id,label)}}
 assert.deepEqual([...ops].sort(),['archiveScene','choice','confirm','evidence','final','legacy','night','preserved','puzzles','scene','submitted','verified']);
 assert.ok(n>=144,`mutation count ${n} (v1.3 report: 144)`);console.log(`# mutations ${n}`);
});

test('conflicts: 20,000 random states never satisfy two gates at the top priority; types are mutually exclusive',()=>{
 let x=0x404;const rnd=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296},pick=a=>a[Math.floor(rnd()*a.length)],some=a=>a.filter(()=>rnd()<.5);
 const scenes=data.slots.map(s=>s.scene_id),evs=data.evidence.evidence.map(e=>e.id),pz=data.evidence.puzzles.map(p=>p.id);let multi=0;
 for(let i=0;i<20000;i++){const s=S.newStory('2026-10-08','rand');const acq=some(evs);
  Object.assign(s,{nightCompleted:Math.floor(rnd()*6),completedScenes:some(scenes),evidenceAcquired:acq,evidenceVerified:some(acq),puzzlesSolved:some(pz),archiveEndingConfirmed:rnd()<.5,selectedArchiveScene:rnd()<.8?pick(scenes):null,victimNamesPreserved:rnd()<.5,externalSubmission:rnd()<.5,finalChoice:rnd()<.6?pick(data.flow.finals).value:null,legacyEnding:rnd()<.5?pick(Object.values(ENDING_IDS)):null});
  for(const sc of scenes)if(data.flow.choices[sc]&&rnd()<.6)s.sceneChoices[sc]=pick(data.flow.choices[sc]).value;
  const r=S.resolveEnding(gates,s);if(!r)continue;assert.equal(r.tied.length,1,JSON.stringify(r));if(r.all.length>1)multi++;
  for(const t of [S.ARCHIVE_TYPES,S.FINAL_TYPES,S.LEGACY_TYPES])assert.ok(S.satisfiedGates(gates,s,t).length<=1,'two gates of one kind');
 }
 assert.ok(multi>0,'states that satisfy gates of different kinds exist and are settled by priority');console.log(`# random states with gates of different kinds settled by priority: ${multi}`);
});

test('real path: every one of E07-E27 is reached by playing the nights and confirming the archive record',()=>{
 for(const g of gates.filter(g=>g.type==='optional_archive_resolution')){const ch=g.conditions.find(c=>c.op==='choice'),min=g.conditions.find(c=>c.op==='night').min;
  const s=playTo(min,{choose:sc=>sc===ch.scene?ch.value:defaultChoice(sc)});
  const before=JSON.stringify({n:s.night,c:s.completedScenes,e:s.evidenceAcquired});
  assert.ok(S.selectArchiveScene(s,ch.scene),g.id);const r=S.confirmArchive(s,gates);
  assert.equal(r.ending,g.id,g.id);assert.equal(s.archiveEndingConfirmed,false,'confirm flag is cleared right after the decision');
  assert.equal(JSON.stringify({n:s.night,c:s.completedScenes,e:s.evidenceAcquired}),before,'main progress is kept');
  if(s.night<5){assert.ok(S.nextNight(s,data),'free progress continues after an archive ending')}
 }
});

test('real path: E28, E29 and E30 after five nights; E01-E06 from the night-1 engine result',()=>{
 for(const [value,id] of [['seal_archive','E28'],['resign','E29']]){const s=playTo(5);assert.ok(S.openFinal(s));assert.equal(S.chooseFinal(s,gates,value).ending,id);assert.equal(s.phase,'ENDED')}
 const s=playTo(5);archiveWork(s);assert.ok(S.openFinal(s));assert.ok(S.submitStatus(s,gates).ok,JSON.stringify(S.submitStatus(s,gates)));
 assert.deepEqual([...s.puzzlesSolved],['PZ01','PZ02','PZ03','PZ04','PZ05']);assert.equal(S.chooseFinal(s,gates,'submit_verified_evidence').ending,'E30');
 const legacy=(choices,inv,mode='story')=>{let st=S.startStory(data,'2026-10-08');st.run.mode=mode;let i=0;st=playNight(st,{decide:()=>choices[i++],investigate:inv});return st};
 const ok=[true,false,true,false,true,false,true,false];
 assert.equal(legacy(ok,true).legacyEnding,'E02');assert.equal(legacy(ok,false).legacyEnding,'E06');assert.equal(legacy(Array(8).fill(true),false).legacyEnding,'E05');
 assert.equal(legacy(Array(8).fill(false),false).legacyEnding,'E04');assert.equal(legacy([true,true,true,true,true,false,true,false],false).legacyEnding,'E03');
 const daily=newRun('story',data.visitors,data.anomalies);daily.mode='daily';for(const c of daily.cases){decideRun(daily,data.anomalies.find(a=>a.id===c.anomaly).safe,data.anomalies);advance(daily)}
 assert.equal(ENDING_IDS[ending(daily,data.anomalies)],'E01','E01 stays the daily-shift ending');
 for(const id of ['E02','E06'])assert.equal(S.resolveEnding(gates,{...S.newStory('2026-10-08'),legacyEnding:id,nightCompleted:1},S.LEGACY_TYPES).id,id);
 const n1=S.startStory(data,'2026-10-08');const night1=playNight(n1,{decide:()=>true,investigate:false});assert.equal(night1.legacyEnding,'E05');assert.ok(S.nextNight(night1,data),'a terminal night-1 ending does not lock night 2 (v1.2 rule)');
});

test('blocking: missing requirements stop the ending and say what is missing without spoilers',()=>{
 // E07 with every independent check that yields EV02 skipped (N2_01, N2_04, N2_08): blocked, then recovered from the archive.
 const skip=new Set(['N2_01','N2_04','N2_08']);const s=playTo(2,{check:sc=>!skip.has(sc),choose:sc=>sc==='N2_01'?'accept_unverified_replacement':defaultChoice(sc)});
 assert.equal(s.evidenceAcquired.includes('EV02'),false);
 S.selectArchiveScene(s,'N2_01');let r=S.confirmArchive(s,gates);assert.equal(r.ending,null);assert.match(r.hints.join(' '),/자료를 아직 입수하지/);assert.equal(s.archiveEndingConfirmed,false);
 assert.ok(S.independentCheck(s,data,'N2_01',{recovery:true}),'archive recovery of a missed check');assert.equal(S.independentCheck(s,data,'N2_01',{recovery:true}),null,'only once');
 r=S.confirmArchive(s,gates);assert.equal(r.ending,'E07');
 // Other handling choice: blocked with a choice hint. The hint never names an ending.
 const t=playTo(2);S.selectArchiveScene(t,'N2_01');r=S.confirmArchive(t,gates);assert.equal(r.ending,null);assert.match(r.hints.join(' '),/처리 기록/);
 for(const h of r.hints)assert.doesNotMatch(h,/E\d\d|가짜 교대자|강태준|살해|살인/);
 // Before night 2 is over the archive cannot finish anything; during a shift neither.
 const u=playTo(1);assert.equal(S.selectArchiveScene(u,'N2_01'),false);assert.equal(S.confirmArchive(u,gates).ending,null);
 const v=playTo(2);S.nextNight(v,data);S.beginShift(v);assert.equal(S.archiveOpen(v),false);
 // A record without an archive ending.
 const w=playTo(2);S.selectArchiveScene(w,'N2_08');assert.match(S.confirmArchive(w,gates).hints[0],/따로 마무리할 결말이 없어요/);
 // E30: submit is refused while evidence is unverified; hints count what is missing; seal still works.
 const x=playTo(5);S.openFinal(x);const st=S.submitStatus(x,gates);assert.equal(st.ok,false);assert.match(st.hints.join(' '),/교차 확인하지 않은 핵심 자료/);assert.match(st.hints.join(' '),/기록 대조/);
 assert.equal(S.chooseFinal(x,gates,'submit_verified_evidence').ending,null);assert.equal(x.finalChoice,null);assert.equal(x.phase,'FINAL');
 // E30 without the names choice: recovered on the final board, then allowed.
 const y=playTo(5,{choose:sc=>sc==='N5_07'?'withhold_names':defaultChoice(sc)});archiveWork(y);S.openFinal(y);assert.match(S.submitStatus(y,gates).hints.join(' '),/피해자 이름/);
 assert.ok(S.recoverFlag(y,'victimNamesPreserved'));assert.equal(S.chooseFinal(y,gates,'submit_verified_evidence').ending,'E30');
 // Evidence found is not evidence verified; a puzzle needs verified inputs and the right order.
 const z=playTo(2);assert.equal(S.puzzleReady(z,data,'PZ01'),false);assert.equal(S.solvePuzzle(z,data,'PZ01',['EV01','EV03','EV02']).reason,'locked');
});

test('puzzles: wrong order is a retry, not a failure; PZ05 needs PZ01-04',()=>{
 const s=playTo(2);for(const ev of [...s.evidenceAcquired])S.verifyEvidence(s,data,ev);
 assert.ok(S.puzzleReady(s,data,'PZ01'));assert.equal(S.solvePuzzle(s,data,'PZ01',['EV02','EV03','EV01']).reason,'order');assert.ok(S.puzzleReady(s,data,'PZ01'));
 assert.ok(S.solvePuzzle(s,data,'PZ01',['EV01','EV03','EV02']).ok);assert.equal(S.puzzleReady(s,data,'PZ05'),false);
 const ev=Object.fromEntries(data.evidence.evidence.map(e=>[e.id,e]));
 for(const p of data.evidence.puzzles){const eras=p.order.map(i=>ev[i].era);assert.deepEqual([...eras].sort(),eras,p.id+' order follows the dates shown');assert.ok(p.inputs.every(i=>ev[i].crosscheck.length>0))}
});

test('save and restart keep every condition: every step serialized and reloaded through five nights to E30',()=>{
 const s=playTo(5,{save:true});archiveWork(s);S.openFinal(s);const back=JSON.parse(JSON.stringify(s));assert.ok(S.validStory(back,data));
 assert.deepEqual(S.submitStatus(back,gates),S.submitStatus(s,gates));assert.equal(S.chooseFinal(back,gates,'submit_verified_evidence').ending,'E30');
 const again=JSON.parse(JSON.stringify(back));assert.ok(S.validStory(again,data));assert.equal(again.ending,'E30');assert.equal(again.phase,'ENDED');
 const mid=playTo(3,{choose:sc=>sc==='N3_03'?'contact_emergency_services':defaultChoice(sc),save:true});const re=JSON.parse(JSON.stringify(mid));S.selectArchiveScene(re,'N3_03');assert.equal(S.confirmArchive(re,gates).ending,'E16');
});

test('save validation and legacy migration from 404_active_v2',()=>{
 const old=newRun('story',data.visitors,data.anomalies,'2026-10-07');old.seen=['CCTV'];decideRun(old,true,data.anomalies);advance(old);decideRun(old,false,data.anomalies);old.seen=['명부'];
 const m=S.migrateLegacy(JSON.parse(JSON.stringify(old)),data);assert.ok(m);assert.ok(S.validStory(m,data));assert.deepEqual(m.completedScenes,['N1_01','N1_02']);assert.equal(m.run.screen,'feedback');assert.deepEqual(m.run.seen,['명부'],'open evidence of the current visitor is kept');assert.equal(m.migration.fromLegacy.decided,2);
 const done=newRun('story',data.visitors,data.anomalies,'2026-10-07');for(const c of done.cases){decideRun(done,data.anomalies.find(a=>a.id===c.anomaly).safe,data.anomalies);advance(done)}
 const md=S.migrateLegacy(done,data);assert.equal(md.nightCompleted,1);assert.equal(md.legacyEnding,'E06');assert.equal(md.phase,'RECAP');assert.ok(S.nextNight(md,data));assert.ok(S.validStory(md,data));
 assert.equal(S.migrateLegacy({version:'broken'},data),null);const daily=newRun('daily',data.visitors,data.anomalies,'2026-10-07');assert.equal(S.migrateLegacy(daily,data),null,'daily runs are not story progress');
 for(const mut of [s=>s.schemaVersion=2,s=>s.night=9,s=>s.evidenceVerified.push('EV99'),s=>s.completedScenes.push('N5_08'),s=>s.phase='WAT',s=>s.sceneChoices.N2_01='nope',s=>s.run.night=3,s=>s.accessHistory=[],s=>s.evidenceVerified.push('EV10'),s=>s.evidenceVerified.push(s.evidenceVerified[0]||'EV02')]){const s=playTo(2);mut(s);assert.equal(S.validStory(s,data),false,String(mut))}
});

test('night flow: 40 real visitor ids, fixed clocks, no double application on re-entry',()=>{
 assert.deepEqual(data.slots,plan('v1.2/night_slots_40_explicit.json'),'runtime slots are the untouched v1.2 file');
 const ids=data.slots.map(s=>s.gate_visitor_id);assert.equal(new Set(ids).size,40);
 const n1=nightRun(1,data.slots,data.visitors,data.anomalies,'2026-10-08'),fixed=newRun('story',data.visitors,data.anomalies,'2026-10-08');assert.deepEqual(n1.cases,fixed.cases,'N1 stays the frozen first shift');
 assert.deepEqual(data.slots.filter(s=>s.night===1).map(s=>[s.gate_visitor_id,s.anomaly_id]),fixed.cases.map(c=>[c.visitor,c.anomaly]));
 for(let n=2;n<=5;n++){const r=nightRun(n,data.slots,data.visitors,data.anomalies,'2026-10-08'),rows=data.slots.filter(s=>s.night===n);assert.deepEqual(r.times,rows.map(s=>s.time));
  for(const [i,c] of r.cases.entries()){assert.equal(data.anomalies.find(a=>a.id===c.anomaly).safe,rows[i].gate_outcome==='allow',rows[i].scene_id);assert.ok(rows[i].story_contact_is_distinct_from_visitor)}}
 const s=playTo(2);assert.equal(S.finishNight(s,data.anomalies),false);assert.equal(s.accessHistory.length,2);assert.ok(S.nextNight(s,data));assert.equal(S.nextNight(s,data),false,'second press does nothing');
 assert.equal(S.independentCheck(s,data,'N2_01'),null,'a past scene cannot be re-checked mid-shift');
 const all=playTo(5);assert.equal(all.completedScenes.length,40);assert.equal(all.accessHistory.length,5);assert.ok(['EV01','EV06','EV09','EV10','EV13','EV15','EV16','EV17'].every(e=>all.evidenceAcquired.includes(e)));
 assert.equal(Object.keys(all.sceneChoices).length,Object.keys(data.flow.choices).length);
});

test('every gate links a cutscene with four shots and three spoken lines',()=>{
 for(const g of gates){const e=endings.find(x=>x.id===g.cutscene);assert.ok(e,g.id);assert.equal(e.cutscene.length,4,g.id);assert.ok(e.dialogue.length>=3,g.id);assert.ok(e.ending_text.length>10,g.id);assert.ok(e.cutscene.every(c=>c.caption&&c.duration_sec>0&&c.setting))}
});
