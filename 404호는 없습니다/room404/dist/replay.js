// Deterministic, seekable in-game reconstruction. Each segment is a distinct source/time.
export const LOCATIONS={lobby:'공동현관',lobbySide:'현관 보조 카메라',hall:'안쪽 복도',elevator:'승강기',stairs:'계단실',parking:'주차장',door:'현관 문'};
export const MODES=['normal','compare','badge','double','shadow','shadowHold','faceLock','absent','yesterday','doorClosed','doorOpen','doorCompare','preMove','footprints','voiceEarly','voiceLate','clock7','repeat','reflection','recorded','live','dateOnly','ir','reboot','loading','delay3','rainDouble','rain','removeProp','idMatch','card','fingerprint','darkCoat','hairOld','distort','faceShadow','blurCard','document','phone','ring','echo'];
const media={};
// V001 walk cycle: 4x2 sheet of 384x512 frames, 8 fps. Per frame: torso centre x, foot line y, head top y (opaque pixels),
// so every frame is drawn at the same foot line and body centre instead of the raw frame box.
const WALK={src:'assets/visitor-v001-walk-8f.png',fps:8,w:384,h:512,visitors:['V001'],actions:['enter','cross','descend'],
 anchors:[[240,507,29],[196,506,27],[179,508,29],[168,507,28],[229,481,11],[199,483,12],[190,485,15],[174,480,13]]};
// Existing visitors.png cell (1024px tall): figure spans y 76-967, torso centre x 201 of 384.
const STAND={top:76,foot:967,centre:201,cellW:384,cellH:1024};
export function walkFrame(cursor){return Math.floor(cursor*WALK.fps)%8}
function load(src){return media[src]??=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('장면 이미지를 불러오지 못했습니다.'));im.src=src})}
export function shiftedTime(time,offset){const [h,m]=time.split(':').map(Number),n=(h*60+m+offset+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
export function sceneTime(frame,time){return shiftedTime(time,frame.offset+(frame.mode==='clock7'?-7:0))}
function previousDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
export async function mountReplay(host,{pack,visitor,time,date,scenes=pack.scenes,compact=false}){
 let disposed=false,raf=0,playing=false,cursor=0,previous=0;
 const duration=scenes.length*6;
 host.innerHTML=`<div class="replay-heading"><strong>당시 상황 다시 보기 · ${scenes.length}개 장면</strong><span>장면을 애니메이션으로 보여줘요</span></div><canvas class="replay-canvas" width="960" height="640" aria-label="사건별 CCTV 재현 장면"></canvas><p class="replay-caption" aria-live="polite"></p><div class="replay-controls"><button type="button" class="replay-play">재생</button><label>보고 싶은 순간<input class="replay-seek" type="range" min="0" max="${duration-.01}" step="0.01" value="0"></label><output class="replay-position">0 / ${duration}초</output></div><div class="replay-chapters">${scenes.map((s,i)=>`<button type="button" data-chapter="${i}" aria-pressed="${i===0}">${i+1}. ${LOCATIONS[s.location]}<small>${sceneTime(s,time)}</small></button>`).join('')}</div><p class="small">숫자 버튼을 누르면 그때의 장면으로 이동해요. 화면의 시간도 함께 보세요.</p>`;
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),caption=host.querySelector('.replay-caption'),seek=host.querySelector('input'),play=host.querySelector('.replay-play');
 let images;
 const ready=Promise.all(['assets/cctv-lobby.png','assets/apartment-scenes.png','assets/visitors.png','assets/mystery-props.png','assets/detail-scenes.png','assets/visitors-before-haircut.png'].map(load));
 const sprite=(Number(visitor.id.slice(1))-1)%4,walker=WALK.visitors.includes(visitor.id);
 let walkSheet=null;
 function badge(text,x,y,w=400){ctx.fillStyle='#07130eef';ctx.fillRect(x,y,w,38);ctx.fillStyle='#e7edcb';ctx.font='21px sans-serif';ctx.fillText(text,x+12,y+26,w-24)}
 function prop(kind,x,y,w,h,opacity=1){const index={hat:0,umbrella:1,mask:2,phone:3,parcel:4,glove:5}[kind];if(index===undefined)return;ctx.save();ctx.globalAlpha=opacity;const im=images[3],cw=im.width/3,ch=im.height/2;ctx.drawImage(im,index%3*cw,Math.floor(index/3)*ch,cw,ch,x,y,w,h);ctx.restore()}
 function actor(x,bottom,height,{alpha=1,flip=false,filter='none',propName='none',mode='normal',phase=0,shadowOnly=false,walk=-1}={}){
  const im=images[2],cw=im.width/4,width=height*cw/im.height;
  ctx.save();ctx.globalAlpha=alpha;ctx.filter=shadowOnly?'brightness(0) opacity(.7)':filter;ctx.translate(x,bottom);if(flip)ctx.scale(-1,1);
  if(walk>=0&&walkSheet){
   // Match the standing sprite's figure height, foot line and torso centre, then place this frame's own anchors there.
   const [cx,foot,top]=WALK.anchors[walk],unit=height/STAND.cellH,k=(STAND.foot-STAND.top)*unit/(foot-top);
   ctx.drawImage(walkSheet,walk%4*WALK.w,Math.floor(walk/4)*WALK.h,WALK.w,WALK.h,(STAND.centre-STAND.cellW/2)*unit-cx*k,-(STAND.cellH-STAND.foot)*unit-foot*k,WALK.w*k,WALK.h*k);
  }else ctx.drawImage(im,sprite*cw,0,cw,im.height,-width/2,-height,width,height);
  ctx.restore();
  if(shadowOnly)return;
  let removal=mode==='removeProp'?1-phase:1;
  if(propName==='hat')prop('hat',x-width*.39+phase*(mode==='removeProp'?65:0),bottom-height*.94+phase*(mode==='removeProp'?130:0),width*.78,height*.18,removal);
  if(propName==='mask')prop('mask',x-width*.22,bottom-height*.825+phase*(mode==='removeProp'?50:0),width*.46,height*.10,removal);
  if(propName==='umbrella')prop('umbrella',x+width*.12,bottom-height*.70,width*.7,height*.66,removal);
  if(propName==='phone')prop('phone',x+width*.15,bottom-height*.82,width*.33,height*.20);
  if(propName==='parcel')prop('parcel',x-width*.48,bottom-height*.53,width*.96,height*.28);
  if(propName==='glove')prop('glove',x+width*.22,bottom-height*.57,width*.5,height*.22);
 }
 function draw(){if(disposed||!images)return;const index=Math.min(scenes.length-1,Math.floor(cursor/6)),s=scenes[index],phase=(cursor-index*6)/6,mode=s.mode;
  ctx.clearRect(0,0,960,640);ctx.save();let pan=s.action==='pan'?Math.sin(phase*Math.PI)*90:0;
  if(s.location==='parking'||s.location==='door'){const tile=s.location==='parking'?0:mode==='doorClosed'?2:1,cw=images[4].width/3;ctx.drawImage(images[4],tile*cw,0,cw,images[4].height,0,0,960,640)}else if(s.location==='lobby'||s.location==='lobbySide'){if(s.location==='lobbySide')ctx.drawImage(images[0],images[0].width*.18,0,images[0].width*.82,images[0].height,0,0,960,640);else ctx.drawImage(images[0],-pan,0,960+Math.abs(pan),640)}else{const tile={elevator:0,hall:1,stairs:2}[s.location],cw=images[1].width/3;ctx.drawImage(images[1],tile*cw,0,cw,images[1].height,-pan,0,960+Math.abs(pan),640)}ctx.restore();
  let x=485,y=575,h=470;
  if(s.action==='enter'){x=200+phase*340;h=490-phase*185;y=605-phase*70}
  if(s.action==='cross'){x=240+phase*490;h=455;y=580+Math.sin(phase*20)*3}
  if(s.action==='descend'){x=720-phase*240;y=420+phase*170;h=300+phase*170}
  if(s.action==='turn'){x=480+Math.sin(phase*Math.PI)*28}
  if(mode==='repeat'){const q=(phase*2)%1;x=200+q*340;h=490-q*185;y=605-q*70}
  if(mode==='distort')h=540;
  const walk=walker&&walkSheet&&WALK.actions.includes(s.action)?walkFrame(cursor):-1,walkFlip=walk>=0&&s.action==='descend';
  const filter=mode==='darkCoat'?'brightness(.35)':mode==='ir'?'grayscale(1) contrast(1.9) brightness(2)':mode==='blurCard'?'blur(.6px)':'grayscale(.5) brightness(.9)';
  if(['shadow','shadowHold','faceShadow'].includes(mode)){ctx.save();ctx.translate(mode==='shadow'?x:280,570);ctx.transform(1,.15,-.6,.25,0,0);actor(0,0,470,{shadowOnly:true,walk,flip:walkFlip});ctx.restore()}
  if(mode==='footprints'){ctx.save();ctx.globalAlpha=.5;const im=images[2],cw=im.width/4;for(let j=0;j<6;j++)ctx.drawImage(im,sprite*cw+cw*.35,im.height*.88,cw*.3,im.height*.12,150+j*42,595-j*25,25,14);ctx.restore()}
  if(mode!=='absent'&&mode!=='loading'){
   if(mode==='double'){actor(335,y,h,{filter,propName:s.prop,mode,phase,walk,flip:walkFlip});actor(650,y,h,{filter,propName:s.prop,mode,phase,walk,flip:walkFlip})}
   else {actor(x,y,h,{filter,propName:s.prop,mode,phase,flip:walkFlip||s.action==='turn'&&phase>.5,walk});if(['reflection','rainDouble'].includes(mode))actor(mode==='reflection'?960-x:x+50,y,mode==='reflection'?h*.9:h,{alpha:mode==='reflection'?.35:.42,flip:mode==='reflection'!==walkFlip,filter:mode==='rainDouble'?'blur(5px)':filter,walk})}
  }
  if(s.action==='wave'||s.action==='knock'){prop('glove',x+55+Math.sin(phase*Math.PI*4)*25,y-h*.77,90,120)}
  if(mode==='faceLock'){const im=images[2],cw=im.width/4;ctx.drawImage(im,sprite*cw+cw*.27,im.height*.06,cw*.48,im.height*.2,450,140,85,120);ctx.strokeStyle='#e9c46f';ctx.strokeRect(450,140,85,120)}
  if(mode==='rain'||mode==='rainDouble'){ctx.save();ctx.strokeStyle='#becbc955';for(let i=0;i<20;i++){const xx=i*51;ctx.beginPath();ctx.moveTo(xx,(phase*640+i*67)%640);ctx.lineTo(xx-15,(phase*640+i*67)%640+70);ctx.stroke()}ctx.restore()}
  if(mode==='faceShadow'){ctx.save();ctx.fillStyle='#03080699';ctx.fillRect(x-25,y-h*.85,32,90);ctx.restore()}
  if(['card','idMatch','blurCard','hairOld','badge','fingerprint','document'].includes(mode)){
   const boxX=640;ctx.fillStyle='#d8dfd0';ctx.fillRect(boxX,300,300,210);ctx.fillStyle='#14251b';ctx.font='22px sans-serif';ctx.fillText(mode==='document'?'가져온 종이':mode==='fingerprint'?'지문 확인기':'기록과 비교',boxX+15,332,270);
   if(mode==='idMatch'||mode==='hairOld'){const im=mode==='hairOld'?images[5]:images[2],cw=im.width/4;ctx.drawImage(im,sprite*cw,0,cw,im.height,boxX+15,344,50,145);ctx.fillText(visitor.name,boxX+80,385,205);ctx.fillText('등록 사진',boxX+80,425,205)}
   else {ctx.save();if(mode==='blurCard')ctx.filter='blur(5px)';ctx.fillText(mode==='fingerprint'?'지문을 읽지 못했어요':mode==='document'?pack.document.field:'K-246 / B-238',boxX+15,380,270);ctx.fillText(visitor.name,boxX+15,425,270);ctx.restore()}
  }
  const states={doorClosed:'직접 확인: 문이 닫혀 있어요',doorOpen:'영상에서는 문이 열려 있어요',doorCompare:'같은 시간인데 문 상태가 달라요',recorded:'지금 영상 버튼에 옛 영상이 나와요',live:'녹화 버튼에 지금 영상이 나와요',reboot:'카메라를 껐다 켠 뒤 옛 화면',loading:'지금 화면을 불러오는 중…',dateOnly:'날짜가 아직 안 바뀌었어요',delay3:'3분 늦게 보이는 화면',clock7:'카메라 표시 시계',repeat:'같은 장면이 반복돼요',fingerprint:'장갑 때문에 지문이 안 읽혀요',ring:'문 앞 휴대전화도 같이 울려요',echo:'같은 말을 조금 늦게 따라 해요',voiceEarly:'음성: 손을 들었어요',voiceLate:'뒤늦게 영상의 손이 올라옴',preMove:'재생하기 전에 고개를 돌려요',compare:'같은 시간, 다른 장소',hairOld:'예전 사진과 지금 모습'};
  if(states[mode])badge(states[mode],20,530,600);
  if(mode==='ring'&&Math.floor(phase*10)%2===0){ctx.strokeStyle='#e8cf73';ctx.lineWidth=4;ctx.strokeRect(x+35,y-h*.84,65,100)}
  if(mode==='preMove'){ctx.save();ctx.translate(x,y-h*.8);ctx.rotate(Math.sin(phase*Math.PI)*.22);const im=images[2],cw=im.width/4;ctx.drawImage(im,sprite*cw+cw*.25,im.height*.06,cw*.5,im.height*.2,-50,-30,100,130);ctx.restore()}
  ctx.fillStyle='#07100a16';for(let yLine=0;yLine<640;yLine+=5)ctx.fillRect(0,yLine,960,1);
  badge(`${LOCATIONS[s.location]} · ${index+1}/${scenes.length}`,16,14,430);
  let recordedDate=mode==='yesterday'?previousDate(date):date;badge(`${recordedDate} ${sceneTime(s,time)}:${String(Math.floor(phase*6)).padStart(2,'0')}`,470,14,474);
  canvas.dataset.mode=mode;canvas.dataset.scene=String(index);canvas.dataset.time=sceneTime(s,time);canvas.dataset.location=s.location;canvas.dataset.walkFrame=String(walk);canvas.dataset.count=String(mode==='absent'||mode==='loading'?0:['double','reflection','rainDouble'].includes(mode)?2:1);
  caption.textContent=`장면 ${index+1} · ${s.note}`;seek.value=String(cursor);host.querySelector('output').textContent=`${cursor.toFixed(1)} / ${duration}초`;host.querySelectorAll('[data-chapter]').forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)));
 }
 function loop(now){if(disposed)return;if(playing){cursor+=previous?(now-previous)/1000:0;if(cursor>=duration-.01){cursor=duration-.01;playing=false;play.textContent='처음부터 재생'}draw()}previous=now;raf=requestAnimationFrame(loop)}
 play.onclick=()=>{if(cursor>=duration-.02)cursor=0;playing=!playing;previous=0;play.textContent=playing?'일시정지':'재생';draw()};
 seek.oninput=()=>{cursor=Number(seek.value);playing=false;play.textContent='재생';draw()};
 host.querySelectorAll('[data-chapter]').forEach((b,i)=>b.onclick=()=>{cursor=i*6;playing=false;play.textContent='재생';draw()});
 function visibility(){if(document.hidden){playing=false;play.textContent='재생'}}document.addEventListener('visibilitychange',visibility);
 try{images=await ready;if(walker)walkSheet=await load(WALK.src).catch(()=>null);if(!disposed){draw();raf=requestAnimationFrame(loop)}}catch(e){caption.textContent=e.message;play.disabled=true;seek.disabled=true}
 return ()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility)};
}
