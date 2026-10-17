'use strict';
// NPC06 v09r: Claude's revision of the v09 material candidate (render_v06.js --art=v09r, NPC06 front/rear art only).
// Same inputs as v06/v09: the original parts atlas (asset-source/v05_QA/code/NPC06/assets), the rig and the camera.
// No pixel is painted in: every texel is an original atlas texel, resampled. Joint paths, contact and shadows are
// untouched; only how the pictures are mapped onto them changes.
//
// legTexture  The v06 leg texture cross-fades the thigh piece into the shin piece over the knee, so the rounded knee end
//             of the thigh (its dark outline) and the rounded top of the shin (its light rim) are both inside the fade:
//             a horizontal line at the knee, which v09's row stretch widens to the full leg. Here the thigh rows stop
//             above its rounded end and the shin rows start below its rounded top (the cap rows are found from the
//             row widths of the atlas piece); the few missing rows are mirrored fabric rows, so the knee UV of v06 is
//             kept (no vertical stretch). The silhouette: each row is resampled across to a width that follows the
//             original thigh down to mid-thigh, then runs straight to the shin's own width just below the knee, then
//             follows the original shin to the hem (no narrow neck, no bulge, hem unchanged). No colour wash is added.
// legMaterial Compression fold at the projected knee: the texture's knee row is the mesh's knee point, so the fold is
//             placed on it (front: soft crease just above the kneecap and light on the kneecap; rear: crease on the
//             joint line). Strength follows the knee angle continuously (no 0/30/60 picture states).
// torso       The v06/v09 torso is one picture rotated by the shoulder line about the waist. Here the hem follows the
//             pelvis line and the chest/shoulders follow the shoulder line, with a smooth twist between them, and the
//             picture is turned as a cylinder by the rig's shoulder (top) and hip (bottom) yaw: centre shift R*sin(yaw)
//             (about 2 px at the rig's 2.6 deg), edges and collar pinned. Content moves toward the receding shoulder
//             (v09 moved it the other way).
// torsoPoint  Screen point of a torso-picture coordinate under the same transform (used to seat the sleeve tops and the
//             bag strap on the painted shoulder instead of the rig shoulder point, which sits ~10 px above and outside
//             the painted cardigan shoulder).
const {createCanvas}=require('@napi-rs/canvas');
const cache=new Map();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function piece(atlas,r){
 const key='piece'+r.x+','+r.y;if(cache.has(key))return cache.get(key);
 const c=createCanvas(r.w,r.h),g=c.getContext('2d');g.drawImage(atlas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);const d=g.getImageData(0,0,r.w,r.h).data,rows=[],ws=[];
 for(let y=0;y<r.h;y++){let l=r.w,R=-1;for(let x=0;x<r.w;x++)if(d[(y*r.w+x)*4+3]>32){if(x<l)l=x;R=x}rows.push([l,R]);ws.push(R>=l?R-l+1:0)}
 const top=[];for(let x=0;x<r.w;x++){let y=0;while(y<r.h&&d[(y*r.w+x)*4+3]<128)y++;top.push(y)}
 const P={w:r.w,h:r.h,d,rows,ws,top};cache.set(key,P);return P;
}
// last thigh row above its rounded knee end / first shin row below its rounded top (width falls > 3 px under the
// width 13 rows in), with one row of margin for the outline
const capBottom=P=>{const ref=P.ws[P.h-14];let y=P.h-1;while(y>0&&P.ws[y]<ref-3)y--;return y-1};
const capTop=P=>{const ref=P.ws[13];let y=0;while(y<P.h-1&&P.ws[y]<ref-3)y++;return y+1};

// premultiplied RGBA of piece P at fractional row y, across-parameter t in [0,1] of that row's own extent
function sample(P,y,t,o){const y0=Math.floor(y),y1=Math.min(P.h-1,y0+1),fy=y-y0;o[0]=o[1]=o[2]=o[3]=0;
 for(const [yy,wy] of [[y0,1-fy],[y1,fy]]){if(wy<=0)continue;const [l,R]=P.rows[yy];if(R<l)continue;const sx=l+t*(R-l),x0=Math.floor(sx),x1=Math.min(P.w-1,x0+1),fx=sx-x0;
  for(const [xx,wx] of [[x0,1-fx],[x1,fx]]){const i=(yy*P.w+xx)*4,a=P.d[i+3]/255,w=wy*wx;o[0]+=P.d[i]*a*w;o[1]+=P.d[i+1]*a*w;o[2]+=P.d[i+2]*a*w;o[3]+=a*w}}
 return o}

function legTexture(atlas,rects,s,view,tk,shinScale,LW=128,LH=640){
 const key='leg'+view+s;if(cache.has(key))return cache.get(key);
 const T=piece(atlas,rects[s+'thigh']),Sh=piece(atlas,rects[s+'shin']),ct=capBottom(T),cs=capTop(Sh),d=.03;
 // v06 knee UV: thigh u in [-.075,1.075] over the piece, shin u in [-.065,1.065]; v = tk is the knee on both
 const rowT=v=>{let y=v/tk*1.075/1.15*(T.h-1);if(y>ct)y=2*ct-y;return clamp(y,0,T.h-1)};
 const rowS=v=>{let y=((v-tk)/(1-tk)*1.065+.065)/1.13*(Sh.h-1);if(y<cs)y=2*cs-y;return clamp(y,0,Sh.h-1)};
 const fill=(P,y,k)=>P.ws[Math.round(y)]/P.w*k;
 const vA=.5*tk,vB=tk+d,fA=fill(T,rowT(vA),1),fB=fill(Sh,rowS(vB),shinScale);
 const yb=tk+(.91*1.13-.065)/1.065*(1-tk),c=createCanvas(LW,LH),g=c.getContext('2d'),img=g.createImageData(LW,LH),D=img.data,a=[0,0,0,0],b=[0,0,0,0];
 for(let ty=0;ty<LH;ty++){const v=(ty+.5)/LH,F=v<=vA?fill(T,rowT(v),1):v>=vB?fill(Sh,rowS(v),shinScale):fA+(fB-fA)*(v-vA)/(vB-vA);
  const wT=1-smooth(tk-d,tk+d,v),tw=F*LW,left=(LW-tw)/2,fade=Math.min(1,v/(.126*tk))*(v>yb?1-(v-yb)/(1-yb):1);
  for(let x=0;x<LW;x++){const t=(x+.5-left)/tw;if(t<0||t>1)continue;let r=0,gg=0,bb=0,al=0;
   if(wT>0){sample(T,rowT(v),t,a);r+=a[0]*wT;gg+=a[1]*wT;bb+=a[2]*wT;al+=a[3]*wT}
   if(wT<1){sample(Sh,rowS(v),t,b);r+=b[0]*(1-wT);gg+=b[1]*(1-wT);bb+=b[2]*(1-wT);al+=b[3]*(1-wT)}
   const edge=Math.min(1,Math.min(t,1-t)*tw),A=al*edge*fade,i=(ty*LW+x)*4;
   if(al>0){D[i]=r/al;D[i+1]=gg/al;D[i+2]=bb/al}D[i+3]=Math.round(A*255)}}
 g.putImageData(img,0,0);const out={canvas:c,cut:{thigh_row:ct,thigh_rows:T.h,shin_row:cs,shin_rows:Sh.h},fill:{mid_thigh:+fA.toFixed(3),below_knee:+fB.toFixed(3)}};cache.set(key,out);return out;
}

function legMaterial(base,tk,flex,s,view){
 const key='mat'+view+s;let c=cache.get(key);if(!c){c=createCanvas(base.width,base.height);cache.set(key,c)}
 const g=c.getContext('2d'),w=c.width,h=c.height,bend=clamp(flex/60,0,1);
 g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);g.drawImage(base,0,0);g.globalCompositeOperation='source-atop';
 // [offset from the knee row, colour, strength at 60 deg, vertical half-size]: broad and faint, so it reads as cloth, not a line
 const lobes=view==='rear'?[[0,'0,0,0',.06,.028],[-.034,'255,255,255',.015,.026]]:[[-.006,'0,0,0',.055,.028],[.026,'255,255,255',.02,.024]];
 for(const [off,rgb,amp,sy] of lobes){g.save();g.translate(w*.5,h*(tk+off));g.rotate((s==='L'?1:-1)*.10);g.scale(w*.45,h*sy);
  const q=g.createRadialGradient(0,0,0,0,0,1);q.addColorStop(0,`rgba(${rgb},${amp*bend})`);q.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=q;g.fillRect(-1,-1,2,2);g.restore()}
 g.globalCompositeOperation='source-over';return c;
}

// Torso transform shared by the picture and torsoPoint. o: {view, shoulderRoll, pelvisRoll (rad), shoulderYaw, hipYaw (deg)}
const PIV=.85,TW0=.30,TW1=.85;
function torso(g,atlas,r,a,w,h,o,refresh=false){
 const sw=r.w,sh=r.h,px=Math.ceil(sw*.08),py=Math.ceil(sh*.06),ow=sw+2*px,oh=sh+2*py,key='torso'+r.x+','+r.y;
 if(refresh){cache.delete(key);cache.delete('piece'+r.x+','+r.y)}
 let st=cache.get(key);if(!st){const P=piece(atlas,r);st={P,dst:createCanvas(ow,oh)};cache.set(key,st)}
 const P=st.P,ctx=st.dst.getContext('2d'),img=ctx.createImageData(ow,oh),D=img.data,R=sw/2,k=.95,dth=o.shoulderRoll-o.pelvisRoll;
 for(let y=0;y<oh;y++){const vo=(y-py)/sh,tw=smooth(TW0,TW1,vo),th=dth*(1-tw),c=Math.cos(th),s=Math.sin(th),Y=y-py-PIV*sh;
  for(let x=0;x<ow;x++){const X=x-px-R;let sx=X*c+Y*s+R,sy=-X*s+Y*c+PIV*sh;
   const v=sy/sh,u=(sx-R)/R;
   if(Math.abs(u)<1){const psi=(o.shoulderYaw*(1-smooth(TW0,TW1,v))+o.hipYaw*smooth(TW0,TW1,v))*Math.PI/180,us=Math.sin(clamp(Math.asin(clamp(k*u,-1,1))+psi,-Math.PI/2,Math.PI/2))/k;
    sx=R+R*(u+(us-u)*(1-u**4)*smooth(0,.12,v))}
   if(sx<0||sy<0||sx>sw-1||sy>sh-1)continue;
   const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=sx-x0,fy=sy-y0;let rr=0,gg=0,bb=0,al=0;
   for(const [yy,wy] of [[y0,1-fy],[y1,fy]])for(const [xx,wx] of [[x0,1-fx],[x1,fx]]){const i=(yy*sw+xx)*4,aa=P.d[i+3]*wy*wx;rr+=P.d[i]*aa;gg+=P.d[i+1]*aa;bb+=P.d[i+2]*aa;al+=aa}
   const i=(y*ow+x)*4;if(al>0){D[i]=rr/al;D[i+1]=gg/al;D[i+2]=bb/al;D[i+3]=Math.round(al)}}}
 ctx.putImageData(img,0,0);const fx=w*a[2]/sw,fy=h*a[2]/sh;
 g.save();g.translate(a[0],a[1]+h*a[2]*PIV);g.rotate(o.pelvisRoll);g.imageSmoothingQuality='high';g.drawImage(st.dst,-(R+px)*fx,-(PIV*sh+py)*fy,ow*fx,oh*fy);g.restore();
}
// screen point of torso-picture coordinate (u in [-1,1] across, v in [0,1] down) for rows above the twist (shoulders)
function torsoPoint(a,w,h,r,o,u,v){
 const th=o.pelvisRoll+(o.shoulderRoll-o.pelvisRoll)*(1-smooth(TW0,TW1,v)),X=u*w*a[2]/2,Y=(v-PIV)*h*a[2];
 return [a[0]+X*Math.cos(th)-Y*Math.sin(th),a[1]+h*a[2]*PIV+X*Math.sin(th)+Y*Math.cos(th)];
}
// painted shoulder top of the torso picture at across-coordinate u (fraction of the picture height)
function torsoTop(atlas,r,u){const P=piece(atlas,r),x=clamp(Math.round((u+1)/2*(r.w-1)),0,r.w-1);return P.top[x]/r.h}
// strap apex of the bag picture: centre of the opaque pixels in its top 2 % of rows, as a fraction of the width
function strapApex(atlas,r){const P=piece(atlas,r),n=Math.max(2,Math.round(r.h*.02));let sx=0,c=0;for(let y=0;y<n;y++)for(let x=0;x<r.w;x++)if(P.d[(y*r.w+x)*4+3]>=128){sx+=x;c++}
 let top=0;while(top<r.h&&!P.ws[top])top++;return {x:c?sx/c/r.w:.5,y:top/r.h}}
// first row of the bag body (opaque pixels in a row >= 35 % of the widest row); rows above it are the strap loop
function strapSplit(atlas,r){const P=piece(atlas,r),cnt=[];for(let y=0;y<r.h;y++){let c=0;for(let x=0;x<r.w;x++)if(P.d[(y*r.w+x)*4+3]>=128)c++;cnt.push(c)}
 const mx=Math.max(...cnt);let k=0;while(k<r.h&&cnt[k]<.35*mx)k++;return k/r.h}
module.exports={legTexture,legMaterial,torso,torsoPoint,torsoTop,strapApex,strapSplit};

