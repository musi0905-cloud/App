'use strict';
// NPC06 opt-in material experiment. Original atlas files and world joints are immutable.
// This is a runtime 2.5D material deformation, not replacement art or a new animation rig.
const {createCanvas}=require('@napi-rs/canvas');
const cache=new Map(),normalized=new WeakMap();
function normalizeLeg(source){
 if(normalized.has(source))return normalized.get(source);
 const w=source.width,h=source.height,c=createCanvas(w,h),g=c.getContext('2d');g.drawImage(source,0,0);
 const data=g.getImageData(0,0,w,h),out=g.createImageData(w,h),bounds=[];
 for(let y=0;y<h;y++){let l=w,r=-1;for(let x=0;x<w;x++)if(data.data[(y*w+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x)}bounds.push([l,r])}
 const widths=bounds.slice(Math.floor(h*.15),Math.floor(h*.85)).map(([l,r])=>r-l+1).filter(v=>v>0).sort((a,b)=>a-b);
 const target=widths[Math.floor(widths.length/2)],left=(w-target)/2;
 // Remove the baked narrow thigh-end / wide shin-start silhouette step, without replacing the textile.
 // Each source scanline is resampled only horizontally; knee/hem vertical UV is unchanged.
 for(let y=0;y<h;y++){let [l,r]=bounds[y];if(r<l)continue;
  for(let x=0;x<w;x++){const t=(x-left)/target;if(t<0||t>1)continue;
   const sx=l+t*(r-l),a=Math.floor(sx),b=Math.min(w-1,a+1),f=sx-a,ix=(y*w+x)*4;
   for(let k=0;k<4;k++)out.data[ix+k]=data.data[(y*w+a)*4+k]*(1-f)+data.data[(y*w+b)*4+k]*f;
   const edge=Math.min(t,1-t)*target;out.data[ix+3]*=Math.min(1,Math.max(0,edge));
  }
 }
 g.putImageData(out,0,0);normalized.set(source,c);return c;
}
function legMaterial(source,kneeT,flex,side,view){
 const key=view+side;let c=cache.get(key);if(!c){c=createCanvas(source.width,source.height);cache.set(key,c)}
 const g=c.getContext('2d'),w=c.width,h=c.height;source=normalizeLeg(source);
 g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);g.drawImage(source,0,0);
 // Low-amplitude shading; no beige recolour, woven pattern, cuff or cutout is added.
 // Smooth amplitude, no straight/30/60 nearest-state switch.
 const bend=Math.min(1,Math.max(0,flex/60));
 g.globalCompositeOperation='source-atop';
 const volume=g.createLinearGradient(0,0,w,0);
 volume.addColorStop(0,'rgba(0,0,0,0.10)');volume.addColorStop(.38,'rgba(0,0,0,0)');volume.addColorStop(.58,'rgba(255,255,255,0.015)');volume.addColorStop(1,'rgba(0,0,0,0.07)');
 g.fillStyle=volume;g.fillRect(0,0,w,h);
 // Compression folds stay at the actual knee UV, and fade at the silhouette.
 // Separate light/dark lobes avoid a hard horizontal "knee band".
 for(const [offset,sgn] of [[-.022,1],[.024,-1]]){
  g.save();g.translate(w*.5,h*(kneeT+offset));g.rotate((side==='L'?1:-1)*.10);g.scale(w*.45,h*.014);
  const q=g.createRadialGradient(0,0,0,0,0,1);q.addColorStop(0,sgn>0?`rgba(0,0,0,${.14*bend})`:`rgba(255,255,255,${.035*bend})`);q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(-1,-1,2,2);g.restore();
 }
 g.globalCompositeOperation='source-over';return c;
}
function torso(g,image,r,a,w,h,roll,yawDeg){
 // Preserve collar/buttons/pattern from original crop. A shallow curved surface moves internal
 // texture with shoulder yaw; source silhouette, neck and hem stay pinned. No unseen side invented.
 const sw=r.w,sh=r.h,key='torso'+sw+'x'+sh;let pair=cache.get(key);
 if(!pair){pair=[createCanvas(sw,sh),createCanvas(sw,sh)];cache.set(key,pair)}
 const [src,dst]=pair,s=src.getContext('2d'),d=dst.getContext('2d');
 s.clearRect(0,0,sw,sh);s.drawImage(image,r.x,r.y,sw,sh,0,0,sw,sh);
 const input=s.getImageData(0,0,sw,sh),out=d.createImageData(sw,sh),yaw=Math.max(-8,Math.min(8,yawDeg))*Math.PI/180;
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
  const u=2*x/(sw-1)-1,v=y/(sh-1),shift=Math.sin(yaw)*sw*.20*(1-u*u)*Math.sin(Math.PI*v);
  const sx=Math.max(0,Math.min(sw-1,x-shift)),x0=Math.floor(sx),x1=Math.min(sw-1,x0+1),t=sx-x0,ix=(y*sw+x)*4;
  for(let k=0;k<4;k++)out.data[ix+k]=input.data[(y*sw+x0)*4+k]*(1-t)+input.data[(y*sw+x1)*4+k]*t;
 }
 d.putImageData(out,0,0);
 g.save();g.translate(a[0],a[1]+h*a[2]*.85);g.rotate(roll);g.drawImage(dst,-w*a[2]/2,-h*a[2]*.85,w*a[2],h*a[2]);g.restore();
}
module.exports={legMaterial,torso};
