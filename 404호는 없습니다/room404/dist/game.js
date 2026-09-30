import {mountReplay,shiftedTime,sceneTime,LOCATIONS} from './replay.js';
import {VERSION,TOOLS,TIMES,newRun,decideRun,advance,totals,ending,validRun} from './engine.js';
const TOOL_NAMES={CCTV:'CCTV 보기',명부:'주민·방문 기록',통화:'집에 전화하기',재확인:'한 번 더 확인'};
const $=id=>document.getElementById(id),ACTIVE='404_active_v2',LAST='404_last_run';
let scenarios=[],visitors=[],anomalies=[],run=null,ready=false,deferredInstall=null,activeTool=null,toolOrigin=null,cameraPast=false,replayCleanup=null,replayGeneration=0; 
function clearReplay(){replayGeneration++;if(replayCleanup){replayCleanup();replayCleanup=null}}
function show(screen){if(screen!=='investigation')clearReplay();['home','game','investigation','feedback','result'].forEach(id=>$(id).hidden=id!==screen);window.scrollTo(0,0)}
function storageGet(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function save(){try{localStorage.setItem(ACTIVE,JSON.stringify(run))}catch{$('storageNotice').hidden=false}}
function current(){const p=run.cases[run.index],original=visitors.find(v=>v.id===p.visitor),a=anomalies.find(a=>a.id===p.anomaly),pack=scenarios.find(s=>s.id===a.id);const v={...original,unit:pack.unitOverride||original.unit,role:pack.role};v.claim=fill(pack.claim,v);return {v,a,pack}}
function fill(s,v){return String(s).replaceAll('{name}',v.name).replaceAll('{unit}',v.unit)}
function sourceTime(minutes=0){return shiftedTime(TIMES[run.index],minutes)}
function log(title,text){const p=document.createElement('p'),b=document.createElement('strong');b.textContent=title+' — ';p.append(b,document.createTextNode(text));$('evidence').append(p)}
function person(v,extra=''){const index=(Number(v.id.slice(1))-1)%4;return `<span role="img" aria-label="${escapeHTML(v.name)}의 방문객 캐릭터" class="person-sprite ${extra}" style="background-position:${index*100/3}% 50%"></span>`}
function clockBefore(minutes){const [h,m]=TIMES[run.index].split(':').map(Number),n=(h*60+m-minutes+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function guide(){const {v,a,pack}=current();const older=pack.scenes.find(s=>s.offset<0);return {clue:pack.plain.what,verify:pack.plain.confirmed,question:pack.plain.check,...(older&&a.channel==='CCTV'?{past:`${sourceTime(older.offset)} · ${older.note}`}:{})}}
function timeline(){const {v,a}=current(),g=guide(),items=[];
 if(g.past&&run.seen.includes(a.channel))items.push(['이전 기록',g.past]);
 items.push([`${TIMES[run.index]} · 방문객 도착`,`${v.name}: “${v.claim}” (${v.unit}호에 간다고 해요)`]);
 for(const [i,t] of ['CCTV','명부','통화'].entries())items.push([`확인 ${i+1} · ${TOOL_NAMES[t]}`,run.seen.includes(t)?clueFor(t):'아직 확인하지 않았습니다.']);
 items.push(['마지막 · 한 번 더 확인',run.verified?g.verify:'다른 카메라를 보거나, 관리실에 적힌 번호로 전화해 다시 물어봐요.']);
 return '<ol class="case-timeline">'+items.map(([t,s])=>`<li><strong>${escapeHTML(t)}</strong><p>${escapeHTML(s)}</p></li>`).join('')+'</ol>';
}
function evidence(){
 $('evidence').innerHTML='<h3>사건을 순서대로 보기</h3>'+timeline();
 const next=['CCTV','명부','통화'].find(t=>!run.seen.includes(t));
 $('routine').textContent=next?`다음 할 일: ${TOOL_NAMES[next]}` : !run.verified?'다음 할 일: 한 번 더 확인':'확인을 마쳤어요. 이 사람을 들여보낼지 결정하세요.';
 $('guidedAction').textContent=next?TOOL_NAMES[next]:!run.verified?'한 번 더 확인하기':'확인한 내용 다시 보기';
 $('guidedAction').onclick=()=>next?inspect(next):!run.verified?verify():$('evidence').scrollIntoView({behavior:'smooth'});
 document.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=false;b.classList.toggle('seen',run.seen.includes(b.dataset.tool));b.setAttribute('aria-label',b.dataset.tool+(run.seen.includes(b.dataset.tool)?' · 다시 보기':''))});$('verify').disabled=!run.seen.length;
}
function render(){if(!run)return;$('shiftLabel').textContent=run.mode==='daily'?'오늘의 근무 · '+run.date:'첫 근무';
 if(run.screen==='game'){
  const {v}=current(),t=totals(run);$('clock').textContent=TIMES[run.index];$('progress').textContent=String(run.index+1).padStart(2,'0')+' / 08';
  $('mistakes').textContent='틀린 판단 '+(t.threats+t.denials);$('portrait').innerHTML=person(v);$('identity').textContent=`${v.role} · ${v.name} · ${v.unit}호 방문`;$('claim').textContent='“'+v.claim+'”';evidence();
 }else if(run.screen==='feedback'){
  const {v,a}=current(),h=run.history.at(-1);$('clock').textContent=TIMES[run.index];$('feedbackTitle').textContent=h.correct?'판단이 맞았습니다':'다시 생각해 보세요';
  $('feedbackText').textContent=`${v.name} · ${v.unit}호: ${a.safe?'들여보내도 되는 사람이었어요.':'문을 열어 주면 안 되는 사람이었어요.'} ${guide().clue}`;$('reason').textContent=guide().verify;$('next').textContent=run.index===7?'근무 결과 보기':'다음 방문객';
 }else{
  const t=totals(run),end=ending(run,anomalies);$('clock').textContent='06:00';$('ending').textContent=end;$('summary').textContent=end==='신중한 경비원'?'모든 방문객의 기록을 보고, 다른 자료로 한 번 더 확인했어요.':'오늘의 선택은 기록으로 남았습니다.';
  $('stats').textContent=`처리 8건 · 정답 ${t.correct}건 · 위험 허용 ${t.threats}건 · 정상 거부 ${t.denials}건 · 조사 ${t.investigations}회`;
  try{localStorage.setItem(LAST,JSON.stringify({date:run.date,mode:run.mode,ending:end,correct:t.correct,history:run.history}))}catch{$('storageNotice').hidden=false}
 }show(run.screen);
}
function home(){show('home');$('clock').textContent='00:00';$('resume').hidden=!run;$('resume').textContent=run?.screen==='result'?'지난 결과 보기':'이어서 근무';const prev=storageGet(LAST);$('record').textContent=prev&&typeof prev.ending==='string'?`지난 근무: ${prev.ending} · ${prev.correct}/8`:''}
function start(mode){if(!ready)return;run=newRun(mode,visitors,anomalies);save();render()}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clueFor(tool){const {v,a,pack}=current();if(tool===a.channel)return pack.plain.what;if(tool==='명부')return `관리실 기록에서 ${v.name} 님의 ${v.unit}호 방문을 찾았어요. 들어와도 되는지는 그 집에 한 번 더 물어봐야 해요.`;if(tool==='통화')return `${fill(pack.call.line,v)} ${pack.call.detail}`;return `${sourceTime(-1)}에 현관으로 왔고, ${TIMES[run.index]}에 문을 열어 달라고 했어요. ${a.channel==='명부'?'가져온 종이와 관리실 기록':'그 집에 전화한 내용'}도 확인하세요.`}
function inspected(){return activeTool==='재확인'?run.verified:run.seen.includes(activeTool)}
function inspect(tool){if(!run||run.screen!=='game'||!TOOLS.includes(tool))return;activeTool=tool;toolOrigin=tool;cameraPast=false;renderTool()}
function verify(){if(!run||run.screen!=='game'||!run.seen.length)return;activeTool='재확인';toolOrigin='재확인';renderTool()}
function backDesk(){activeTool=null;render();const b=toolOrigin==='재확인'?$('verify'):document.querySelector(`[data-tool="${toolOrigin}"]`);b?.focus()}
function documentView(v,pack,done){const d=pack.document,e=escapeHTML;
 return `<article class="register"><div class="paper-heading"><span>${pack.recordCode} · ${run.date}</span><strong>${e(d.source)}</strong><span>기록을 확인한 시간 ${sourceTime(1)}</span></div><table><caption>방문객 도착 · ${TIMES[run.index]}</caption><tbody><tr><th>이름</th><td>${e(v.name)}</td></tr><tr><th>가려는 집</th><td>${e(v.unit)}호</td></tr><tr><th>방문 구분</th><td>${e(v.role)}</td></tr></tbody></table>${done?`<div class="record-pair"><section><h3>① 이 사람이 말하거나 보여 준 것</h3><p class="record-field">${e(fill(d.field,v))}</p><p>${e(fill(d.left,v))}</p></section><section><h3>② 관리실에 적혀 있는 것</h3><p class="record-field">${e(d.source)}</p><p>${e(fill(d.right,v))}</p></section></div><p class="paper-foot">두 내용이 같은지 보세요. 이름·호수·예약이 바뀌었거나 취소된 기록도 확인하세요.</p>`:'<p>기록 보기를 누르면 이 사람이 가져온 것과 관리실 기록을 함께 볼 수 있어요.</p>'}</article>`;
}
function transcript(v,pack,done,independent=false){const c=pack.call,e=escapeHTML,at=sourceTime(independent?3:2),source=independent?c.verifySource:c.source;
 const lines=independent?[['경비원',`${v.name} 님의 ${v.unit}호 방문입니다. 앞에서 확인한 내용이 맞는지 한 번 더 봐 주세요.`],['확인 담당',pack.verificationDetail]]:[['경비원',`${v.name} 님이 ${v.unit}호에 가려고 왔어요. 아는 사람인가요? 들어가도 되나요?`],['들은 내용',fill(c.line,v)],['경비원의 메모',c.detail]];
 return `<article class="call-record"><div class="camera"><span>${e(source)}</span><span>${at}</span></div><div class="call-state">${done?(independent?'다시 확인했어요':e(c.state)):'아직 확인하지 않았어요'}</div>${done?`<ol class="transcript">${lines.map(([who,text],i)=>`<li><small>${at}:${String(i*8).padStart(2,'0')} · ${who}</small><p>${e(text)}</p></li>`).join('')}</ol>`:'<p>아래 버튼을 누르면 어디로 전화했는지, 무슨 말을 들었는지 볼 수 있어요.</p>'}</article>`;
}
function renderTool(){
 clearReplay();const {v,a,pack}=current(),done=inspected(),e=escapeHTML;
 $('toolTitle').textContent=({CCTV:'CCTV 기록 재생','명부':'주민·방문 기록 보기','통화':'집에 전화한 내용','재확인':'한 번 더 확인한 결과'})[activeTool];
 $('toolCaption').textContent=`사건 ${run.index+1} / ${v.name} / 도착 ${TIMES[run.index]}`;$('toolStep').textContent=done?'확인한 내용':'아래 버튼을 눌러 주세요';
 let body='';
 if(activeTool==='CCTV'){
 body=done?'<div id="caseReplay"></div>':`<div class="replay-locked"><strong>저장된 영상 ${pack.recordCode}</strong><p>이 사람이 오기 전과 지금의 모습을 볼 수 있어요.</p><p>아래의 영상 보기 버튼을 눌러 주세요.</p></div>`;
 if(done)body+=`<ol class="shot-list">${pack.scenes.map((s,i)=>`<li><strong>장면 ${i+1} · 현장 ${sourceTime(s.offset)}${sceneTime(s,TIMES[run.index])!==sourceTime(s.offset)?" / 화면 "+sceneTime(s,TIMES[run.index]):""} · ${LOCATIONS[s.location]}</strong><p>${e(s.note)}</p></li>`).join('')}</ol>`;
 }else if(activeTool==='명부')body=documentView(v,pack,done);
 else if(activeTool==='통화')body=transcript(v,pack,done);
 else{
 body=`<div class="verification-source"><strong>다시 확인한 곳</strong><p>${e(pack.call.verifySource)}</p></div>`+transcript(v,pack,done,true);
 if(done&&a.channel==='CCTV')body+='<h3>영상도 다시 보기</h3><div id="caseReplay"></div>';
 if(done&&a.channel==='명부')body+=documentView(v,pack,true);
 }
 if(done){const summary=activeTool==='재확인'?pack.plain.confirmed:clueFor(activeTool);const question=activeTool===a.channel?pack.plain.check:({CCTV:'이 사람이 언제 왔는지 먼저 보세요.',명부:'말한 이름·호수와 적힌 내용이 같은지 보세요.',통화:'그 집 주민이 누구인지, 들어와도 된다고 했는지 확인하세요.'})[activeTool];body=`<aside class="plain-brief"><h3>${activeTool==='재확인'?'다시 알아보니':'지금 알게 된 것'}</h3><p>${e(summary)}</p>${question?`<h3>다음에는 이것을 확인하세요</h3><p>${e(question)}</p>`:''}</aside>`+body;}
 $('toolBody').innerHTML=body;
 if($('caseReplay')){const generation=replayGeneration;mountReplay($('caseReplay'),{pack,visitor:v,time:TIMES[run.index],date:run.date}).then(cleanup=>{if(generation!==replayGeneration)cleanup();else replayCleanup=cleanup})}
 $('toolHint').textContent=done?'확인한 내용은 경비실에 메모해 두었어요.':'아래 버튼을 눌러 확인하세요.';
 $('toolAction').textContent=done?'확인 완료':({CCTV:'영상 보기','명부':'기록 보기','통화':'통화 내용 보기','재확인':'한 번 더 확인하기'})[activeTool];$('toolAction').disabled=done;
 const next=({CCTV:'명부','명부':'통화','통화':'재확인','재확인':null})[activeTool];$('nextTool').hidden=!next;$('nextTool').textContent=next?TOOL_NAMES[next]:'';$('nextTool').onclick=()=>next==='재확인'?verify():inspect(next);$('nextTool').disabled=!done;
 show('investigation');$('toolTitle').focus({preventScroll:true});
}
function readTool(){if(!activeTool||!run||run.screen!=='game'||inspected())return;if(activeTool==='재확인')run.verified=true;else run.seen.push(activeTool);save();renderTool()}
function decide(allow){if(run&&decideRun(run,allow,anomalies)){save();render()}}
function next(){if(run&&advance(run)){save();render()}}
async function share(){if(!run||run.screen!=='result')return;$('share').disabled=true;
 try{
  const c=document.createElement('canvas');c.width=1080;c.height=1350;const ctx=c.getContext('2d'),t=totals(run);ctx.fillStyle='#101a1b';ctx.fillRect(0,0,1080,1350);ctx.strokeStyle='#b8a475';ctx.lineWidth=4;ctx.strokeRect(70,70,940,1210);
  ctx.fillStyle='#d6bd79';ctx.font='38px sans-serif';ctx.fillText('404호는 없습니다',110,170);ctx.fillStyle='#e7eadc';ctx.font='bold 68px sans-serif';ctx.fillText(ending(run,anomalies),110,360,860);
  ctx.font='36px sans-serif';['야간근무 기록 · '+run.date,`정답 ${t.correct} / 8`,`위험 방문객 허용 ${t.threats}`,`정상 방문객 거부 ${t.denials}`,'당신이라면 문을 열겠습니까?'].forEach((line,i)=>ctx.fillText(line,110,525+i*120,860));
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('이미지를 만들 수 없습니다.');const file=new File([blob],'404-근무기록.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'404호는 없습니다'});return}catch(e){if(e.name==='AbortError')return}}
  const url=URL.createObjectURL(blob);$('shareImage').src=url;$('shareDownload').href=url;$('sharePreview').hidden=false;$('shareClose').onclick=()=>{$('sharePreview').hidden=true;$('shareImage').removeAttribute('src');URL.revokeObjectURL(url)};$('sharePreview').scrollIntoView({behavior:'smooth'});
 }catch(e){$('shareStatus').textContent='이미지 저장 실패: '+e.message}finally{$('share').disabled=false}
}
async function offline(){
 if(location.protocol==='capacitor:'||window.Capacitor?.isNativePlatform?.()){$('offlineStatus').textContent='오프라인 준비 완료';return}
 if(!('serviceWorker' in navigator)){$('offlineStatus').textContent='이 브라우저는 오프라인 설치를 지원하지 않습니다.';return}
 try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('offlineStatus').textContent='오프라인 준비 완료'}catch{$('offlineStatus').textContent='오프라인 저장을 완료하지 못했습니다. 연결 상태에서 다시 여세요.'}
}
async function boot(){
 $('startStory').disabled=$('startDaily').disabled=true;$('retry').hidden=true;$('record').textContent='근무 자료를 불러오는 중…';
 try{
  const response=await Promise.all(['visitors','anomalies','scenarios'].map(n=>fetch(`./data/${n}.json`)));if(response.some(r=>!r.ok))throw Error('근무 자료를 불러오지 못했습니다.');[visitors,anomalies,scenarios]=await Promise.all(response.map(r=>r.json()));if(visitors.length!==100||anomalies.length!==100||scenarios.length!==100||anomalies.some(a=>!scenarios.some(s=>s.id===a.id)))throw Error('근무 자료가 손상됐습니다.');
  ready=true;const stored=storageGet(ACTIVE);run=validRun(stored,visitors,anomalies)?stored:null;if(stored&&!run){$('storageNotice').textContent='이전 저장 기록을 읽지 못해 새 근무로 시작합니다.';$('storageNotice').hidden=false}
  $('startStory').disabled=$('startDaily').disabled=false;home();offline();
 }catch(e){$('record').textContent=e.message;$('retry').hidden=false}
}
$('backDesk').onclick=backDesk;$('finishInspect').onclick=backDesk;$('toolAction').onclick=readTool;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('investigation').hidden)backDesk()});
$('startStory').onclick=()=>start('story');$('startDaily').onclick=()=>start('daily');$('resume').onclick=render;$('homeButton').onclick=home;$('again').onclick=()=>start(run.mode);$('resultHome').onclick=home;
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>inspect(b.dataset.tool));$('verify').onclick=verify;$('allow').onclick=()=>decide(true);$('deny').onclick=()=>decide(false);$('next').onclick=next;$('share').onclick=share;$('retry').onclick=boot;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install').hidden=false});$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true}};window.addEventListener('appinstalled',()=>{$('install').hidden=true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run)save()});$('version').textContent='v0.6.0';boot();
