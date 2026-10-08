export const VERSION='0.2.0',TOOLS=['명부','CCTV','통화'],TIMES=['00:13','00:47','01:32','02:17','02:44','03:00','04:21','05:50'];
export function kstDate(date=new Date()){const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=t=>p.find(x=>x.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`}
export function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function shuffle(n,seed){const a=Array.from({length:n},(_,i)=>i);let x=seed||1;for(let i=n-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
// Story v1.1 ending ids for the six endings this engine decides (night 1 / daily). E07-E30 are decided by story.js gates.
export const ENDING_IDS={'퇴근':'E01','신중한 경비원':'E02','오판':'E03','무고한 거부':'E04','404호':'E05','첫 근무의 기록':'E06'};
// `pairs` (visitor id -> anomaly id, from story_visitors.json) is the allowed-combination list: a daily shift then
// draws 8 visitors, each with their own pinned anomaly (4 to allow, 4 to deny), instead of random visitor x anomaly.
// The first shift (story) is the fixed night-1 list V001/A061 … V080/A031, which the v1.1 story pins the same way.
export function newRun(mode,visitors,anomalies,date=kstDate(),pairs=null){
 const seed=hash(`${VERSION}:${date}`);let order,people;
 if(mode==='story'){order=[60,0,70,20,80,40,93,30];people=[0,11,24,35,46,57,62,79]}
 else if(pairs){
  const picked=[],want={true:4,false:4};
  for(const i of shuffle(visitors.length,seed^0x12345)){const k=anomalies.findIndex(a=>a.id===pairs[visitors[i].id]);if(k<0)continue;const safe=anomalies[k].safe;if(!want[safe])continue;want[safe]--;picked.push([i,k]);if(picked.length===8)break}
  if(picked.length===8){const seq=shuffle(8,seed^0x74689);people=seq.map(j=>picked[j][0]);order=seq.map(j=>picked[j][1])}
 }
 if(!order){const mix=[...shuffle(50,seed).slice(0,4),...shuffle(50,seed^0x9e3779b9).slice(0,4).map(i=>i+50)];order=shuffle(8,seed^0x74689).map(i=>mix[i]);people=shuffle(100,seed^0x12345).slice(0,8)}
 return {version:VERSION,mode,date,index:0,screen:'game',seen:[],verified:false,history:[],cases:order.map((a,i)=>({visitor:visitors[people[i]].id,anomaly:anomalies[a].id}))};
}
// Story nights 2-5 (v0.14.0): the eight gate cases and their clock come from story_slots.json (v1.2 night_slots_40_explicit).
// Night 1 stays the fixed first shift above, so old saves and the six original endings are unchanged.
export function timesOf(run){return Array.isArray(run?.times)&&run.times.length===8?run.times:TIMES}
export function nightRun(night,slots,visitors,anomalies,date=kstDate()){
 if(night===1){const r=newRun('story',visitors,anomalies,date);r.night=1;return r}
 const rows=slots.filter(s=>s.night===night).sort((a,b)=>a.slot-b.slot);
 if(!Number.isInteger(night)||night<2||night>5||rows.length!==8)throw Error(`night ${night}: ${rows.length} slots`);
 for(const s of rows)if(!visitors.some(v=>v.id===s.gate_visitor_id)||!anomalies.some(a=>a.id===s.anomaly_id))throw Error('unknown visitor or anomaly in '+s.scene_id);
 return {version:VERSION,mode:'story',night,date,index:0,screen:'game',seen:[],verified:false,history:[],cases:rows.map(s=>({visitor:s.gate_visitor_id,anomaly:s.anomaly_id})),times:rows.map(s=>s.time)};
}
export function decideRun(run,allow,anomalies){if(run.screen!=='game'||run.index>=8||run.history.length!==run.index)return false;const pair=run.cases[run.index],a=anomalies.find(x=>x.id===pair.anomaly);run.history.push({...pair,allow,correct:allow===a.safe,seen:[...run.seen],verified:run.verified});run.screen='feedback';return true}
export function advance(run){if(run.screen!=='feedback')return false;run.index++;run.seen=[];run.verified=false;run.screen=run.index===8?'result':'game';return true}
export function totals(run){return {correct:run.history.filter(h=>h.correct).length,threats:run.history.filter(h=>!h.correct&&h.allow).length,denials:run.history.filter(h=>!h.correct&&!h.allow).length,investigations:run.history.reduce((n,h)=>n+h.seen.length,0)}}
export function ending(run,anomalies){const t=totals(run);if(run.history.some(h=>h.allow&&anomalies.find(a=>a.id===h.anomaly)?.category==='404 발신'))return '404호';if(t.threats>=2)return '오판';if(t.denials>=3)return '무고한 거부';if(t.correct===8&&run.history.every(h=>h.verified&&h.seen.includes(anomalies.find(a=>a.id===h.anomaly).channel)))return '신중한 경비원';return run.mode==='story'?'첫 근무의 기록':'퇴근'}
export function validRun(run,visitors,anomalies){try{
 if(!run||run.version!==VERSION||!['story','daily'].includes(run.mode)||!['game','feedback','result'].includes(run.screen)||!/^\d{4}-\d{2}-\d{2}$/.test(run.date))return false;
 if(run.night!==undefined&&(run.mode!=='story'||!Number.isInteger(run.night)||run.night<1||run.night>5))return false;
 if(run.times!==undefined&&(!Array.isArray(run.times)||run.times.length!==8||run.times.some(t=>!/^\d{2}:\d{2}$/.test(t))))return false;
 if(!Number.isInteger(run.index)||run.index<0||run.index>8||!Array.isArray(run.cases)||run.cases.length!==8)return false;
 if(!Array.isArray(run.seen)||run.seen.some(t=>!TOOLS.includes(t))||new Set(run.seen).size!==run.seen.length||typeof run.verified!=='boolean'||(run.verified&&!run.seen.length))return false;
 if(run.cases.some(p=>!visitors.some(v=>v.id===p.visitor)||!anomalies.some(a=>a.id===p.anomaly)))return false;
 const length=run.screen==='feedback'?run.index+1:run.index;if(!Array.isArray(run.history)||run.history.length!==length||(run.screen==='result')!==(run.index===8))return false;
 return run.history.every((h,i)=>h.visitor===run.cases[i].visitor&&h.anomaly===run.cases[i].anomaly&&typeof h.allow==='boolean'&&h.correct===(h.allow===anomalies.find(a=>a.id===h.anomaly).safe)&&Array.isArray(h.seen)&&h.seen.every(t=>TOOLS.includes(t))&&typeof h.verified==='boolean');
 }catch{return false}}
