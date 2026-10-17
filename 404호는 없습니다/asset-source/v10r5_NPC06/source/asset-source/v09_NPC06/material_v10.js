'use strict';
const {createCanvas,loadImage}=require('@napi-rs/canvas'),path=require('path'),old=require('./material_v09r');
const state={},cache=new Map(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function smooth(a,b,v){let t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}
function pixels(im){const c=createCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);return {c,g,d:g.getImageData(0,0,c.width,c.height)}}
function box(im,col,row,nc,nr){const {d}=pixels(im),w=im.width,h=im.height;let l=w,r=0,t=h,b=0;for(let y=Math.floor(row*h/nr);y<Math.floor((row+1)*h/nr);y++)for(let x=Math.floor(col*w/nc);x<Math.floor((col+1)*w/nc);x++)if(d.data[(y*w+x)*4+3]>128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}return {x:l,y:t,w:r-l+1,h:b-t+1}}
async function load(){for(const [key,file] of Object.entries({front:'NPC06_front_knee_v10.png',rear:'NPC06_rear_knee_v10.png',arms:'NPC06_sleeves_v10.png',torso:'NPC06_torso_turn_v10.png'}))state[key]=await loadImage(path.join(__dirname,'art_v10',file));}
function legMaterial(base,tk,flex,s,view){
 const key='leg'+view+s;let z=cache.get(key);
 if(!z){const im=state[view],r=box(im,s==='L'?0:1,0,2,1),c=createCanvas(base.width,base.height),g=c.getContext('2d');g.drawImage(im,r.x,r.y,r.w,r.h,0,0,c.width,c.height);z={c,g,paint:g.getImageData(0,0,c.width,c.height),original:pixels(base).d};cache.set(key,z)}
 const a=z.original.data,b=z.paint.data,out=z.g.createImageData(base.width,base.height),w=base.width,h=base.height;
 for(let y=0;y<h;y++){const v=y/(h-1),weight=smooth(tk-.25,tk-.08,v)*(1-smooth(tk+.12,tk+.28,v))*(view==='rear'?(.035+.30*smooth(10,55,flex)):(.06+.65*smooth(10,55,flex)));for(let x=0;x<w;x++){const i=(y*w+x)*4;for(let k=0;k<3;k++)out.data[i+k]=a[i+k]*(1-weight)+b[i+k]*weight;out.data[i+3]=a[i+3]}}
 z.g.putImageData(out,0,0);return z.c;
}
function armAtlas(original,rects,view){
 const key='arms'+view;if(cache.has(key))return cache.get(key);
 const {c,g,d:orig}=pixels(original),d=g.getImageData(0,0,c.width,c.height),col=['front','side','rear'].indexOf(view);
 for(const [row,s] of ['L','R'].entries()){const r=rects[s],nr=box(state.arms,col,row,3,2),p=createCanvas(r.w,r.h),q=p.getContext('2d');q.drawImage(state.arms,nr.x,nr.y,nr.w,nr.h,0,0,r.w,r.h);const b=q.getImageData(0,0,r.w,r.h).data;
 for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const j=(y*r.w+x)*4,i=((r.y+y)*c.width+r.x+x)*4,t=1-smooth(.60,.70,y/r.h);for(let k=0;k<3;k++)d.data[i+k]=orig.data[i+k]*(1-t)+b[j+k]*.92*t;d.data[i+3]=orig.data[i+3]}}
 g.putImageData(d,0,0);cache.set(key,c);return c;
}
function torso(g,atlas,r,a,w,h,o){
 const key='torso'+o.view;let z=cache.get(key);
 if(!z){const crops=[0,1].map(i=>box(state.torso,i,o.view==='front'?0:1,2,2));const base=createCanvas(r.w,r.h),bg=base.getContext('2d');bg.drawImage(atlas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);const paints=crops.map(q=>{const cv=createCanvas(r.w,r.h),cx=cv.getContext('2d');cx.drawImage(state.torso,q.x,q.y,q.w,q.h,0,0,r.w,r.h);return cx.getImageData(0,0,r.w,r.h).data});z={base,bg,orig:bg.getImageData(0,0,r.w,r.h).data,paints,full:createCanvas(atlas.width,atlas.height)};cache.set(key,z)}
 const {orig,paints}=z,p=paints[o.shoulderYaw>0?0:1],d=z.bg.createImageData(r.w,r.h),yaw=clamp(Math.abs(o.shoulderYaw)/8,0,1);
 for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const u=Math.abs(2*x/(r.w-1)-1),v=y/(r.h-1),i=(y*r.w+x)*4,weight=yaw*smooth(.35,.85,u)*smooth(.12,.30,v)*(1-smooth(.78,.94,v));for(let k=0;k<3;k++)d.data[i+k]=orig[i+k]*(1-weight)+p[i+k]*weight;d.data[i+3]=orig[i+3]}
 z.bg.putImageData(d,0,0);const ctx=z.full.getContext('2d');ctx.clearRect(0,0,z.full.width,z.full.height);ctx.drawImage(atlas,0,0);ctx.clearRect(r.x,r.y,r.w,r.h);ctx.drawImage(z.base,r.x,r.y);old.torso(g,z.full,r,a,w,h,o,true);
}
module.exports={load,legMaterial,armAtlas,torso};
