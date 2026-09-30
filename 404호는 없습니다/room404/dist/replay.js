// Deterministic, seekable in-game reconstruction. Each segment is a distinct source/time.
// v0.8: visual-motion v2 assets. A looping ambient video (when available) sits under a transparent canvas that draws
// the visitor, props and anomaly effects. The HUD is HTML so camera flips/zooms never mirror or blur the text.
export const LOCATIONS={lobby:'공동현관',lobbySide:'현관 옆 카메라',hall:'안쪽 복도',elevator:'엘리베이터',stairs:'계단',parking:'주차장',door:'집 현관문'};
export const MODES=['normal','compare','badge','double','shadow','shadowHold','faceLock','absent','yesterday','doorClosed','doorOpen','doorCompare','preMove','footprints','voiceEarly','voiceLate','clock7','repeat','reflection','recorded','live','dateOnly','ir','reboot','loading','delay3','rainDouble','rain','removeProp','idMatch','card','fingerprint','darkCoat','hairOld','distort','faceShadow','blurCard','document','phone','ring','echo'];
export const CAMERAS={main:'① 기본 카메라',side:'② 다른 방향',close:'③ 가까이 보기'};
const V2='assets/v2/';
const BACKGROUNDS={lobby:'cctv-lobby',lobbySide:'cctv-lobby-side',hall:'cctv-hall',elevator:'cctv-elevator',stairs:'cctv-stairs',parking:'cctv-parking',door:'door-closed',doorOpen:'door-open'};
const AMBIENT={lobby:'03-lobby-monitor',lobbySide:'04-lobby-side-monitor',hall:'05-hall-monitor',elevator:'06-elevator-monitor',stairs:'07-stairs-monitor',parking:'08-parking-monitor'};
// Anomaly clips already contain one specific visitor look, so they are used only when place, mode and look all match.
const ANOMALY_CLIPS=[['17-delayed-shadow','hall','shadowHold',1],['18-duplicate-visitors','lobby','double',2],['19-reflection-lag','elevator','reflection',3],['21-infrared-view','parking','ir',4],['22-rain-double-image','lobby','rainDouble',1]];
// Floor line and frame height per place, matched to the v2 backgrounds (canvas 960x640).
const LAYOUT={lobby:{y:585,h:285},lobbySide:{y:585,h:285},hall:{y:587,h:290},elevator:{y:568,h:340},stairs:{y:590,h:290},parking:{y:570,h:260},door:{y:600,h:300}};
// Walk frames (visitor-0N-walk.webp): 4x2 cells of 384x512, feet at (192,496), figure about 466px tall.
// Standing sheet (visitors.png): 4 cells of 384x1024, figure from y 76 to 967.
const WALK={fps:8,w:384,h:512,footX:192,footY:496,figure:466},STAND={top:76,foot:967,cellW:384,cellH:1024};
const WALK_ACTIONS=['enter','cross','descend'];
export function walkFrame(cursor){return Math.floor(cursor*WALK.fps)%8}
const media={};
function load(src){return media[src]??=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('장면 그림을 불러오지 못했어요.'));im.src=src})}
export function shiftedTime(time,offset){const [h,m]=time.split(':').map(Number),n=(h*60+m+offset+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
export function sceneTime(frame,time){return shiftedTime(time,frame.offset+(frame.mode==='clock7'?-7:0))}
function previousDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
function reduceMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
// Where the visitor stands at this phase of the scene. Shared by drawing and the close-up camera.
export function actorPlacement(s,phase,look=1){
 const base=LAYOUT[s.location]||LAYOUT.lobby;let x=480,y=base.y,h=base.h,walking=false;
 if(videoWalk(s,look)){return {x:-90+phase*1140,y:582,h:285,walking:true,video:true}}
 if(s.action==='enter'){x=160+phase*420;y=base.y-55+phase*55;h=base.h*(.82+phase*.18);walking=true}
 if(s.action==='cross'){x=110+phase*740;walking=true}
 if(s.action==='descend'){x=700-phase*260;y=base.y-150+phase*150;h=base.h*(.75+phase*.25);walking=true}
 if(s.action==='turn')x=480+Math.sin(phase*Math.PI)*28;
 if(s.mode==='repeat'){const q=(phase*2)%1;x=160+q*420;y=base.y-55+q*55;h=base.h*(.82+q*.18);walking=true}
 if(s.mode==='distort')h*=1.15;
 return {x,y,h,walking};
}
function videoWalk(s,look){return s.location==='lobby'&&['enter','cross'].includes(s.action)&&s.mode==='normal'&&(!s.prop||s.prop==='none')&&look>=1&&look<=4}
export function sceneVideo(s,look,camera='main'){
 if(s.mode==='loading')return '20-signal-loss';
 if(s.mode==='doorCompare')return '09-door-comparison';
 if(s.mode==='doorOpen')return '23-door-open-ambient';
 if(s.location==='door')return null;
 if(camera==='side'&&s.location==='lobby')return AMBIENT.lobbySide;
 if(camera==='side'&&s.location==='lobbySide')return AMBIENT.lobby;
 if(camera==='main'){const clip=ANOMALY_CLIPS.find(([,loc,mode,l])=>loc===s.location&&mode===s.mode&&l===look);if(clip)return clip[0];if(videoWalk(s,look))return `${12+look}-visitor-0${look}-walk`}
 return AMBIENT[s.location]||null;
}
export async function mountReplay(host,{pack,visitor,time,date,scenes=pack.scenes}){
 let disposed=false,raf=0,playing=false,cursor=0,previous=0,camera='main';
 const duration=scenes.length*6,reduced=reduceMotion();
 host.innerHTML=`<div class="replay-heading"><strong>그때 모습 다시 보기 (장면 ${scenes.length}개)</strong><span>그림과 영상으로 다시 만든 장면이에요</span></div><div class="replay-screen"><div class="replay-stage"><video class="replay-video" muted playsinline preload="auto" aria-hidden="true"></video><canvas class="replay-canvas" width="960" height="640" aria-label="사건별 CCTV 재현 장면"></canvas></div><div class="replay-hud"><span class="hud-cam"></span><span class="hud-time"></span><span class="hud-state" hidden></span></div></div><div class="replay-cameras" role="group" aria-label="카메라 바꾸기">${Object.entries(CAMERAS).map(([k,v])=>`<button type="button" data-camera="${k}" aria-pressed="${k==='main'}">${v}</button>`).join('')}</div><p class="replay-caption" aria-live="polite"></p><div class="replay-controls"><button type="button" class="replay-play">재생</button><label>보고 싶은 순간<input class="replay-seek" type="range" min="0" max="${duration-.01}" step="0.01" value="0"></label><output class="replay-position">0 / ${duration}초</output></div><div class="replay-chapters">${scenes.map((s,i)=>`<button type="button" data-chapter="${i}" aria-pressed="${i===0}">${i+1}. ${LOCATIONS[s.location]}<small>${sceneTime(s,time)}</small></button>`).join('')}</div><p class="small">번호를 누르면 그 장면으로 가요. 카메라 버튼으로 다른 방향이나 가까이에서 볼 수 있어요.</p>`;
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),stage=host.querySelector('.replay-stage'),video=host.querySelector('video'),caption=host.querySelector('.replay-caption'),seek=host.querySelector('input'),play=host.querySelector('.replay-play');
 const hudCam=host.querySelector('.hud-cam'),hudTime=host.querySelector('.hud-time'),hudState=host.querySelector('.hud-state');
 const look=(Number(visitor.id.slice(1))-1)%4+1,sprite=look-1;
 let images,props,walkSheet,videoSrc=null,videoOk=false;const failed=new Set();
 const ready=Promise.all([
  Promise.all(Object.values(BACKGROUNDS).map(n=>load(V2+n+'.webp'))),
  Promise.all(['assets/visitors.png','assets/visitors-before-haircut.png'].map(load)),
  Promise.all(['hat','umbrella','mask','phone','parcel','glove'].map(n=>load(V2+'prop-'+n+'.webp').then(im=>[n,im]))),
  load(V2+`visitor-0${look}-walk.webp`)
 ]);
 function background(key){return images.bg[Object.keys(BACKGROUNDS).indexOf(key)]}
 function prop(kind,x,y,w,h,opacity=1){const im=props[kind];if(!im)return;ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(im,x,y,w,h);ctx.restore()}
 // Props are placed relative to the figure's frame height h (walk-frame scale) and its foot point.
 function drawProp(kind,x,y,h,mode,phase){const im=props[kind];if(!im)return;const ph={hat:h*.13,umbrella:h*.58,mask:h*.06,phone:h*.16,parcel:h*.22,glove:h*.10}[kind],pw=ph*im.width/im.height,[dx,dy]={hat:[-.02,-.92],mask:[.09,-.80],umbrella:[.2,-.51],phone:[.15,-.60],parcel:[.05,-.55],glove:[.14,-.53]}[kind];
  const gone=mode==='removeProp'&&['hat','mask','umbrella'].includes(kind);prop(kind,x+dx*h-pw/2+(gone?phase*60:0),y+dy*h+(gone?phase*110:0),pw,ph,gone?1-phase:1)}
 function actor(x,bottom,height,{alpha=1,flip=false,filter='none',propName='none',mode='normal',phase=0,shadowOnly=false,walk=-1}={}){
  ctx.save();ctx.globalAlpha=alpha;ctx.filter=shadowOnly?'brightness(0) opacity(.7)':filter;ctx.translate(x,bottom);if(flip)ctx.scale(-1,1);
  const figure=height*WALK.figure/WALK.h;
  if(walk>=0&&walkSheet){const k=height/WALK.h;ctx.drawImage(walkSheet,walk%4*WALK.w,Math.floor(walk/4)*WALK.h,WALK.w,WALK.h,-WALK.footX*k,-WALK.footY*k,WALK.w*k,WALK.h*k)}
  else{const im=images.stand[0],k=figure/(STAND.foot-STAND.top);ctx.drawImage(im,sprite*STAND.cellW,0,STAND.cellW,STAND.cellH,-STAND.cellW/2*k,-STAND.foot*k,STAND.cellW*k,STAND.cellH*k)}
  ctx.restore();
  if(!shadowOnly&&propName&&propName!=='none')drawProp(propName,x,bottom,height,mode,phase);
 }
 function headCrop(x,y,w,h){const im=images.stand[0];ctx.drawImage(im,sprite*STAND.cellW+STAND.cellW*.27,STAND.top,STAND.cellW*.46,STAND.cellH*.2,x,y,w,h)}
 function setVideo(name,local){
  const want=reduced||!name||failed.has(name)?null:name;
  if(want!==videoSrc){videoSrc=want;videoOk=false;if(want){video.src=V2+'motion/'+want+'.mp4';video.load()}else{video.removeAttribute('src');video.load()}video.hidden=!want}
  if(!want)return;
  const t=Math.min(5.95,Math.max(0,local));
  if(playing){if(video.paused)video.play().catch(()=>{});if(Math.abs(video.currentTime-t)>.3)video.currentTime=t}
  else{if(!video.paused)video.pause();if(Math.abs(video.currentTime-t)>.04)video.currentTime=t}
 }
 video.addEventListener('loadeddata',()=>{videoOk=true;draw()});
 video.addEventListener('error',()=>{if(videoSrc){failed.add(videoSrc);videoSrc=null;videoOk=false;video.hidden=true;draw()}});
 function cameraTransform(s,pos){
  if(camera==='close'){const cx=pos.x/960*100,cy=Math.max(5,(pos.y-pos.h*.62)/640*100);stage.style.transformOrigin=`${cx}% ${cy}%`;stage.style.transform='scale(2.2)'}
  else if(camera==='side'&&!['lobby','lobbySide'].includes(s.location)){stage.style.transformOrigin='50% 50%';stage.style.transform='scaleX(-1)'}
  else{stage.style.transform='';stage.style.transformOrigin=''}
 }
 function draw(){if(disposed||!images)return;const index=Math.min(scenes.length-1,Math.floor(cursor/6)),s=scenes[index],local=cursor-index*6,phase=local/6,mode=s.mode;
  const place=camera==='side'&&s.location==='lobby'?'lobbySide':camera==='side'&&s.location==='lobbySide'?'lobby':s.location;
  const view={...s,location:place},pos=actorPlacement(view,phase,look);
  setVideo(sceneVideo(s,look,camera),local);
  const clipHasActor=videoOk&&videoSrc&&(/visitor-0\d-walk|delayed|duplicate|reflection-lag|infrared|rain-double/.test(videoSrc));
  ctx.clearRect(0,0,960,640);
  if(!(videoOk&&videoSrc)){
   const key=place==='door'?(mode==='doorOpen'||(mode==='doorCompare'&&phase>.4&&phase<.8)?'doorOpen':'door'):place;
   ctx.drawImage(background(key),0,0,960,640);
  }
  cameraTransform(view,pos);
  let {x,y,h}=pos;const walk=pos.walking&&walkSheet?walkFrame(cursor):-1,walkFlip=walk>=0&&s.action==='descend';
  const filter=mode==='darkCoat'?'brightness(.35)':mode==='ir'?'grayscale(1) contrast(1.9) brightness(2)':mode==='blurCard'?'blur(.6px) saturate(.75)':'saturate(.75) brightness(.92)';
  if(!clipHasActor){
   if(['shadow','shadowHold','faceShadow'].includes(mode)){ctx.save();ctx.translate(mode==='shadow'?x:280,y-10);ctx.transform(1,.15,-.6,.25,0,0);actor(0,0,h,{shadowOnly:true,walk,flip:walkFlip});ctx.restore()}
   if(mode==='footprints'){ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#1b2420';for(let j=0;j<6;j++){ctx.beginPath();ctx.ellipse(150+j*42,y+10-j*22,11,5,-.3,0,Math.PI*2);ctx.fill()}ctx.restore()}
   if(mode!=='absent'&&mode!=='loading'){
    if(mode==='double'){actor(x-130,y,h,{filter,propName:s.prop,mode,phase,walk,flip:walkFlip});actor(x+170,y,h,{filter,propName:s.prop,mode,phase,walk,flip:walkFlip})}
    else {actor(x,y,h,{filter,propName:s.prop,mode,phase,flip:walkFlip||s.action==='turn'&&phase>.5,walk});if(['reflection','rainDouble'].includes(mode))actor(mode==='reflection'?(Math.abs(960-2*x)<160?x+200:960-x):x+40,y,mode==='reflection'?h*.9:h,{alpha:mode==='reflection'?.35:.42,flip:mode==='reflection'!==walkFlip,filter:mode==='rainDouble'?'blur(5px)':filter,walk})}
   }
   if(s.action==='wave'||s.action==='knock')prop('glove',x+h*.14+Math.sin(phase*Math.PI*4)*18,y-h*.8,h*.18,h*.22);
   if(mode==='faceLock'){headCrop(450,140,85,120);ctx.strokeStyle='#e9c46f';ctx.strokeRect(450,140,85,120)}
   if(mode==='faceShadow'){ctx.save();ctx.fillStyle='#03080699';ctx.fillRect(x-18,y-h*.86,26,h*.2);ctx.restore()}
   if(mode==='ring'&&Math.floor(phase*10)%2===0){ctx.strokeStyle='#e8cf73';ctx.lineWidth=4;ctx.strokeRect(x+h*.08,y-h*.72,h*.16,h*.2)}
   if(mode==='preMove'){ctx.save();ctx.translate(x,y-h*.84);ctx.rotate(Math.sin(phase*Math.PI)*.22);headCrop(-h*.1,-h*.06,h*.2,h*.26);ctx.restore()}
  }
  if(mode==='rain'||mode==='rainDouble'){ctx.save();ctx.strokeStyle='#becbc955';for(let i=0;i<20;i++){const xx=i*51;ctx.beginPath();ctx.moveTo(xx,(phase*640+i*67)%640);ctx.lineTo(xx-15,(phase*640+i*67)%640+70);ctx.stroke()}ctx.restore()}
  if(['card','idMatch','blurCard','hairOld','badge','fingerprint','document'].includes(mode)){
   const boxX=640;ctx.fillStyle='#d8dfd0';ctx.fillRect(boxX,300,300,210);ctx.fillStyle='#14251b';ctx.font='22px sans-serif';ctx.fillText(mode==='document'?'가져온 종이':mode==='fingerprint'?'지문 확인기':'기록과 비교',boxX+15,332,270);
   if(mode==='idMatch'||mode==='hairOld'){const im=images.stand[mode==='hairOld'?1:0];ctx.drawImage(im,sprite*STAND.cellW,0,STAND.cellW,STAND.cellH,boxX+15,344,50,145);ctx.fillText(visitor.name,boxX+80,385,205);ctx.fillText('등록 사진',boxX+80,425,205)}
   else {ctx.save();if(mode==='blurCard')ctx.filter='blur(5px)';ctx.fillText(mode==='fingerprint'?'지문을 읽지 못했어요':mode==='document'?pack.document.field:'출입 카드',boxX+15,380,270);ctx.fillText(visitor.name,boxX+15,425,270);ctx.restore()}
  }
  if(!(videoOk&&videoSrc)||mode!=='loading'){ctx.fillStyle='#07100a16';for(let yLine=0;yLine<640;yLine+=5)ctx.fillRect(0,yLine,960,1)}
  const states={doorClosed:'직접 확인: 문이 닫혀 있어요',doorOpen:'영상에서는 문이 열려 있어요',doorCompare:'같은 시간인데 문 상태가 달라요',recorded:'지금 영상 버튼에 옛 영상이 나와요',live:'녹화 버튼에 지금 영상이 나와요',reboot:'카메라를 껐다 켠 뒤 옛 화면',loading:'지금 화면을 불러오는 중…',dateOnly:'날짜가 아직 안 바뀌었어요',delay3:'3분 늦게 보이는 화면',clock7:'카메라 표시 시계',repeat:'같은 장면이 반복돼요',fingerprint:'장갑 때문에 지문이 안 읽혀요',ring:'문 앞 휴대전화도 같이 울려요',echo:'같은 말을 조금 늦게 따라 해요',voiceEarly:'음성: 손을 들었어요',voiceLate:'뒤늦게 영상의 손이 올라옴',preMove:'재생하기 전에 고개를 돌려요',compare:'같은 시간, 다른 장소',hairOld:'예전 사진과 지금 모습'};
  hudState.hidden=!states[mode];hudState.textContent=states[mode]||'';
  hudCam.textContent=`${LOCATIONS[place]} · ${index+1}/${scenes.length}${camera==='main'?'':' · '+CAMERAS[camera].slice(2)}`;
  const recordedDate=mode==='yesterday'?previousDate(date):date;hudTime.textContent=`${recordedDate} ${sceneTime(s,time)}:${String(Math.floor(phase*6)).padStart(2,'0')}`;
  canvas.dataset.mode=mode;canvas.dataset.scene=String(index);canvas.dataset.time=sceneTime(s,time);canvas.dataset.location=s.location;canvas.dataset.view=camera;canvas.dataset.video=videoSrc&&videoOk?videoSrc:'';canvas.dataset.walkFrame=String(walk);canvas.dataset.count=String(mode==='absent'||mode==='loading'?0:['double','reflection','rainDouble'].includes(mode)?2:1);
  caption.textContent=`장면 ${index+1} · ${s.note}`;seek.value=String(cursor);host.querySelector('output').textContent=`${cursor.toFixed(1)} / ${duration}초`;host.querySelectorAll('[data-chapter]').forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)));
 }
 function loop(now){if(disposed)return;if(playing){cursor+=previous?(now-previous)/1000:0;if(cursor>=duration-.01){cursor=duration-.01;playing=false;play.textContent='처음부터 재생'}draw()}previous=now;raf=requestAnimationFrame(loop)}
 play.onclick=()=>{if(cursor>=duration-.02)cursor=0;playing=!playing;previous=0;play.textContent=playing?'일시정지':'재생';draw()};
 seek.oninput=()=>{cursor=Number(seek.value);playing=false;play.textContent='재생';draw()};
 host.querySelectorAll('[data-chapter]').forEach((b,i)=>b.onclick=()=>{cursor=i*6;playing=false;play.textContent='재생';draw()});
 host.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{camera=b.dataset.camera;host.querySelectorAll('[data-camera]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()});
 function visibility(){if(document.hidden){playing=false;play.textContent='재생';video.pause()}}document.addEventListener('visibilitychange',visibility);
 try{const [bg,stand,propList,walkIm]=await ready;images={bg,stand};props=Object.fromEntries(propList);walkSheet=walkIm;if(!disposed){draw();raf=requestAnimationFrame(loop)}}catch(e){caption.textContent=e.message;play.disabled=true;seek.disabled=true}
 return ()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);video.pause();video.removeAttribute('src');video.load()};
}
