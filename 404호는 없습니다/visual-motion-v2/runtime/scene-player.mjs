/* Room 404 visual asset player v2. Pure, deterministic Canvas renderer.
   Backgrounds remain separate files. Does not change game decisions or save state. */
export const SIZE={width:960,height:640};
export const BACKGROUNDS={office:'guard-office',title:'title-night',lobby:'cctv-lobby',lobbySide:'cctv-lobby-side',hall:'cctv-hall',elevator:'cctv-elevator',stairs:'cctv-stairs',parking:'cctv-parking',door:'door-closed',doorOpen:'door-open',ledger:'ledger-desk',intercom:'intercom-desk',ending:'ending-dawn'};
export const PRESETS=[
 {id:'01-office-ambient',location:'office',mode:'ambient',label:'경비실 · 야간 대기'},
 {id:'02-title-rain',location:'title',mode:'rain',label:'시작 화면 · 빗줄기'},
 {id:'03-lobby-monitor',location:'lobby',mode:'ambient',label:'CCTV · 공동현관'},
 {id:'04-lobby-side-monitor',location:'lobbySide',mode:'ambient',label:'CCTV · 보조 카메라'},
 {id:'05-hall-monitor',location:'hall',mode:'ambient',label:'CCTV · 복도'},
 {id:'06-elevator-monitor',location:'elevator',mode:'ambient',label:'CCTV · 승강기'},
 {id:'07-stairs-monitor',location:'stairs',mode:'ambient',label:'CCTV · 계단실'},
 {id:'08-parking-monitor',location:'parking',mode:'ambient',label:'CCTV · 주차장'},
 {id:'09-door-comparison',location:'door',mode:'doorCompare',label:'현관문 · 닫힘/열림 비교',loop:false},
 {id:'10-ledger-inspection',location:'ledger',mode:'document',label:'명부 · 조사 표시'},
 {id:'11-intercom-ring',location:'intercom',mode:'ring',label:'인터폰 · 호출 표시'},
 {id:'12-ending-dawn',location:'ending',mode:'ambient',label:'결과 · 새벽 환경'},
 ...[1,2,3,4].map(i=>({id:`${12+i}-visitor-${String(i).padStart(2,'0')}-walk`,location:'lobby',mode:'walk',actor:i,label:`방문객 ${i} · 이동`,loop:true})),
 {id:'17-delayed-shadow',location:'hall',mode:'shadowHold',actor:1,label:'이상 현상 · 남아 있는 그림자'},
 {id:'18-duplicate-visitors',location:'lobby',mode:'double',actor:2,label:'이상 현상 · 같은 외형의 두 사람'},
 {id:'19-reflection-lag',location:'elevator',mode:'reflection',actor:3,label:'이상 현상 · 반사 지연'},
 {id:'20-signal-loss',location:'lobby',mode:'loading',label:'CCTV · 신호 복구',loop:false},
 {id:'21-infrared-view',location:'parking',mode:'ir',actor:4,label:'CCTV · 적외선 표현'},
 {id:'22-rain-double-image',location:'lobby',mode:'rainDouble',actor:1,label:'이상 현상 · 유리창 잔상'},
 {id:'23-door-open-ambient',location:'doorOpen',mode:'ambient',label:'현관문 · 열린 상태'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=x=>x-Math.floor(x);
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const rand=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
export async function loadAssets(loadImage,base='../'){
 const tasks=[];const assets={backgrounds:{},frames:{},props:{}};
 for(const [key,name] of Object.entries(BACKGROUNDS))tasks.push(loadImage(base+'images/'+name+'.png').then(im=>assets.backgrounds[key]=im));
 for(let i=1;i<=4;i++){assets.frames[i]=[];for(let f=1;f<=8;f++)tasks.push(loadImage(base+`images/visitor-${String(i).padStart(2,'0')}/walk-${String(f).padStart(2,'0')}.png`).then(im=>assets.frames[i][f-1]=im));}
 for(const name of ['hat','umbrella','mask','phone','parcel','glove'])tasks.push(loadImage(base+'images/props/'+name+'.png').then(im=>assets.props[name]=im));
 await Promise.all(tasks);return assets;
}
function label(ctx,text,x,y,w=270){ctx.fillStyle='rgba(4,14,12,.78)';ctx.fillRect(x,y,w,27);ctx.fillStyle='#d9e5d5';ctx.font='13px monospace';ctx.fillText(text,x+10,y+18,w-20)}
function noise(ctx,t,strength=.018){
 ctx.fillStyle=`rgba(207,228,213,${strength})`;
 const f=Math.floor(t*12);for(let i=0;i<150;i++){const n=i+f*199;ctx.fillRect(rand(n)*960,rand(n+1)*640,rand(n+2)*8+1,1);}
 ctx.fillStyle='rgba(0,8,4,.055)';for(let y=0;y<640;y+=4)ctx.fillRect(0,y,960,1);
}
function rain(ctx,t,area=[0,0,960,640],opacity=.17){
 ctx.save();ctx.beginPath();ctx.rect(...area);ctx.clip();ctx.strokeStyle=`rgba(206,224,227,${opacity})`;ctx.lineWidth=.8;
 for(let i=0;i<85;i++){const x=rand(i+99)*1080-60;const y=fract(rand(i+8)+t/6)*760-70;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+20+rand(i)*25);ctx.stroke();}ctx.restore();
}
function actor(ctx,a,id,x,y,h,t,{walk=false,alpha=1,flip=false,shadow=true,filter='none',prop='none',stationaryShadow=false}={}){
 const frame=walk?Math.floor(t*8)%8:1,im=a.frames[id]?.[frame];if(!im)return;
 const w=h*384/512;ctx.save();
 if(shadow){ctx.save();ctx.translate(stationaryShadow?340:x,y);ctx.scale(1,.25);ctx.fillStyle=`rgba(0,0,0,${alpha*.4})`;ctx.beginPath();ctx.ellipse(0,0,w*.25,19,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 ctx.globalAlpha=alpha;ctx.filter=filter;ctx.translate(x,y);if(flip)ctx.scale(-1,1);
 const breath=walk?0:Math.sin(t*Math.PI*2/3)*.7;
 ctx.drawImage(im,-w/2,-h*(496/512)+breath,w,h);ctx.restore();
 if(prop!=='none'&&a.props[prop]){const p=a.props[prop],ph={hat:h*.13,umbrella:h*.58,mask:h*.06,phone:h*.16,parcel:h*.22,glove:h*.10}[prop]||h*.2;
 const pw=ph*p.width/p.height;const offsets={hat:[-.02,-.92],mask:[.09,-.80],umbrella:[.2,-.51],phone:[.15,-.60],parcel:[.05,-.55],glove:[.14,-.53]};const [dx,dy]=offsets[prop]||[0,-.5];ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(p,x+dx*h-pw/2,y+dy*h, pw,ph);ctx.restore();}
}
export function renderScene(ctx,a,config,t,{overlay=true,reducedMotion=false}={}){
 const s=typeof config==='string'?PRESETS.find(p=>p.id===config):config;
 if(!s)throw Error('Unknown scene');
 const W=ctx.canvas.width,H=ctx.canvas.height;
 ctx.save();ctx.scale(W/960,H/640);
 t=Math.max(0,t);if(reducedMotion)t=0;
 const location=s.location||'lobby',mode=s.mode||'ambient',p=(t%6)/6;
 const im=a.backgrounds[location];if(!im)throw Error('Unknown background: '+location);
 ctx.drawImage(im,0,0,960,640);
 const camera=['lobby','lobbySide','hall','elevator','stairs','parking'].includes(location);
 // Ambient changes are low-amplitude, with zero camera drift or fake object movement.
 if(!reducedMotion){
  const glow=.012+.008*Math.sin(t*Math.PI/3);ctx.fillStyle=`rgba(166,194,168,${glow})`;ctx.fillRect(0,0,960,640);
  if(location==='office'){rain(ctx,t,[340,76,510,262],.10);ctx.fillStyle=`rgba(137,196,209,${.025+.018*Math.sin(t*Math.PI*2/3)})`;ctx.fillRect(0,222,189,160);}
  if(location==='title')rain(ctx,t);
 }
 if(mode==='doorCompare'){
  const amount=smooth((p-.28)/.14)*(1-smooth((p-.78)/.14));ctx.save();ctx.globalAlpha=amount;ctx.drawImage(a.backgrounds.doorOpen,0,0,960,640);ctx.restore();
 }
 let id=s.actor||0,walking=mode==='walk'||['shadowHold','rainDouble'].includes(mode),x=480,y=585,h=285;
 if(location==='elevator'){x=520;y=568;h=340;}
 if(location==='parking'){y=570;h=260;}
 if(location==='hall'){y=587;h=290;}
 if(walking){const q=p;x=-90+q*1140;h=285;y=582;}
 if(id&&mode!=='loading'&&mode!=='absent'){
  if(mode==='shadowHold'){
   ctx.save();ctx.fillStyle='rgba(0,0,0,.30)';ctx.translate(330,579);ctx.rotate(-.45);ctx.scale(1,.28);ctx.beginPath();ctx.ellipse(0,-95,35,125,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  if(mode==='double'){actor(ctx,a,id,385,y,h,t,{prop:s.prop});actor(ctx,a,id,665,y,h,t+.5,{prop:s.prop});}
  else {
   if(mode==='reflection'){actor(ctx,a,id,760,465,290,t-.7,{alpha:.21,flip:true,shadow:false,filter:'grayscale(1) blur(1px)'});}
   if(mode==='rainDouble')actor(ctx,a,id,x+28,y,h,t-.25,{walk:true,alpha:.22,shadow:false,filter:'blur(2px)'});
   actor(ctx,a,id,x,y,h,t,{walk:walking,prop:s.prop,shadow:mode!=='shadowHold',filter:mode==='ir'?'grayscale(1) brightness(1.7)':mode==='darkCoat'?'brightness(.5)':'none'});
  }
 }
 if(mode==='rainDouble'||mode==='rain')rain(ctx,t,[0,0,960,640],.12);
 if(mode==='ir'){ctx.fillStyle='rgba(173,210,186,.09)';ctx.fillRect(0,0,960,640);}
 if(mode==='loading'){
  const lost=p>.25&&p<.68;
  if(lost){ctx.fillStyle='#07100d';ctx.fillRect(0,0,960,640);noise(ctx,t,.24);if(overlay)label(ctx,'SIGNAL LOST / RECONNECTING',305,300,350);}
 }
 if(mode==='ring'&&location==='intercom'){
  const lit=Math.sin(t*Math.PI*2)>.1;ctx.save();ctx.fillStyle=lit?'rgba(165,209,157,.65)':'rgba(30,59,40,.35)';ctx.beginPath();ctx.moveTo(550,250);ctx.lineTo(671,247);ctx.lineTo(686,290);ctx.lineTo(558,296);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#dbebaf';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<26;i++){const xx=573+i*3.5,yy=274+Math.sin(i*.9+t*8)*(lit?7:1);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();ctx.restore();
 }
 if(location==='ledger'){
  const alpha=.10+.07*Math.sin(t*Math.PI*2/6);ctx.fillStyle=`rgba(217,177,78,${alpha})`;ctx.fillRect(205,293,233,18);
 }
 if(camera)noise(ctx,t,reducedMotion?0:.012);
 if(overlay&&camera){label(ctx,`CAM ${Object.keys(BACKGROUNDS).indexOf(location)-1}  ${location.toUpperCase()}`,18,18,260);label(ctx,`00:13:${String(Math.floor(t)%60).padStart(2,'0')}`,808,18,134);ctx.fillStyle='#b96052';ctx.beginPath();ctx.arc(779,31,4,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
export function mountPlayer(canvas,assets,config,{overlay=true,reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
 const ctx=canvas.getContext('2d');let frame=0,start=null,paused=false,elapsed=0;
 function step(now){if(start===null)start=now;if(!paused){elapsed=(now-start)/1000;renderScene(ctx,assets,config,elapsed,{overlay,reducedMotion});}frame=requestAnimationFrame(step)}
 frame=requestAnimationFrame(step);
 return {pause(){paused=true},play(){start=performance.now()-elapsed*1000;paused=false},seek(t){elapsed=t;start=performance.now()-t*1000;renderScene(ctx,assets,config,t,{overlay,reducedMotion})},dispose(){cancelAnimationFrame(frame)}};
}
