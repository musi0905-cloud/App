// Internal QA viewer (not part of the game build). Clip mode: the v05 walk data on a background, three views, play /
// pause / frame step, overlays for foot pivot, floor and horizon, contact shadows, click areas and occluders. The figure
// layer is the imported sprite frames (atlas from the original 720x1280 PNGs, drawn on the fixed canvas), the rig skeleton,
// or the opaque review MP4 (NPC03/NPC09 only, a composite for review, never a transparent asset). The 'enter -> idle -> exit'
// view plays front 0-47, holds front 47 for one second (there is no idle art) and plays rear 0-47, so the seam is visible.
// v06 (판 selector): atlases of the render_v06.js frames (asset-source/v06_QA/<NPC>/atlas.json, scripts/import-v06-frames.py):
// front = enter clip, rear = exit clip, side = pass clip, and the whole enter -> settle -> idle -> turn -> start -> exit
// sequence as rendered, frame by frame, with the per-frame feet and shadows the renderer wrote. Speed: 24, 8 or 3 fps.
// Still mode: the game's own stage.js with an approved figure, enter -> idle -> leave, plus the same overlays.
import {mountStage,cameraOf} from '../dist/stage.js';
const $=id=>document.getElementById(id),DIST='../dist/',SRC='../../asset-source/';
const json=u=>fetch(u).then(r=>{if(!r.ok)throw Error(u+' '+r.status);return r.json()});
const [walk,layout,chars]=await Promise.all([json(DIST+'data/walk_clips.json'),json(DIST+'data/scene_layout.json'),json(DIST+'data/character_assets.json')]);
const W=720,F=1100*W/1080,HY=675*W/1080,K=walk.canvas.design_scale;
const world=(view,p)=>view==='front'?[-p[2],p[1],2.92-p[0]]:view==='rear'?[p[2],p[1],1.8+p[0]]:[.52-p[0],p[1],2.35];
const project=(view,p)=>{const [x,y,z]=world(view,p);return [(W/2+F*x/z)*K,(HY+F*(1.6-y)/z)*K]};
const BONES=[['head','neck'],['neck','Lshoulder'],['neck','Rshoulder'],['Lshoulder','Lelbow'],['Lelbow','Lwrist'],['Rshoulder','Relbow'],['Relbow','Rwrist'],['neck','root'],['root','Lhip'],['root','Rhip'],['Lhip','Lknee'],['Lknee','Lankle'],['Lankle','Lheel'],['Lheel','Ltoe'],['Lankle','Ltoe'],['Rhip','Rknee'],['Rknee','Rankle'],['Rankle','Rheel'],['Rheel','Rtoe'],['Rankle','Rtoe']];
const MP4={NPC03:'NPC03_BG02_3view_walk_review_v05.mp4',NPC09:'NPC09_BG02_3view_walk_review_v05.mp4'},VIEW_OFFSET={front:0,side:48,rear:96};
const st={npc:'NPC03',rev:'v05',fps:24,view:'front',bg:'BG02',cam:'full',source:'frames',frame:0,playing:false,ov:new Set(['foot','floor','shadow','click','occ'])};
const v06={},review06=await json(`${SRC}v06_QA/review_summary_v06.json`).catch(()=>null);
async function v06Of(npc){if(!(npc in v06))v06[npc]=await json(`${SRC}v06_QA/${npc}/atlas.json`).catch(()=>null);return v06[npc]}
const SEG_KO={enter:'입장',settle:'멈춤',idle:'대기',turn:'회전',start:'출발',exit:'퇴장',pass:'지나감'};
// v06 frame list for a view: atlas indices (seq = every frame of the sequence in render order).
function v06List(a,view){if(!a)return [];const c=a.clips;if(view==='seq')return Array.from({length:c.pass.offset},(_,i)=>i);const k={front:'enter',rear:'exit',side:'pass'}[view];return Array.from({length:c[k].frames},(_,i)=>c[k].offset+i)}
const review=await json(`${SRC}v05_QA/frame_qa/review_summary_v05.json`).catch(()=>null);
// Sequence view: enter (front 0-47), idle = front 47 held for 24 frames (no idle art in the package), exit (rear 0-47).
const SEQ=[...Array.from({length:48},(_,k)=>['front',k,'입장']),...Array.from({length:24},()=>['front',47,'대기(입장 마지막 프레임 유지 · 대기 원화 없음)']),...Array.from({length:48},(_,k)=>['rear',k,'퇴장'])];
const last=()=>st.rev==='v06'?Math.max(0,v06List(v06[st.npc],st.view).length-1):st.view==='seq'?SEQ.length-1:47;
const cur=()=>st.view==='seq'?{view:SEQ[st.frame][0],k:SEQ[st.frame][1],phase:SEQ[st.frame][2]}:{view:st.view,k:st.frame,phase:null};
const rigs={},configs={},frames={},images={};
const img=src=>images[src]||(images[src]=new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src}));
async function rigOf(npc){if(!rigs[npc]){configs[npc]=await json(`${SRC}v05_QA/code/${npc}/config.json`);rigs[npc]=await json(`${SRC}v05_QA/code/${npc}/${walk.npcs[npc].rig}`)}return {rig:rigs[npc],cfg:configs[npc]}}
async function framesOf(npc){if(!(npc in frames))frames[npc]=await json(`${SRC}v05_QA/frames/${npc}/atlas.json`).catch(()=>null);return frames[npc]}
// Pose as render.js builds it: joints scaled by height, the carrying arm (parcel/folder) hung statically on the shoulder.
function pose(rig,cfg,frame){const S=cfg.height_m/1.725,p=Object.fromEntries(Object.entries(rig.frames[frame].joints).map(([k,v])=>[k,v.map(x=>x*S)]));
 if(cfg.prop&&!['shoulderbag','crossbody'].includes(cfg.prop)){const sh=p.Lshoulder,hold=['parcel','folder'].includes(cfg.prop);p.Lwrist=[sh[0]+(hold?.25:.025)*S,sh[1]-(hold?.35:.545)*S,sh[2]];
  const v=p.Lwrist.map((x,i)=>x-sh[i]),d=Math.hypot(...v),u=v.map(x=>x/d),pole=[-1,0,0],dot=pole.reduce((a,x,i)=>a+x*u[i],0),n=pole.map((x,i)=>x-dot*u[i]),N=Math.hypot(...n),bend=Math.sqrt(Math.max(0,(.29*S)**2-d*d/4));p.Lelbow=sh.map((x,i)=>x+v[i]/2+n[i]/N*bend)}
 return p}
const canvas=$('clipCanvas'),ctx=canvas.getContext('2d'),video=$('video');
function fill(sel,items){sel.innerHTML=items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}
fill($('npc'),Object.entries(walk.npcs).map(([id,n])=>[id,`${id} · ${n.qa_status} · ${n.prop||'소품 없음'}`]));$('npc').value=st.npc;
fill($('bg'),Object.entries(layout.backgrounds).filter(([,b])=>b.file).map(([id,b])=>[id,`${id} ${b.name} (${b.era})`]));$('bg').value=st.bg;
const badge=(s,cls)=>`<span class="badge ${cls||(s==='PASS'?'pass':'')}">${s}</span>`;
function status(){const n=walk.npcs[st.npc],c=n.checks,b=layout.backgrounds[st.bg],f=frames[st.npc],r=review?.npcs?.[st.npc],m=c.seam_measured;
 $('clipStatus').innerHTML=`<h2>${st.npc} ${badge(n.qa_status)} ${n.revision}</h2><table>
 <tr><th>기술 출력</th><td>${badge(n.technical_export)} (프레임 수·크기·투명도 형식 검사, 패키지 기록)</td></tr>
 <tr><th>게임 적용</th><td>${badge(n.qa_status==='PASS'?'가능':'안 함',n.qa_status==='PASS'?'pass':'warn')} REVISE는 게임 화면에 쓰지 않음</td></tr>
 <tr><th>프레임</th><td>${f?f.frames:n.frames_in_hand} / ${n.frames_expected} (720x1280 RGBA, ${n.fps}fps, 방향당 ${n.frames})${f?'':' — 미반입'}</td></tr>
 <tr><th>리그</th><td>${n.rig} · 키 ${n.height_m}m · ${n.speed_m_s}m/s</td></tr>
 <tr><th>입장 끝 / 퇴장 시작</th><td>z ${c.enter_end_z} / ${c.exit_start_z} m · 차이 ${c.enter_exit_gap_m} m ${c.enter_exit_gap_m>.15?badge('이음 끊김','warn'):''}${m?`<br>실측(프레임): 가장 낮은 줄 +${m.lowest_row_px}px · 깊이 ${m.depth_from_lowest_row_m} m · 머리 폭 ${(m.head_width_change*100).toFixed(1)}%`:''}</td></tr>
 ${r?`<tr><th>프레임 검수 (${review.reviewed})</th><td>${['front','side','rear','sequence'].map(v=>`${{front:'정면',side:'측면',rear:'후면',sequence:'입장→대기→퇴장'}[v]} ${badge(r[v].status,r[v].status==='PASS'?'pass':'warn')} ${r[v].issues.join(', ')}`).join('<br>')}</td></tr>`:''}
 <tr><th>디딤발 미끄럼(리그)</th><td>${Object.entries(c.foot_slide_mm).map(([v,mm])=>`${v} ${mm}mm`).join(' · ')}</td></tr>
 ${n.carrying?`<tr><th>들고 있는 팔</th><td>${n.carrying.driver} 고정 · ${n.carrying.pose}<br>${n.carrying.status}</td></tr>`:''}
 <tr><th>남은 문제</th><td>${n.remaining.join('<br>')}</td></tr>
 <tr><th>배경</th><td>${st.bg} ${b.name} · ${b.era} · 보정 ${b.calibration}${st.bg!=='BG02'?` ${badge('클립은 BG02 카메라 기준','warn')}`:''}</td></tr>
 <tr><th>인물 레이어</th><td>${{rig:'리그 골격(움직임 데이터). 그림 아님.',mp4:'검토 영상(배경·인물·그림자가 합쳐진 불투명 MP4). 투명 에셋 아님. 데이터 겹쳐 보기 확인용.',frames:'스프라이트 프레임(원본 720x1280에서 만든 QA 아틀라스, 고정 캔버스, 프레임마다 다시 맞추지 않음)'}[st.source]}</td></tr></table>`;
 const mp4=$('source').querySelector('[value=mp4]'),fr=$('source').querySelector('[value=frames]');mp4.disabled=!MP4[st.npc];fr.disabled=!f;if((st.source==='mp4'&&mp4.disabled)||(st.source==='frames'&&fr.disabled)){st.source=fr.disabled?'rig':'frames';$('source').value=st.source}}
async function draw(){if(st.rev==='v06')return draw06();const n=walk.npcs[st.npc],{view,k,phase}=cur(),v=n.views[view],{bg,rect:cam}=cameraOf(layout,st.bg,st.cam);
 canvas.width=540;canvas.height=Math.round(540*cam[3]/cam[2]);const sx=canvas.width/cam[2];ctx.setTransform(sx,0,0,sx,-cam[0]*sx,-cam[1]*sx);ctx.fillStyle='#000';ctx.fillRect(cam[0],cam[1],cam[2],cam[3]);
 if(st.source==='mp4'&&MP4[st.npc]){await seek((VIEW_OFFSET[view]+k+.5)/24);ctx.drawImage(video,0,0,1080,1920)}
 else{ctx.drawImage(await img(DIST+bg.file),0,0,bg.size[0],bg.size[1]);
  if(st.source==='frames'&&frames[st.npc]){const a=frames[st.npc],c=a.clips[{front:'enter',rear:'exit',side:'pass'}[view]],r=a.rects[c.offset+k],im=await img(`${SRC}v05_QA/frames/${st.npc}/${a.src}`);
   for(const s of v.shadows[k])shadowFill(s);ctx.drawImage(im,r[0],r[1],r[2],r[3],r[4]*K,r[5]*K,r[2]/a.scale*K,r[3]/a.scale*K)}
  else{const {rig,cfg}=await rigOf(st.npc),p=pose(rig,cfg,k);for(const s of v.shadows[k])shadowFill(s);ctx.lineWidth=7;ctx.lineCap='round';
   for(const [a,b] of BONES){if(!p[a]||!p[b])continue;const A=project(view,p[a]),B=project(view,p[b]);ctx.strokeStyle=a.startsWith('L')||b.startsWith('L')?'#7fd1ff':a.startsWith('R')||b.startsWith('R')?'#ffb36b':'#f2f2f2';ctx.beginPath();ctx.moveTo(...A);ctx.lineTo(...B);ctx.stroke()}
   const h=project(view,p.head);ctx.fillStyle='#f2f2f2';ctx.beginPath();ctx.arc(h[0],h[1],18,0,7);ctx.fill()}}
 // overlays (design space)
 ctx.lineWidth=3;
 if(st.ov.has('floor')){line(bg.horizon_y,'#ff5ad1','수평선');line(bg.floor_line_y,'#5aff7a','바닥선');if(bg.floor){ctx.strokeStyle='#5aff7a88';ctx.setLineDash([12,10]);poly(bg.floor);ctx.stroke();ctx.setLineDash([])}}
 if(st.ov.has('shadow'))for(const [x,y,rx,ry] of v.shadows[k]){ctx.strokeStyle='#ffe14a';ctx.beginPath();ctx.ellipse(x*K,y*K,rx*K,ry*K,0,0,7);ctx.stroke()}
 if(st.ov.has('foot')){const [x,y]=v.feet[k];ctx.strokeStyle='#39ff5a';ctx.beginPath();ctx.moveTo(x*K-26,y*K);ctx.lineTo(x*K+26,y*K);ctx.moveTo(x*K,y*K-26);ctx.lineTo(x*K,y*K+26);ctx.stroke();ctx.strokeStyle='#39ff5a66';ctx.beginPath();v.feet.forEach(([fx,fy],i)=>i?ctx.lineTo(fx*K,fy*K):ctx.moveTo(fx*K,fy*K));ctx.stroke()}
 if(st.ov.has('click')){const b=v.bbox[k];ctx.strokeStyle='#ff4dff';ctx.strokeRect(b[0]*K,b[1]*K,(b[2]-b[0])*K,(b[3]-b[1])*K);for(const a of bg.click_areas||[])if(Array.isArray(a.rect)){ctx.strokeStyle='#4dd2ff';ctx.strokeRect(...a.rect)}}
 if(st.ov.has('occ'))for(const o of bg.occluders||[]){ctx.strokeStyle='#ff8a3d';ctx.setLineDash([16,8]);poly(o.polygon);ctx.stroke();ctx.setLineDash([])}
 if(st.ov.has('cam')){const c=bg.cameras.intercom;if(c){ctx.strokeStyle='#ffffff';ctx.setLineDash([20,12]);ctx.strokeRect(...c);ctx.setLineDash([])}}
 $('frame').max=last();$('frame').value=st.frame;$('frameLabel').textContent=`${phase?phase+' · ':''}${view} · 프레임 ${String(k).padStart(2,'0')} / 47 · ${(k/24).toFixed(3)}s · 발 (${v.feet[k].map(x=>(x*K).toFixed(0)).join(', ')}) · 역할 ${v.role}`;
 canvas.dataset.frame=st.frame;canvas.dataset.clipView=st.view;canvas.dataset.drawnView=view;canvas.dataset.drawnFrame=k;canvas.dataset.npc=st.npc;canvas.dataset.source=st.source}
async function draw06(){const a=v06[st.npc],{bg,rect:cam}=cameraOf(layout,st.bg,st.cam);canvas.width=540;canvas.height=Math.round(540*cam[3]/cam[2]);const sx=canvas.width/cam[2];ctx.setTransform(sx,0,0,sx,-cam[0]*sx,-cam[1]*sx);ctx.fillStyle='#000';ctx.fillRect(cam[0],cam[1],cam[2],cam[3]);
 ctx.drawImage(await img(DIST+bg.file),0,0,bg.size[0],bg.size[1]);if(!a){$('frameLabel').textContent='v06 아틀라스 없음 (scripts/import-v06-frames.py)';return}
 const list=v06List(a,st.view),idx=list[Math.min(st.frame,list.length-1)],d=a.data[idx],r=a.rects[idx],im=await img(`${SRC}v06_QA/${st.npc}/${a.src}`);
 for(const s of d.shadows)shadowFill(s);ctx.drawImage(im,r[0],r[1],r[2],r[3],r[4]*K,r[5]*K,r[2]/a.scale*K,r[3]/a.scale*K);ctx.lineWidth=3;
 if(st.ov.has('floor')){line(bg.horizon_y,'#ff5ad1','수평선');line(bg.floor_line_y,'#5aff7a','바닥선');if(bg.floor){ctx.strokeStyle='#5aff7a88';ctx.setLineDash([12,10]);poly(bg.floor);ctx.stroke();ctx.setLineDash([])}}
 if(st.ov.has('shadow'))for(const [x,y,rx,ry] of d.shadows){ctx.strokeStyle='#ffe14a';ctx.beginPath();ctx.ellipse(x*K,y*K,rx*K,ry*K,0,0,7);ctx.stroke()}
 if(st.ov.has('foot')&&d.feet){const [x,y]=d.feet;ctx.strokeStyle='#39ff5a';ctx.beginPath();ctx.moveTo(x*K-26,y*K);ctx.lineTo(x*K+26,y*K);ctx.moveTo(x*K,y*K-26);ctx.lineTo(x*K,y*K+26);ctx.stroke()}
 if(st.ov.has('click')){ctx.strokeStyle='#ff4dff';ctx.strokeRect(r[4]*K,r[5]*K,r[2]/a.scale*K,r[3]/a.scale*K);for(const x of bg.click_areas||[])if(Array.isArray(x.rect)){ctx.strokeStyle='#4dd2ff';ctx.strokeRect(...x.rect)}}
 if(st.ov.has('occ'))for(const o of bg.occluders||[]){ctx.strokeStyle='#ff8a3d';ctx.setLineDash([16,8]);poly(o.polygon);ctx.stroke();ctx.setLineDash([])}
 if(st.ov.has('cam')){const c=bg.cameras.intercom;if(c){ctx.strokeStyle='#ffffff';ctx.setLineDash([20,12]);ctx.strokeRect(...c);ctx.setLineDash([])}}
 $('frame').max=last();$('frame').value=st.frame;$('frameLabel').textContent=`v06 · ${SEG_KO[d.seg]} ${d.i} · ${d.art} 그림 · 몸 방향 ${d.heading}° · 프레임 ${st.frame} / ${last()} · ${(st.frame/24).toFixed(3)}s${d.feet?` · 발 (${d.feet.map(x=>(x*K).toFixed(0)).join(', ')})`:''}`;
 canvas.dataset.frame=st.frame;canvas.dataset.clipView=st.view;canvas.dataset.drawnView=d.art;canvas.dataset.drawnFrame=d.i;canvas.dataset.segment=d.seg;canvas.dataset.npc=st.npc;canvas.dataset.source='v06'}
function status06(){const a=v06[st.npc],r=review06?.npcs?.[st.npc];if(!a){$('clipStatus').innerHTML=`<h2>${st.npc} v06</h2><p>아틀라스 없음</p>`;return}const q=a.sequence;
 $('clipStatus').innerHTML=`<h2>${st.npc} ${badge(a.qa_status)} v06</h2><table>
 <tr><th>게임 적용</th><td>${badge('안 함','warn')} 정면·후면·연결이 모두 PASS인 클립만 게임에 씀(clipUsable)</td></tr>
 <tr><th>구간</th><td>${Object.entries(a.clips).map(([k,c])=>`${SEG_KO[k]} ${c.frames}`).join(' · ')} (24fps, 720x1280)</td></tr>
 <tr><th>경로</th><td>입장 끝 뿌리 (${q.enter_end_root_world.join(', ')}) · 선 자리 (${q.stand_point_world.join(', ')}) · 퇴장 시작 (${q.exit_start_root_world.join(', ')}) m<br>퇴장 경로는 회전 뒤 디딘 ${q.exit_pivot_foot} 발끝에서 시작(고정 상수 아님)</td></tr>
 ${r?`<tr><th>프레임 검수 (${review06.reviewed})</th><td>${['front','side','rear','sequence'].map(v=>`${{front:'정면',side:'측면',rear:'후면',sequence:'입장→대기→회전→퇴장'}[v]} ${badge(r[v].status,r[v].status==='PASS'?'pass':'warn')} ${r[v].issues.join(', ')}`).join('<br>')}</td></tr>`:''}
 <tr><th>고친 것</th><td>${Object.keys(a.fixes).join(', ')}</td></tr><tr><th>인물 레이어</th><td>v06 렌더 프레임(QA 아틀라스, 고정 캔버스, 프레임마다 다시 맞추지 않음)</td></tr></table>`;
 for(const v of ['rig','mp4'])$('source').querySelector(`[value=${v}]`).disabled=true;st.source='frames';$('source').value='frames'}
function line(y,color,label){if(y==null)return;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1080,y);ctx.stroke();ctx.fillStyle=color;ctx.font='28px sans-serif';ctx.fillText(label,12,y-8)}
function poly(pts){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}
function shadowFill([x,y,rx,ry,a]){ctx.save();ctx.translate(x*K,y*K);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx*K);g.addColorStop(0,`rgba(7,11,13,${a})`);g.addColorStop(1,'rgba(7,11,13,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx*K,0,7);ctx.fill();ctx.restore()}
function seek(t){return new Promise(ok=>{if(!video.src.endsWith(MP4[st.npc])){video.src=`${SRC}v05_QA/review/${MP4[st.npc]}`}const done=()=>{video.removeEventListener('seeked',done);ok()};const go=()=>{video.addEventListener('seeked',done);video.currentTime=t};if(video.readyState>=1)go();else video.addEventListener('loadedmetadata',go,{once:true})})}
// Playback: one pass by default (a moving clip never wraps); the loop box is for inspection only.
let timer=0,busy=false;
function play(on){st.playing=on;$('play').textContent=on?'❚❚ 멈춤':'▶ 재생';clearInterval(timer);if(on){if(st.frame>=last())st.frame=0;timer=setInterval(async()=>{if(busy)return;busy=true;if(st.frame>=last()){if($('loop').checked)st.frame=0;else{play(false);busy=false;return}}else st.frame++;await draw();busy=false},1000/st.fps)}}
const redraw=()=>{if(st.rev==='v06')status06();else status();draw()};
$('npc').onchange=async e=>{st.npc=e.target.value;await framesOf(st.npc);if(st.rev==='v06')await v06Of(st.npc);st.frame=Math.min(st.frame,last());redraw()};
$('rev').onchange=async e=>{play(false);st.rev=e.target.value;await v06Of(st.npc);st.frame=0;if(st.rev==='v05')for(const v of ['rig','mp4'])$('source').querySelector(`[value=${v}]`).disabled=false;redraw()};$('speed').onchange=e=>{st.fps=Number(e.target.value);if(st.playing)play(true)};$('bg').onchange=e=>{st.bg=e.target.value;redraw()};$('cam').onchange=e=>{st.cam=e.target.value;redraw()};$('source').onchange=e=>{st.source=e.target.value;redraw()};
document.querySelectorAll('button[data-view]').forEach(b=>b.onclick=()=>{play(false);st.view=b.dataset.view;st.frame=Math.min(st.frame,last());document.querySelectorAll('button[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()});
document.querySelectorAll('[data-ov]').forEach(c=>c.onchange=()=>{c.checked?st.ov.add(c.dataset.ov):st.ov.delete(c.dataset.ov);draw()});
$('prev').onclick=()=>{play(false);st.frame=Math.max(0,st.frame-1);draw()};$('next').onclick=()=>{play(false);st.frame=Math.min(last(),st.frame+1);draw()};$('play').onclick=()=>play(!st.playing);$('frame').oninput=e=>{play(false);st.frame=Number(e.target.value);draw()};
document.addEventListener('keydown',e=>{if(e.target.closest('select,input'))return;if(e.key==='ArrowLeft')$('prev').click();else if(e.key==='ArrowRight')$('next').click();else if(e.key===' '){e.preventDefault();$('play').click()}});
// Still-mode figures exist before the mode buttons work: the frame atlases load after this (await below), and a click on
// 'still' during that load used to reach figures/stage before their declarations (intermittent ReferenceError).
const figures=[...Object.entries(chars.assets).filter(([,a])=>a.figure).map(([id,a])=>[id,a.figure,`${id} ${a.name} (승인 PASS)`]),...Object.entries(chars.visitor_role_figures||{}).map(([id,a])=>[id,a.figure,`${id} ${a.name} (승인 PASS · 게임 꺼짐)`]),...Object.entries(chars.legacy.figures).map(([id,f])=>[id,f,`${id} (레거시 v2, 게임 방문객)`])];
fill($('figure'),figures.map(([id,,t])=>[id,t]));
let stage=null;
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));$('clipMode').hidden=b.dataset.mode!=='clip';$('stillMode').hidden=b.dataset.mode!=='still';play(false);if(b.dataset.mode==='still')still()});
await Promise.all(Object.keys(walk.npcs).map(framesOf));await v06Of(st.npc);redraw();

// ---- still mode: the game's stage.js ---------------------------------------------------------------------------------
function still(){const [id,f]=figures.find(x=>x[0]===$('figure').value),[bgId,cam,stand]=$('scene').value.split(':'),host=$('stillStage');stage?.destroy();host.innerHTML='';host.style.aspectRatio=`${layout.backgrounds[bgId].cameras[cam][2]}/${layout.backgrounds[bgId].cameras[cam][3]}`;
 stage=mountStage(host,{layout,background:bgId,camera:cam,stand,base:DIST,actor:{kind:'still',id,src:f.file,size:f.size,foot:f.foot,height_px:f.height_px,height_m:f.height_m},areas:[{id:'figure',rect:'figure',label:'인물 클릭 영역',onClick:()=>{$('sState').textContent+=' · 클릭됨'}}]});
 stage.enter().then(()=>{overlay();stillStatus(id,f,bgId,cam,stand);tick()});tick()}
function tick(){if(!stage)return;$('sState').textContent=`상태: ${stage.state}`;$('stillStage').dataset.qaState=stage.state;overlay();if(stage.state==='enter'||stage.state==='exit')requestAnimationFrame(tick)}
function overlay(){const c=$('stillOverlay'),host=$('stillStage'),r=host.getBoundingClientRect();c.width=r.width;c.height=r.height;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);if(!stage||!$('sOverlay').checked)return;
 const d=stage.debug(),[cx,cy,cw]=d.cam,s=r.width/cw,bg=layout.backgrounds[d.background];g.setTransform(s,0,0,s,-cx*s,-cy*s);g.lineWidth=2/s;
 g.strokeStyle='#ff5ad1';g.beginPath();g.moveTo(0,bg.horizon_y);g.lineTo(1080,bg.horizon_y);g.stroke();g.strokeStyle='#5aff7a';g.beginPath();g.moveTo(0,bg.floor_line_y);g.lineTo(1080,bg.floor_line_y);g.stroke();
 for(const o of bg.occluders||[]){g.strokeStyle='#ff8a3d';g.beginPath();o.polygon.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.stroke()}
 if(d.placed){const b=d.placed.box;g.strokeStyle='#ff4dff';g.strokeRect(b[0],b[1],b[2]-b[0],b[3]-b[1]);const sp=bg.stand_points[$('scene').value.split(':')[2]];g.strokeStyle='#39ff5a';g.beginPath();g.moveTo(sp.x-30,sp.y);g.lineTo(sp.x+30,sp.y);g.moveTo(sp.x,sp.y-30);g.lineTo(sp.x,sp.y+30);g.stroke();for(const [x,y,rx,ry] of d.placed.shadows){g.strokeStyle='#ffe14a';g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.stroke()}}}
function stillStatus(id,f,bgId,cam,stand){const d=stage.debug(),a=chars.assets[id]||chars.visitor_role_figures?.[id];$('stillStatus').innerHTML=`<h2>${id} ${badge(a?'PASS':'LEGACY',a?'pass':'')}</h2><table>
 <tr><th>파일</th><td>${f.file} · ${f.size.join('x')} · 발 (${f.foot.join(', ')}) · 키 ${f.height_px}px</td></tr><tr><th>키</th><td>${f.height_m} m ${f.height_note?'[DESIGN]':''}</td></tr>
 <tr><th>서 있는 곳</th><td>${bgId} ${stand} · z ${d.placed.z.toFixed(3)} m · 그림 높이 ${(f.height_px*d.placed.scale).toFixed(0)} 설계 px</td></tr>
 <tr><th>캔버스</th><td>${d.canvas.join('x')} 픽셀 · 카메라 ${cam} [${d.cam.join(', ')}]</td></tr><tr><th>걷기</th><td>클립 없음: 정지 대기. 입장·퇴장은 제자리 불투명도만 바뀜.</td></tr></table>`}
$('figure').onchange=still;$('scene').onchange=still;$('sEnter').onclick=()=>{stage?.enter();tick()};$('sLeave').onclick=()=>{stage?.leave();tick()};$('sReset').onclick=still;$('sOverlay').onchange=overlay;
window.qa={st,walk,draw,still:()=>stage};
