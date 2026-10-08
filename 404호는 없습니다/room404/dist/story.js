// Five-night story state, evidence, puzzles and the 30 ending gates (v0.14.0).
// Pure functions over one plain JSON object, so the game (game.js) and the node tests run the same code.
// Sources: story-plan/v1.2 (save/night flow, 40 slots), story-plan/v1.3 (gates, converted by scripts/convert-gates-v13.py),
// story-plan/v1.1/05 (evidence and puzzles). See docs/ENDING_VERIFICATION_REPORT.md for the decisions taken here.
import {ending,ENDING_IDS,validRun,nightRun,totals} from './engine.js';
export const STORY_KEY='404_story_v3',STORY_PREV='404_story_v3_prev',STORY_BROKEN='404_story_v3_unreadable',LEGACY_KEY='404_active_v2',LEGACY_BACKUP='404_active_v2_backup',SCHEMA=3;
export const PHASES=['INTRO','SHIFT','RECAP','FINAL','ENDED'];
export const sceneId=(night,slot)=>`N${night}_${String(slot).padStart(2,'0')}`;
const add=(list,x)=>{if(list.includes(x))return false;list.push(x);return true};
const nightOf=id=>Number(/^N(\d)_/.exec(id)?.[1]||0);

export function newStory(date,runId=null){return {schemaVersion:SCHEMA,runId:runId||'r'+Math.random().toString(36).slice(2,10),date,night:1,nightCompleted:0,phase:'SHIFT',run:null,
 completedScenes:[],sceneChecks:[],accessHistory:[],evidenceAcquired:[],evidenceVerified:[],evidenceFrom:{},puzzlesSolved:[],sceneChoices:{},
 archiveEndingConfirmed:false,selectedArchiveScene:null,victimNamesPreserved:false,externalSubmission:false,finalChoice:null,
 legacyEnding:null,endingsUnlocked:[],ending:null,migration:{fromLegacy:null}}}
export function startStory(data,date){const s=newStory(date);s.run=nightRun(1,data.slots,data.visitors,data.anomalies,date);return s}

// ---- gates --------------------------------------------------------------------------------------------------------
export function checkCondition(c,s){switch(c.op){
 case 'legacy':return s.legacyEnding===c.id;
 case 'night':return s.nightCompleted>=c.min;
 case 'scene':return s.completedScenes.includes(c.id);
 case 'evidence':return c.ids.every(i=>s.evidenceAcquired.includes(i));
 case 'verified':return c.ids.every(i=>s.evidenceVerified.includes(i));
 case 'puzzles':return c.ids.every(i=>s.puzzlesSolved.includes(i));
 case 'choice':return s.sceneChoices[c.scene]===c.value;
 case 'confirm':return s.archiveEndingConfirmed===true;
 case 'archiveScene':return s.selectedArchiveScene===c.id;
 case 'preserved':return s.victimNamesPreserved===true;
 case 'submitted':return s.externalSubmission===true;
 case 'final':return s.finalChoice===c.value;
 default:return false;// an unknown condition never passes
}}
export function evaluateGate(g,s){const missing=g.conditions.filter(c=>!checkCondition(c,s));return {id:g.id,ok:missing.length===0,missing}}
export function satisfiedGates(gates,s,types=null){return gates.filter(g=>(!types||types.includes(g.type))&&evaluateGate(g,s).ok)}
// Highest priority wins. `tied` lists every satisfied gate at that priority; more than one would be a design conflict.
export function resolveEnding(gates,s,types=null){const ok=satisfiedGates(gates,s,types);if(!ok.length)return null;const top=Math.max(...ok.map(g=>g.priority)),best=ok.filter(g=>g.priority===top);return {id:best[0].id,tied:best.map(g=>g.id),all:ok.map(g=>g.id)}}
export const ARCHIVE_TYPES=['optional_archive_resolution'],FINAL_TYPES=['final_choice','true_ending'],LEGACY_TYPES=['legacy_night1'];
export const archiveGateFor=(gates,scene)=>gates.find(g=>ARCHIVE_TYPES.includes(g.type)&&g.conditions.some(c=>c.op==='archiveScene'&&c.id===scene))||null;

// Hints name what is missing without naming an ending, a culprit or evidence the player has not found yet.
export function hintsFor(missing,s){const out=[];for(const c of missing){switch(c.op){
 case 'night':out.push(`${c.min}야간 근무를 마친 뒤에 정리할 수 있어요.`);break;
 case 'scene':out.push('이 장면의 출입 판단을 아직 마치지 않았어요.');break;
 case 'evidence':out.push('이 장면에서 받을 자료를 아직 입수하지 않았어요. ‘자료 복구’ 버튼으로 다시 받을 수 있어요.');break;
 case 'choice':out.push(s.sceneChoices[c.scene]?'이 장면에서 남긴 처리 기록으로는 이 기록을 이렇게 끝낼 수 없어요.':'이 장면의 처리 방법을 아직 고르지 않았어요.');break;
 case 'verified':{const notYet=c.ids.filter(i=>!s.evidenceAcquired.includes(i)).length,unchecked=c.ids.filter(i=>s.evidenceAcquired.includes(i)&&!s.evidenceVerified.includes(i)).length;
  if(unchecked)out.push(`입수했지만 교차 확인하지 않은 핵심 자료가 ${unchecked}건 있어요. 자료 탭에서 교차 확인하세요.`);if(notYet)out.push(`아직 입수하지 않은 핵심 자료가 ${notYet}건 있어요. 근무 기록에서 놓친 자료를 복구하세요.`);break}
 case 'puzzles':out.push(`풀지 않은 기록 대조가 ${c.ids.filter(i=>!s.puzzlesSolved.includes(i)).length}개 있어요.`);break;
 case 'preserved':out.push('피해자 이름을 보존 기록에 남기지 않았어요.');break;
 case 'submitted':out.push('외부 기관의 제출 경로를 아직 확인하지 않았어요.');break;
 case 'archiveScene':out.push('마무리할 기록을 먼저 고르세요.');break;
 case 'confirm':out.push('‘이 기록으로 마무리’를 눌러야 끝나요.');break;
 case 'legacy':case 'final':break;
}}return out}

// ---- night flow ---------------------------------------------------------------------------------------------------
const slotOf=(data,id)=>data.slots.find(x=>x.scene_id===id)||null;
export const currentScene=s=>s.run?sceneId(s.run.night||1,s.run.index+1):null;
// Called right after the engine recorded the gate decision of the current case: the scene is then complete.
export function recordDecision(s){if(s.phase!=='SHIFT'||!s.run||s.run.screen!=='feedback')return null;const id=currentScene(s);add(s.completedScenes,id);return id}
// Called when the engine run reached its result screen. Running it again changes nothing (re-entry guard).
export function finishNight(s,anomalies){const r=s.run,n=r?.night||1;if(s.phase!=='SHIFT'||!r||r.screen!=='result'||s.nightCompleted>=n)return false;
 s.nightCompleted=n;const t=totals(r);s.accessHistory.push({night:n,...t});
 if(n===1){const id=ENDING_IDS[ending(r,anomalies)];s.legacyEnding=id;add(s.endingsUnlocked,id)}
 s.phase='RECAP';return true}
export function nextNight(s,data){if(s.phase!=='RECAP'||s.nightCompleted!==s.night||s.night>=5)return false;s.night++;s.run=nightRun(s.night,data.slots,data.visitors,data.anomalies,s.date);s.phase='INTRO';s.selectedArchiveScene=null;return true}
export function beginShift(s){if(s.phase!=='INTRO')return false;s.phase='SHIFT';return true}
export function openFinal(s){if(s.phase!=='RECAP'||s.nightCompleted!==5)return false;s.phase='FINAL';return true}

// ---- evidence -----------------------------------------------------------------------------------------------------
// acquire_rule "main_case_resolved_and_independent_check_done": the gate decision must be made, then the independent
// re-check of the story contact's material gives the slot's evidence. Meeting evidence a second time from another scene
// is an independent source, so it becomes verified. `recovery` is the records-archive path for a missed check
// (miss_recovery "end_of_night_records_archive"): only after that night is over.
export function independentCheck(s,data,scene,{recovery=false}={}){const slot=slotOf(data,scene);
 if(!slot||!s.completedScenes.includes(scene)||s.sceneChecks.includes(scene))return null;
 if(recovery?s.nightCompleted<slot.night:!(s.phase==='SHIFT'&&currentScene(s)===scene&&s.run.screen==='feedback'))return null;
 add(s.sceneChecks,scene);const got={acquired:[],verified:[]};
 for(const ev of slot.story_ev_candidates){
  if(!s.evidenceAcquired.includes(ev)){s.evidenceAcquired.push(ev);s.evidenceFrom[ev]=scene;got.acquired.push(ev)}
  else if(s.evidenceFrom[ev]!==scene&&add(s.evidenceVerified,ev))got.verified.push(ev);
 }return got}
export function canVerify(s,data,ev){const e=data.evidence.evidence.find(x=>x.id===ev);if(!e||!s.evidenceAcquired.includes(ev)||s.evidenceVerified.includes(ev))return false;return e.crosscheck.some(x=>s.evidenceAcquired.includes(x))}
export function verifyEvidence(s,data,ev){if(!canVerify(s,data,ev))return false;s.evidenceVerified.push(ev);return true}
export function puzzleReady(s,data,id){const p=data.evidence.puzzles.find(x=>x.id===id);return !!p&&!s.puzzlesSolved.includes(id)&&p.inputs.every(i=>s.evidenceVerified.includes(i))&&p.requires.every(i=>s.puzzlesSolved.includes(i))}
export function solvePuzzle(s,data,id,order){const p=data.evidence.puzzles.find(x=>x.id===id);if(!puzzleReady(s,data,id))return {ok:false,reason:'locked'};
 if(!Array.isArray(order)||order.length!==p.order.length||order.some((x,i)=>x!==p.order[i]))return {ok:false,reason:'order'};s.puzzlesSolved.push(id);return {ok:true,outputs:p.outputs}}

// ---- choices, archive endings, final choice -----------------------------------------------------------------------
export function chooseScene(s,data,scene,value){const opts=data.flow.choices[scene];if(!opts||!s.completedScenes.includes(scene)||s.sceneChoices[scene])return false;
 const o=opts.find(x=>x.value===value);if(!o)return false;if(!(s.phase==='SHIFT'&&currentScene(s)===scene&&s.run.screen==='feedback'))return false;
 s.sceneChoices[scene]=value;if(o.sets==='victimNamesPreserved')s.victimNamesPreserved=true;if(o.sets==='externalSubmission')s.externalSubmission=true;return true}
export const archiveOpen=s=>s.phase!=='SHIFT'&&s.nightCompleted>=2;
export function selectArchiveScene(s,scene){const n=nightOf(scene);if(!archiveOpen(s)||n<2||n>s.nightCompleted||!s.completedScenes.includes(scene))return false;s.selectedArchiveScene=scene;return true}
// '이 기록으로 마무리': the explicit confirm is set, the archive gates are evaluated, and the flag is cleared again at once,
// so no later evaluation can end the game by itself. The main save stays as it is (v1.2: replay copy, progress kept).
export function confirmArchive(s,gates){if(!archiveOpen(s)||!s.selectedArchiveScene)return {ending:null,hints:['마무리할 기록을 먼저 고르세요.']};
 s.archiveEndingConfirmed=true;const hit=resolveEnding(gates,s,ARCHIVE_TYPES);s.archiveEndingConfirmed=false;
 if(hit){add(s.endingsUnlocked,hit.id);return {ending:hit.id,tied:hit.tied}}
 const g=archiveGateFor(gates,s.selectedArchiveScene);if(!g)return {ending:null,hints:['이 기록은 따로 마무리할 결말이 없어요. 근무를 이어 가세요.']};
 const probe={...s,archiveEndingConfirmed:true};return {ending:null,hints:hintsFor(evaluateGate(g,probe).missing,s)}}
export function submitStatus(s,gates){const g=gates.find(x=>x.type==='true_ending');const probe={...s,finalChoice:'submit_verified_evidence'};const r=evaluateGate(g,probe);return {ok:r.ok,hints:hintsFor(r.missing,s)}}
export function recoverFlag(s,flag){if(s.phase!=='FINAL'||!['victimNamesPreserved','externalSubmission'].includes(flag)||s[flag])return false;s[flag]=true;return true}
export function chooseFinal(s,gates,value){if(s.phase!=='FINAL'||s.ending)return {ending:null,hints:[]};
 if(value==='submit_verified_evidence'){const st=submitStatus(s,gates);if(!st.ok)return {ending:null,hints:st.hints}}
 s.finalChoice=value;const hit=resolveEnding(gates,s,FINAL_TYPES);if(!hit){s.finalChoice=null;return {ending:null,hints:['이 선택으로는 근무를 끝낼 수 없어요.']}}
 s.ending=hit.id;s.phase='ENDED';add(s.endingsUnlocked,hit.id);return {ending:hit.id,tied:hit.tied}}

// ---- save: validation and migration ---------------------------------------------------------------------------------
const isStrList=a=>Array.isArray(a)&&a.every(x=>typeof x==='string')&&new Set(a).size===a.length;
export function validStory(s,data){try{
 if(!s||s.schemaVersion!==SCHEMA||typeof s.runId!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!PHASES.includes(s.phase))return false;
 if(!Number.isInteger(s.night)||s.night<1||s.night>5||!Number.isInteger(s.nightCompleted)||![s.night-1,s.night].includes(s.nightCompleted))return false;
 if(!validRun(s.run,data.visitors,data.anomalies)||s.run.mode!=='story'||(s.run.night||1)!==s.night)return false;
 const scenes=new Set(data.slots.map(x=>x.scene_id)),evs=new Set(data.evidence.evidence.map(x=>x.id)),pz=new Set(data.evidence.puzzles.map(x=>x.id));
 for(const k of ['completedScenes','sceneChecks','evidenceAcquired','evidenceVerified','puzzlesSolved','endingsUnlocked'])if(!isStrList(s[k]))return false;
 if(s.completedScenes.some(x=>!scenes.has(x)||nightOf(x)>s.night)||s.sceneChecks.some(x=>!s.completedScenes.includes(x)))return false;
 if(s.evidenceAcquired.some(x=>!evs.has(x))||s.evidenceVerified.some(x=>!s.evidenceAcquired.includes(x))||s.puzzlesSolved.some(x=>!pz.has(x)))return false;
 if(!s.evidenceFrom||typeof s.evidenceFrom!=='object'||s.evidenceAcquired.some(x=>!s.completedScenes.includes(s.evidenceFrom[x])))return false;
 const here=s.completedScenes.filter(x=>nightOf(x)===s.night).length,decided=s.run.history.length;
 if(s.phase==='INTRO'?here!==0||decided!==0:here!==decided)return false;
 if(['INTRO','SHIFT'].includes(s.phase)!==(s.nightCompleted===s.night-1)||(['RECAP','FINAL','ENDED'].includes(s.phase)&&s.run.screen!=='result'))return false;
 if(['FINAL','ENDED'].includes(s.phase)&&s.nightCompleted!==5)return false;
 if(!s.sceneChoices||typeof s.sceneChoices!=='object'||Object.entries(s.sceneChoices).some(([k,v])=>!s.completedScenes.includes(k)||!data.flow.choices[k]?.some(o=>o.value===v)))return false;
 if(typeof s.archiveEndingConfirmed!=='boolean'||typeof s.victimNamesPreserved!=='boolean'||typeof s.externalSubmission!=='boolean')return false;
 if(s.selectedArchiveScene!==null&&!s.completedScenes.includes(s.selectedArchiveScene))return false;
 if(s.finalChoice!==null&&!data.flow.finals.some(o=>o.value===s.finalChoice))return false;
 if((s.ending!==null&&!/^E\d\d$/.test(s.ending))||(s.phase==='ENDED')!==(s.ending!==null))return false;
 if(s.legacyEnding!==null&&!Object.values(ENDING_IDS).includes(s.legacyEnding))return false;
 return Array.isArray(s.accessHistory)&&s.accessHistory.length===s.nightCompleted;
}catch{return false}}
// An old (v0.13.0 and earlier) first-shift save in 404_active_v2 becomes night 1 of a story. The old key is only read.
// Daily runs are not story progress and stay where they are. Anything that does not validate is not converted.
export function migrateLegacy(old,data){if(!validRun(old,data.visitors,data.anomalies)||old.mode!=='story'||old.night!==undefined)return null;
 const s=newStory(old.date);s.run={...JSON.parse(JSON.stringify(old)),night:1};
 for(let i=1;i<=old.history.length;i++)s.completedScenes.push(sceneId(1,i));
 s.migration.fromLegacy={key:LEGACY_KEY,date:old.date,index:old.index,screen:old.screen,decided:old.history.length};
 if(old.screen==='result')finishNight(s,data.anomalies);return s}
