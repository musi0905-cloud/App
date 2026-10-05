import {mountReplay,shiftedTime,sceneTime,LOCATIONS,lookFor} from './replay.js';
import {VERSION,TOOLS,TIMES,newRun,decideRun,advance,totals,ending,validRun,hash} from './engine.js';
import {playDialogue,stopVoice,soundOn,setSoundOn,voiceAvailable,primeVoice} from './voice.js';
import {ring,doorOpen,doorShut,primeSound} from './sfx.js';
// Phones only allow sound and speech that start inside a tap: wake both up in the tap itself, then play later.
function primeAudio(){try{primeSound();primeVoice()}catch{}}
const TOOL_NAMES={CCTV:'CCTV 보기',명부:'주민·방문 기록',통화:'집에 전화하기',재확인:'한 번 더 확인'};
const $=id=>document.getElementById(id),ACTIVE='404_active_v2',LAST='404_last_run';
const ENDING_NOTES={'404호':'없는 집으로 사람을 들여보냈어요. 이 밤은 여기서 끝나요.','오판':'위험한 사람을 두 번 넘게 들여보냈어요. 다음에는 한 번 더 확인해요.','무고한 거부':'괜찮은 사람을 세 번 넘게 돌려보냈어요. 기록과 전화를 믿어 봐요.','신중한 경비원':'모든 방문객을 꼼꼼히 확인하고 한 번 더 확인까지 했어요.','첫 근무의 기록':'첫 밤을 무사히 마쳤어요. 오늘 밤의 선택이 기록으로 남았어요.','퇴근':'오늘 밤의 선택이 기록으로 남았어요. 내일 밤에 다시 만나요.'};
let scenarios=[],visitors=[],anomalies=[],run=null,ready=false,deferredInstall=null,activeTool=null,toolOrigin=null,cameraPast=false,replayCleanup=null,replayGeneration=0; 
function clearReplay(){replayGeneration++;if(replayCleanup){replayCleanup();replayCleanup=null}}
function show(screen){if(screen!=='investigation'){clearReplay();stopVoice()}['home','game','investigation','feedback','result'].forEach(id=>$(id).hidden=id!==screen);activateMedia();window.scrollTo(0,0)}
// Photo backdrops with an optional looping video. Videos get a src only while their screen is visible, and never with reduced motion.
const MEDIA='assets/v2/',reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function activateMedia(){document.querySelectorAll('.scene-media').forEach(box=>{
 if(!box.dataset.ready){box.dataset.ready='1';box.style.backgroundImage=`url(${MEDIA}${box.dataset.poster}.webp)`;if(box.dataset.video){const v=document.createElement('video');v.className='ambient';v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('aria-hidden','true');v.preload='none';box.prepend(v)}}
 const v=box.querySelector('video.ambient');if(!v)return;const visible=!box.closest('[hidden]')&&!document.hidden&&!reducedMotion();
 if(visible){if(!v.getAttribute('src'))v.src=MEDIA+'motion/'+box.dataset.video+'.mp4';v.play().catch(()=>{})}else if(!v.paused)v.pause();
})}
// Change a backdrop after it was set up (e.g. the door photo that matches the decision).
function setPoster(box,poster,video=null){if(box.dataset.poster===poster&&(box.dataset.video||null)===video)return;box.dataset.poster=poster;if(video)box.dataset.video=video;else delete box.dataset.video;box.querySelector('video.ambient')?.remove();delete box.dataset.ready;activateMedia()}
function mediaHTML(poster,video,cls=''){return `<div class="scene-media ${cls}" data-poster="${poster}"${video?` data-video="${video}"`:''}></div>`}
function mountClips(){document.querySelectorAll('#clipGallery figure').forEach(f=>{if(f.querySelector('video'))return;const v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.preload='none';v.poster=`${MEDIA}previews/${f.dataset.clip}.webp`;v.dataset.src=MEDIA+'motion/'+f.dataset.clip+'.mp4';f.prepend(v)})}
function storageGet(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function save(){try{localStorage.setItem(ACTIVE,JSON.stringify(run))}catch{$('storageNotice').hidden=false}}
// Returns the case with every {name}/{unit} placeholder filled, so no text field can show a raw placeholder.
function current(){const p=run.cases[run.index],original=visitors.find(v=>v.id===p.visitor),a=anomalies.find(a=>a.id===p.anomaly),raw=scenarios.find(s=>s.id===a.id);const v={...original,baseRole:original.role,unit:raw.unitOverride||original.unit,role:raw.role};const pack=fillDeep(raw,v);v.claim=pack.claim;return {v,a,pack}}
function fillDeep(x,v){return typeof x==='string'?fill(x,v):Array.isArray(x)?x.map(y=>fillDeep(y,v)):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,y])=>[k,fillDeep(y,v)])):x}
function fill(s,v){return String(s).replaceAll('{name}',v.name).replaceAll('{unit}',v.unit)}
function sourceTime(minutes=0){return shiftedTime(TIMES[run.index],minutes)}
function log(title,text){const p=document.createElement('p'),b=document.createElement('strong');b.textContent=title+' — ';p.append(b,document.createTextNode(text));$('evidence').append(p)}
function person(v,extra=''){return `<span role="img" aria-label="${escapeHTML(v.name)}의 방문객 캐릭터" class="person-sprite ${extra}" style="background-image:url(${MEDIA}visitor-0${lookFor(v)}-stand.webp)"></span>`}
function clockBefore(minutes){const [h,m]=TIMES[run.index].split(':').map(Number),n=(h*60+m-minutes+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function guide(){const {v,a,pack}=current();const older=pack.scenes.find(s=>s.offset<0);return {clue:pack.plain.what,verify:pack.plain.confirmed,question:pack.plain.check,...(older&&a.channel==='CCTV'?{past:`${sourceTime(older.offset)} · ${older.note}`}:{})}}
function timeline(){const {v,a}=current(),g=guide(),items=[];
 if(g.past&&run.seen.includes(a.channel))items.push(['이전 기록',g.past]);
 items.push([`${TIMES[run.index]} · 방문객 도착`,`${v.name}: “${v.claim}” (${v.unit}호에 간다고 해요)`]);
 for(const [i,t] of ['CCTV','명부','통화'].entries())items.push([`확인 ${i+1} · ${TOOL_NAMES[t]}`,run.seen.includes(t)?clueFor(t):'아직 안 봤어요.']);
 items.push(['마지막 · 한 번 더 확인',run.verified?g.verify:'다른 카메라를 보거나, 관리실에 적힌 번호로 전화해 다시 물어봐요.']);
 return '<ol class="case-timeline">'+items.map(([t,s])=>`<li><strong>${escapeHTML(t)}</strong><p>${escapeHTML(s)}</p></li>`).join('')+'</ol>';
}
function evidence(){
 $('evidence').innerHTML='<h3>지금까지 알게 된 것</h3>'+timeline();
 const next=['CCTV','명부','통화'].find(t=>!run.seen.includes(t));
 $('routine').textContent=next?`다음 할 일: ${TOOL_NAMES[next]}` : !run.verified?'다음 할 일: 한 번 더 확인':'확인을 마쳤어요. 이 사람을 들여보낼지 결정하세요.';
 $('guidedAction').textContent=next?TOOL_NAMES[next]:!run.verified?'한 번 더 확인하기':'확인한 내용 다시 보기';
 $('guidedAction').onclick=()=>next?inspect(next):!run.verified?verify():$('evidence').scrollIntoView({behavior:'smooth'});
 document.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=false;b.classList.toggle('seen',run.seen.includes(b.dataset.tool));b.setAttribute('aria-label',TOOL_NAMES[b.dataset.tool]+(run.seen.includes(b.dataset.tool)?' · 다시 보기':''))});$('verify').disabled=!run.seen.length;
}
function render(){if(!run)return;$('shiftLabel').textContent=run.mode==='daily'?'오늘의 근무 · '+run.date:'첫 근무';
 if(run.screen==='game'){
  const {v}=current(),t=totals(run);$('clock').textContent=TIMES[run.index];$('progress').textContent=String(run.index+1).padStart(2,'0')+' / 08';
  $('mistakes').textContent='틀린 판단 '+(t.threats+t.denials);$('portrait').innerHTML=person(v);$('identity').textContent=`${v.role} · ${v.name} · ${v.unit}호 방문`;$('claim').textContent='“'+v.claim+'”';evidence();
 }else if(run.screen==='feedback'){
  const {v,a}=current(),h=run.history.at(-1),g=guide();$('clock').textContent=TIMES[run.index];
  $('feedback').classList.toggle('correct',h.correct);$('feedback').classList.toggle('wrong',!h.correct);
  setPoster($('feedback').querySelector('.scene-media'),h.allow?'door-open':'door-closed');
  $('feedbackTitle').textContent=h.correct?'잘 판단했어요. 맞았어요':'아쉬워요. 틀렸어요';
  $('feedbackText').textContent=`${v.name} 님(${v.unit}호)은 ${a.safe?'들여보내도 되는 사람이었어요.':'문을 열어 주면 안 되는 사람이었어요.'} ${g.clue}`;$('reason').textContent=g.verify;
  $('hint').hidden=h.correct;$('hint').textContent=h.correct?'':`다음에는 이렇게 해 보세요: ${g.question}`;
  $('next').textContent=run.index===7?'근무 결과 보기':'다음 방문객';
 }else{
  const t=totals(run),end=ending(run,anomalies);$('clock').textContent='06:00';$('ending').textContent=end;$('summary').textContent=ENDING_NOTES[end]||'오늘 밤의 선택이 기록으로 남았어요.';setPoster($('result').querySelector('.scene-media'),end==='404호'?'ending-404':'ending-dawn',end==='404호'?null:'12-ending-dawn');$('result').dataset.ending=end==='404호'?'lost':end==='신중한 경비원'?'best':end==='오판'||end==='무고한 거부'?'bad':'plain';
  $('stats').textContent=`8명 중 ${t.correct}명 맞힘 · 위험한 사람을 들여보냄 ${t.threats}번 · 괜찮은 사람을 돌려보냄 ${t.denials}번 · 확인한 횟수 ${t.investigations}번`;
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
// Register book: a closed cover until the guard opens it, then pages to flip through (buttons, swipe or arrow keys).
function bookEntries(v,pack){
 const others=visitors.filter(x=>x.id!==v.id),seed=hash(pack.id+run.date),[h,m]=TIMES[run.index].split(':').map(Number),rows=[];
 for(let i=0;i<3;i++){const o=others[(seed>>>(i*5))%others.length],n=(h*60+m-[41,26,12][i]+1440)%1440;rows.push([`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,o.name,o.unit+'호',o.role])}
 return rows;
}
function documentView(v,pack,done){const d=pack.document,e=escapeHTML;
 const cover=`<div class="paper-heading"><span>${pack.recordCode} · ${run.date}</span><strong>관리실 방문 기록부</strong><span>기록을 본 시간 ${sourceTime(1)}</span></div><table><caption>지금 온 사람 · ${TIMES[run.index]}</caption><tbody><tr><th>이름</th><td>${e(v.name)}</td></tr><tr><th>가려는 집</th><td>${e(v.unit)}호</td></tr><tr><th>어떤 사람</th><td>${e(v.role)}</td></tr></tbody></table>`;
 if(!done)return `${mediaHTML('ledger-desk','10-ledger-inspection','banner')}<article class="register">${cover}<p>아래 '기록부 펼치기'를 누르면 한 장씩 넘겨 볼 수 있어요.</p></article>`;
 const log=bookEntries(v,pack).map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')+`<tr class="book-current"><td>${TIMES[run.index]}</td><td>${e(v.name)}</td><td>${e(v.unit)}호</td><td>${e(v.role)}</td></tr>`;
 const pages=[
  ['오늘 밤 방문 기록',`<table class="book-log"><thead><tr><th>시간</th><th>이름</th><th>집</th><th>어떤 사람</th></tr></thead><tbody>${log}</tbody></table><p class="small">노랗게 칠한 맨 아래 줄이 지금 온 사람이에요. 다음 장을 넘겨 보세요.</p>`],
  ['이 사람이 말하거나 보여 준 것',`<p class="record-field">${e(d.field)}</p><p class="book-big">${e(fill(d.left,v))}</p>${d.claim?`<p class="small">방문객이 한 말: “${e(fill(d.claim,v))}”</p>`:''}`],
  ['관리실에 적혀 있는 것',`<p class="record-field">${e(d.source)}</p><p class="book-big">${e(fill(d.right,v))}</p>`],
  ['두 기록을 나란히 보기',`<div class="record-pair"><section><h3>① 이 사람이 말하거나 보여 준 것</h3><p class="record-field">${e(fill(d.field,v))}</p><p>${e(fill(d.left,v))}</p></section><section><h3>② 관리실에 적혀 있는 것</h3><p class="record-field">${e(d.source)}</p><p>${e(fill(d.right,v))}</p></section></div><p class="paper-foot">두 내용이 같은지 보세요. 이름, 호수, 예약이 바뀌었거나 취소됐는지도 보세요.</p>`]
 ];
 return `<article class="register book" data-book style="background-image:url(${MEDIA}ledger-desk.webp)"><div class="book-page" aria-live="polite">${pages.map(([t,b],i)=>`<section class="book-sheet" data-page="${i}"${i?' hidden':''}><h3 class="book-title">${e(t)}</h3>${b}</section>`).join('')}</div><div class="book-controls"><button type="button" class="book-prev">◀ 앞 장</button><span class="book-count">1 / ${pages.length}</span><button type="button" class="book-next">다음 장 ▶</button></div><p class="small book-hint">옆으로 밀거나 버튼을 눌러 한 장씩 넘겨요.</p></article>`;
}
function mountBooks(root){root.querySelectorAll('[data-book]').forEach(book=>{
 const sheets=[...book.querySelectorAll('.book-sheet')],count=book.querySelector('.book-count'),prev=book.querySelector('.book-prev'),next=book.querySelector('.book-next'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;let page=0,startX=null;
 function go(to){if(to<0||to>=sheets.length||to===page)return;const dir=to>page?'next':'prev';sheets[page].hidden=true;page=to;const sheet=sheets[page];sheet.hidden=false;if(!reduce){sheet.classList.remove('turn-next','turn-prev');void sheet.offsetWidth;sheet.classList.add('turn-'+dir)}update()}
 function update(){count.textContent=`${page+1} / ${sheets.length}`;prev.disabled=page===0;next.disabled=page===sheets.length-1;book.dataset.page=String(page)}
 prev.onclick=()=>go(page-1);next.onclick=()=>go(page+1);
 // Swipe: pointer events for mouse/pen, touch events for phones (a scroll gesture cancels pointerup). One turn per gesture.
 let lastTurn=0;const swipe=(x0,x1)=>{const dx=x1-x0;if(Math.abs(dx)>40&&performance.now()-lastTurn>350){lastTurn=performance.now();go(page+(dx<0?1:-1))}};
 book.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')startX=e.clientX});book.addEventListener('pointerup',e=>{if(e.pointerType==='touch'||startX===null)return;swipe(startX,e.clientX);startX=null});
 book.addEventListener('touchstart',e=>{startX=e.touches[0].clientX},{passive:true});book.addEventListener('touchend',e=>{if(startX===null)return;swipe(startX,e.changedTouches[0].clientX);startX=null},{passive:true});
 book.tabIndex=0;book.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(page+1);if(e.key==='ArrowLeft')go(page-1)});update();
})}
function callLines(v,pack,independent){const c=pack.call,lines=independent?c.verifyDialogue:c.dialogue;
 if(Array.isArray(lines)&&lines.length)return lines.map(l=>({who:l.who,text:fill(l.text,v)}));
 return independent?[{who:'경비원',text:`${v.name} 님이 ${v.unit}호에 가려고 해요. 한 번 더 확인할게요.`},{who:'주민',text:pack.verificationDetail}]:[{who:'경비원',text:`${v.name} 님이 ${v.unit}호에 가려고 왔어요. 아는 분인가요?`},{who:'주민',text:fill(c.line,v)}];
}
function transcript(v,pack,done,independent=false){const c=pack.call,e=escapeHTML,at=sourceTime(independent?3:2),source=independent?c.verifySource:c.source,lines=callLines(v,pack,independent);
 const controls=voiceAvailable()?`<div class="call-controls"><button type="button" class="call-play">▶ 통화 다시 듣기</button><button type="button" class="call-stop">■ 멈추기</button><button type="button" class="call-sound" aria-pressed="${soundOn()}">${soundOn()?'소리 켜짐':'소리 꺼짐'}</button></div>`:'<p class="small">이 기기에서는 목소리를 들을 수 없어요. 아래 글로 읽어 주세요.</p>';
 return `<article class="call-record">${mediaHTML('intercom-desk','11-intercom-ring','banner call-media')}<div class="camera"><span>${e(source)}</span><span>${at}</span></div><div class="call-state">${done?(independent?'다시 확인했어요':e(c.state)):'아직 전화하지 않았어요'}</div>${done?`${controls}<ol class="transcript">${lines.map((l,i)=>`<li data-line="${i}"><small>${e(l.who)}</small><p>${e(l.text)}</p></li>`).join('')}</ol>`:'<p>아래 버튼을 누르면 전화를 걸어요. 통화 목소리를 듣고 글로도 볼 수 있어요.</p>'}</article>`;
}
function playCall(autoplay){const rec=$('toolBody').querySelector('.call-record');if(!rec||!rec.querySelector('.transcript'))return;const {v,pack}=current(),lines=callLines(v,pack,activeTool==='재확인'),items=[...rec.querySelectorAll('.transcript li')];
 const mark=i=>items.forEach((li,j)=>li.classList.toggle('speaking',i===j));
 const start=(first=false)=>{rec.dataset.playing='true';(first?ring():Promise.resolve()).then(()=>playDialogue(lines,mark)).then(()=>{rec.dataset.playing='false'})};
 rec.querySelector('.call-play')?.addEventListener('click',()=>start(false));
 rec.querySelector('.call-stop')?.addEventListener('click',()=>{stopVoice();mark(-1);rec.dataset.playing='false'});
 rec.querySelector('.call-sound')?.addEventListener('click',e=>{const on=!soundOn();setSoundOn(on);e.currentTarget.textContent=on?'소리 켜짐':'소리 꺼짐';e.currentTarget.setAttribute('aria-pressed',String(on));if(!on){stopVoice();mark(-1)}});
 if(autoplay&&soundOn()&&voiceAvailable())start(true);
}
function renderTool(autoplay=false){
 clearReplay();stopVoice();const {v,a,pack}=current(),done=inspected(),e=escapeHTML;
 $('toolTitle').textContent=({CCTV:'CCTV 기록 재생','명부':'주민·방문 기록 보기','통화':'집에 전화한 내용','재확인':'한 번 더 확인한 결과'})[activeTool];
 $('toolCaption').textContent=`사건 ${run.index+1} / ${v.name} / 도착 ${TIMES[run.index]}`;$('toolStep').textContent=done?'확인했어요':'아래 버튼을 눌러 주세요';
 let body='';
 if(activeTool==='CCTV'){
 body=done?'<div id="caseReplay"></div>':`<div class="replay-locked"><strong>저장된 영상 ${pack.recordCode}</strong><p>이 사람이 오기 전 모습과 지금 모습을 볼 수 있어요.</p><p>아래 '영상 보기'를 눌러 주세요.</p></div>`;
 if(done)body+=`<ol class="shot-list">${pack.scenes.map((s,i)=>`<li><strong>장면 ${i+1} · ${LOCATIONS[s.location]} · 실제 시각 ${sourceTime(s.offset)}${sceneTime(s,TIMES[run.index])!==sourceTime(s.offset)?" (화면 시계 "+sceneTime(s,TIMES[run.index])+")":""}</strong><p>${e(s.note)}</p></li>`).join('')}</ol>`;
 }else if(activeTool==='명부')body=documentView(v,pack,done);
 else if(activeTool==='통화')body=transcript(v,pack,done);
 else{
 body=`<div class="verification-source"><strong>다시 확인한 곳</strong><p>${e(pack.call.verifySource)}</p></div>`+transcript(v,pack,done,true);
 if(done&&a.channel==='CCTV')body+='<h3>영상도 다시 보기</h3><div id="caseReplay"></div>';
 if(done&&a.channel==='명부')body+=documentView(v,pack,true);
 }
 if(done){const summary=activeTool==='재확인'?pack.plain.confirmed:clueFor(activeTool);const question=activeTool===a.channel?pack.plain.check:({CCTV:'이 사람이 언제 왔는지 먼저 보세요.',명부:'말한 이름·호수와 적힌 내용이 같은지 보세요.',통화:'그 집 주민이 누구인지, 들어와도 된다고 했는지 확인하세요.'})[activeTool];body=`<aside class="plain-brief"><h3>${activeTool==='재확인'?'다시 알아보니':'지금 알게 된 것'}</h3><p>${e(summary)}</p>${question?`<h3>다음에는 이것을 확인하세요</h3><p>${e(question)}</p>`:''}</aside>`+body;}
 $('toolBody').innerHTML=body;mountBooks($('toolBody'));activateMedia();if(done&&(activeTool==='통화'||activeTool==='재확인'))playCall(autoplay);
 if($('caseReplay')){const generation=replayGeneration;mountReplay($('caseReplay'),{pack,visitor:v,time:TIMES[run.index],date:run.date}).then(cleanup=>{if(generation!==replayGeneration)cleanup();else replayCleanup=cleanup})}
 $('toolHint').textContent=done?'알게 된 내용은 경비실 메모에 적어 두었어요.':'아래 버튼을 눌러 확인하세요.';
 $('toolAction').textContent=done?'확인 완료':({CCTV:'영상 보기','명부':'기록부 펼치기','통화':'전화 걸기','재확인':'한 번 더 확인하기'})[activeTool];$('toolAction').disabled=done;
 const next=({CCTV:'명부','명부':'통화','통화':'재확인','재확인':null})[activeTool];$('nextTool').hidden=!next;$('nextTool').textContent=next?TOOL_NAMES[next]:'';$('nextTool').onclick=()=>next==='재확인'?verify():inspect(next);$('nextTool').disabled=!done;
 show('investigation');$('toolTitle').focus({preventScroll:true});
}
function readTool(){if(!activeTool||!run||run.screen!=='game'||inspected())return;if(activeTool==='통화'||activeTool==='재확인')primeAudio();if(activeTool==='재확인')run.verified=true;else run.seen.push(activeTool);save();renderTool(true)}
function decide(allow){if(run&&decideRun(run,allow,anomalies)){save();render();doorTransition(allow)}}
// Short staging after a decision: the door opens (video) or stays shut (photo) over the feedback screen. Never blocks input.
function doorTransition(allow){const box=$('doorTransition');allow?doorOpen():doorShut();if(reducedMotion())return;
 setPoster(box.querySelector('.scene-media'),allow?'door-open':'door-closed',allow?'23-door-open-ambient':null);box.querySelector('p').textContent=allow?'문을 열었어요.':'문을 열지 않았어요.';
 box.hidden=false;box.classList.remove('out');clearTimeout(box.timer);box.timer=setTimeout(()=>{box.classList.add('out');box.timer=setTimeout(()=>{box.hidden=true;activateMedia()},400)},1000)}
function next(){if(run&&advance(run)){save();render()}}
async function share(){if(!run||run.screen!=='result')return;$('share').disabled=true;
 try{
  const c=document.createElement('canvas');c.width=1080;c.height=1350;const ctx=c.getContext('2d'),t=totals(run);ctx.fillStyle='#101a1b';ctx.fillRect(0,0,1080,1350);try{const bg=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=MEDIA+'ending-dawn.webp'});const sw=bg.height*1080/1350;ctx.globalAlpha=.35;ctx.drawImage(bg,(bg.width-sw)/2,0,sw,bg.height,0,0,1080,1350);ctx.globalAlpha=1;ctx.fillStyle='#101a1bb0';ctx.fillRect(0,0,1080,1350)}catch{}ctx.strokeStyle='#b8a475';ctx.lineWidth=4;ctx.strokeRect(70,70,940,1210);
  ctx.fillStyle='#d6bd79';ctx.font='38px sans-serif';ctx.fillText('404호는 없습니다',110,170);ctx.fillStyle='#e7eadc';ctx.font='bold 68px sans-serif';ctx.fillText(ending(run,anomalies),110,360,860);
  ctx.font='36px sans-serif';['야간근무 기록 · '+run.date,`8명 중 ${t.correct}명 맞힘`,`위험한 사람을 들여보냄 ${t.threats}번`,`괜찮은 사람을 돌려보냄 ${t.denials}번`,'당신이라면 문을 열어 줄 건가요?'].forEach((line,i)=>ctx.fillText(line,110,525+i*120,860));
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('이미지를 만들 수 없어요.');const file=new File([blob],'404-근무기록.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'404호는 없습니다'});return}catch(e){if(e.name==='AbortError')return}}
  const url=URL.createObjectURL(blob);$('shareImage').src=url;$('shareDownload').href=url;$('sharePreview').hidden=false;$('shareClose').onclick=()=>{$('sharePreview').hidden=true;$('shareImage').removeAttribute('src');URL.revokeObjectURL(url)};$('sharePreview').scrollIntoView({behavior:'smooth'});
 }catch(e){$('shareStatus').textContent='이미지를 저장하지 못했어요: '+e.message}finally{$('share').disabled=false}
}
async function offline(){
 if(location.protocol==='capacitor:'||window.Capacitor?.isNativePlatform?.()){$('offlineStatus').textContent='인터넷 없이도 할 수 있어요';return}
 if(!('serviceWorker' in navigator)){$('offlineStatus').textContent='이 브라우저에서는 인터넷 없이 할 수 없어요.';return}
 try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('offlineStatus').textContent='인터넷 없이도 할 수 있어요'}catch{$('offlineStatus').textContent='인터넷 없이 하려면 인터넷이 될 때 한 번 더 열어 주세요.'}
}
async function boot(){
 $('startStory').disabled=$('startDaily').disabled=true;$('retry').hidden=true;$('record').textContent='게임 자료를 불러오는 중이에요…';
 try{
  const response=await Promise.all(['visitors','anomalies','scenarios'].map(n=>fetch(`./data/${n}.json`)));if(response.some(r=>!r.ok))throw Error('게임 자료를 불러오지 못했어요.');[visitors,anomalies,scenarios]=await Promise.all(response.map(r=>r.json()));if(visitors.length!==100||anomalies.length!==100||scenarios.length!==100||anomalies.some(a=>!scenarios.some(s=>s.id===a.id)))throw Error('게임 자료가 망가졌어요. 다시 설치해 주세요.');
  ready=true;const stored=storageGet(ACTIVE);run=validRun(stored,visitors,anomalies)?stored:null;if(stored&&!run){$('storageNotice').textContent='지난 기록을 읽지 못해서 새로 시작해요.';$('storageNotice').hidden=false}
  $('startStory').disabled=$('startDaily').disabled=false;home();offline();
 }catch(e){$('record').textContent=e.message;$('retry').hidden=false}
}
$('clipGallery').addEventListener('toggle',e=>{mountClips();e.currentTarget.querySelectorAll('video').forEach(v=>{if(e.currentTarget.open&&!reducedMotion()){if(!v.getAttribute('src'))v.src=v.dataset.src;v.play().catch(()=>{})}else v.pause()})});
$('backDesk').onclick=backDesk;$('finishInspect').onclick=backDesk;$('toolAction').onclick=readTool;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('investigation').hidden)backDesk()});
$('startStory').onclick=()=>start('story');$('startDaily').onclick=()=>start('daily');$('resume').onclick=render;$('homeButton').onclick=home;$('again').onclick=()=>start(run.mode);$('resultHome').onclick=home;
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>inspect(b.dataset.tool));$('verify').onclick=verify;$('allow').onclick=()=>{primeAudio();decide(true)};$('deny').onclick=()=>{primeAudio();decide(false)};$('next').onclick=next;$('share').onclick=share;$('retry').onclick=boot;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install').hidden=false});$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true}};window.addEventListener('appinstalled',()=>{$('install').hidden=true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run)save();activateMedia()});$('version').textContent='v0.11.0';boot();
