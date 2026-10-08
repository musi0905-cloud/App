// Shared loaders and a scripted player for the story tests (engine level, no browser).
import {readFileSync} from 'node:fs';
import {TOOLS,decideRun,advance} from '../dist/engine.js';
import * as S from '../dist/story.js';
export const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
export const plan=p=>JSON.parse(readFileSync(new URL('../../story-plan/'+p,import.meta.url)));
export const data={visitors:read('visitors'),anomalies:read('anomalies'),slots:read('story_slots'),evidence:read('story_evidence'),flow:read('story_flow')};
export const gates=read('story_gates').gates,endings=read('story_endings');
export const gateChoiceValues=new Set(gates.flatMap(g=>g.conditions.filter(c=>c.op==='choice').map(c=>c.value)));
// Default handling of a scene: the option that sets a story flag, otherwise the procedural option no gate uses.
export const defaultChoice=scene=>{const o=data.flow.choices[scene];return o?(o.find(x=>x.sets)||o.find(x=>!gateChoiceValues.has(x.value))).value:null};
// v1.3 witness_state -> runtime story state (the same field mapping CLAUDE_CODE_IMPLEMENT.md lists).
export function fromWitness(w){const s=S.newStory('2026-10-08','witness');Object.assign(s,{nightCompleted:w.night_completed,completedScenes:[...w.scenes],evidenceAcquired:[...w.evidence_acquired],evidenceVerified:[...w.evidence_verified],puzzlesSolved:[...w.puzzles],sceneChoices:{...w.choices},archiveEndingConfirmed:w.confirmed,selectedArchiveScene:w.selected_archive_scene,victimNamesPreserved:w.preserved,externalSubmission:w.submitted,finalChoice:w.final_choice,legacyEnding:w.legacy});return s}
const roundTrip=s=>JSON.parse(JSON.stringify(s));
// Plays one night through the same calls game.js makes. opts: decide(anomaly,scene)->bool, check(scene)->bool, choose(scene)->value.
// With `save` every step is serialized, validated and reloaded, like closing and reopening the app.
export function playNight(s,opts={}){const decide=opts.decide||(a=>a.safe),check=opts.check||(()=>true),choose=opts.choose||defaultChoice;let st=s;
 const reload=()=>{if(!opts.save)return;const back=roundTrip(st);if(!S.validStory(back,data))throw Error('save not valid at '+S.currentScene(st));st=back};
 if(st.phase==='INTRO'){S.beginShift(st);reload()}
 while(st.run.screen!=='result'){const r=st.run,c=r.cases[r.index],a=data.anomalies.find(x=>x.id===c.anomaly);
  if(opts.investigate!==false){r.seen=[...TOOLS];r.verified=true}
  const scene=S.currentScene(st);if(!decideRun(r,decide(a,scene),data.anomalies))throw Error('decide failed '+scene);S.recordDecision(st);reload();
  if(st.run.night>1&&check(scene)){S.independentCheck(st,data,scene);reload()}
  if(data.flow.choices[scene]){const v=choose(scene);if(v){if(!S.chooseScene(st,data,scene,v))throw Error('choice refused '+scene+' '+v);reload()}}
  advance(st.run);if(st.run.screen==='result')S.finishNight(st,data.anomalies);reload();
 }return st}
export function playTo(night,opts={}){let s=S.startStory(data,'2026-10-08');s=playNight(s,opts);while(s.nightCompleted<night){if(!S.nextNight(s,data))throw Error('nextNight refused');s=playNight(s,opts)}return s}
// Archive work between nights: cross-check everything that can be checked, then solve every ready puzzle in order.
export function archiveWork(s){let changed=true;while(changed){changed=false;for(const ev of [...s.evidenceAcquired])if(S.verifyEvidence(s,data,ev))changed=true}
 for(const p of data.evidence.puzzles)if(S.puzzleReady(s,data,p.id))S.solvePuzzle(s,data,p.id,p.order);return s}
