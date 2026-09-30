export const VERSION='0.2.0',TOOLS=['명부','CCTV','통화'],TIMES=['00:13','00:47','01:32','02:17','02:44','03:00','04:21','05:50'];
export function kstDate(date=new Date()){const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=t=>p.find(x=>x.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`}
export function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function shuffle(n,seed){const a=Array.from({length:n},(_,i)=>i);let x=seed||1;for(let i=n-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
export function newRun(mode,visitors,anomalies,date=kstDate()){
 const seed=hash(`${VERSION}:${date}`),mix=[...shuffle(50,seed).slice(0,4),...shuffle(50,seed^0x9e3779b9).slice(0,4).map(i=>i+50)];
 const order=mode==='story'?[60,0,70,20,80,40,93,30]:shuffle(8,seed^0x74689).map(i=>mix[i]),people=mode==='story'?[0,11,24,35,46,57,62,79]:shuffle(100,seed^0x12345).slice(0,8);
 return {version:VERSION,mode,date,index:0,screen:'game',seen:[],verified:false,history:[],cases:order.map((a,i)=>({visitor:visitors[people[i]].id,anomaly:anomalies[a].id}))};
}
export function decideRun(run,allow,anomalies){if(run.screen!=='game'||run.index>=8||run.history.length!==run.index)return false;const pair=run.cases[run.index],a=anomalies.find(x=>x.id===pair.anomaly);run.history.push({...pair,allow,correct:allow===a.safe,seen:[...run.seen],verified:run.verified});run.screen='feedback';return true}
export function advance(run){if(run.screen!=='feedback')return false;run.index++;run.seen=[];run.verified=false;run.screen=run.index===8?'result':'game';return true}
export function totals(run){return {correct:run.history.filter(h=>h.correct).length,threats:run.history.filter(h=>!h.correct&&h.allow).length,denials:run.history.filter(h=>!h.correct&&!h.allow).length,investigations:run.history.reduce((n,h)=>n+h.seen.length,0)}}
export function ending(run,anomalies){const t=totals(run);if(run.history.some(h=>h.allow&&anomalies.find(a=>a.id===h.anomaly)?.category==='404 발신'))return '404호';if(t.threats>=2)return '오판';if(t.denials>=3)return '무고한 거부';if(t.correct===8&&run.history.every(h=>h.verified&&h.seen.includes(anomalies.find(a=>a.id===h.anomaly).channel)))return '신중한 경비원';return run.mode==='story'?'첫 근무의 기록':'퇴근'}
export function validRun(run,visitors,anomalies){try{
 if(!run||run.version!==VERSION||!['story','daily'].includes(run.mode)||!['game','feedback','result'].includes(run.screen)||!/^\d{4}-\d{2}-\d{2}$/.test(run.date))return false;
 if(!Number.isInteger(run.index)||run.index<0||run.index>8||!Array.isArray(run.cases)||run.cases.length!==8)return false;
 if(!Array.isArray(run.seen)||run.seen.some(t=>!TOOLS.includes(t))||new Set(run.seen).size!==run.seen.length||typeof run.verified!=='boolean'||(run.verified&&!run.seen.length))return false;
 if(run.cases.some(p=>!visitors.some(v=>v.id===p.visitor)||!anomalies.some(a=>a.id===p.anomaly)))return false;
 const length=run.screen==='feedback'?run.index+1:run.index;if(!Array.isArray(run.history)||run.history.length!==length||(run.screen==='result')!==(run.index===8))return false;
 return run.history.every((h,i)=>h.visitor===run.cases[i].visitor&&h.anomaly===run.cases[i].anomaly&&typeof h.allow==='boolean'&&h.correct===(h.allow===anomalies.find(a=>a.id===h.anomaly).safe)&&Array.isArray(h.seen)&&h.seen.every(t=>TOOLS.includes(t))&&typeof h.verified==='boolean');
 }catch{return false}}
