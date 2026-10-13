const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const ROOT=process.argv[2]||__dirname,CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'config.json'))),ID=CFG.id,W=720,H=1280,F=1100*W/1080,HY=675*W/1080;
const names=['head','torso','pelvis','Lupperarm','Lforearm','Lhand','Rupperarm','Rforearm','Rhand','Lthigh','Lshin','Lshoe','Rthigh','Rshin','Rshoe','prop'];
const rig=JSON.parse(fs.readFileSync(path.join(ROOT,CFG.rig_path||'walk_rig_scene_retimed_v01.json')));
const camera={width:W,height:H,focal_px:F,horizon_y:HY,camera_height_m:1.6,door_plane_z_m:3.09,paths:{front:{start_z:2.92},side:{start_x:.52,z:2.35},rear:{start_z:1.8}}};
const configs={};
async function main(){
 const cb=JSON.parse(fs.readFileSync(path.join(ROOT,'carrying_binding_v05.json'))),carryImage=await loadImage(path.join(ROOT,cb.file));
 const bg=await loadImage(path.join(ROOT,'assets/BG02_shared_entrance_night_v01.webp'));
 for(const view of (process.env.VIEW?[process.env.VIEW]:['front','side','rear'])){
  fs.mkdirSync(path.join(ROOT,'renders',view),{recursive:true});fs.mkdirSync(path.join(ROOT,'sprites',view),{recursive:true});
  const atlas=await loadImage(path.join(ROOT,`assets/${ID}_3view_parts_atlas_v01.png`));
  const scan=createCanvas(atlas.width,atlas.height),sc=scan.getContext('2d');sc.drawImage(atlas,0,0);
  const pix=sc.getImageData(0,0,atlas.width,atlas.height).data;
  // Atlas import: find each disconnected painted component; store UV rectangles only.
  // Do not crop cells blindly: generator spacing is not perfectly uniform.
  const seen=new Uint8Array(atlas.width*atlas.height),components=[];
  for(let seed=0;seed<seen.length;seed++){
   if(seen[seed]||pix[seed*4+3]<32)continue;
   let stack=[seed],count=0,l=atlas.width,r=0,t=atlas.height,b=0,sx=0,sy=0;seen[seed]=1;
   while(stack.length){let i=stack.pop(),x=i%atlas.width,y=Math.floor(i/atlas.width);count++;sx+=x;sy+=y;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    for(const j of [x>0?i-1:-1,x<atlas.width-1?i+1:-1,y>0?i-atlas.width:-1,y<atlas.height-1?i+atlas.width:-1])if(j>=0&&!seen[j]&&pix[j*4+3]>=32){seen[j]=1;stack.push(j)}
   }
   if(count>500)components.push({count,cx:sx/count,cy:sy/count,x:l,y:t,w:r-l+1,h:b-t+1});
  }
  const rects={};
  for(let n=0;n<(CFG.prop?16:15);n++){
   const row=Math.floor(n/4),col=n%4,items=components.filter(c=>Math.floor(c.cy/atlas.height*4)===row).sort((a,b)=>a.cx-b.cx),expected=row===3&&!CFG.prop?9:12;
   if(items.length!==expected)throw Error('Atlas row '+row+' component count '+items.length+' expected '+expected);
   const picked=items[['front','side','rear'].indexOf(view)*(row===3&&!CFG.prop?3:4)+col];
   const {x,y,w,h}=picked;rects[names[n]]={x,y,w,h};
  }
  let torsoImage=null,torsoRect=null;const torsoPath=fs.existsSync(path.join(ROOT,`assets/${ID}_3view_torso_v03.png`))?path.join(ROOT,`assets/${ID}_3view_torso_v03.png`):path.join(ROOT,`assets/${ID}_3view_torso_v02.png`);
  if(fs.existsSync(torsoPath)){torsoImage=await loadImage(torsoPath);const cv=createCanvas(torsoImage.width,torsoImage.height),cx=cv.getContext('2d');cx.drawImage(torsoImage,0,0);const a=cx.getImageData(0,0,cv.width,cv.height).data,cell=['front','side','rear'].indexOf(view);let l=cv.width,r=0,t=cv.height,b=0;for(let y=0;y<cv.height;y++)for(let x=Math.floor(cell*cv.width/3);x<Math.floor((cell+1)*cv.width/3);x++)if(a[(y*cv.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}torsoRect={x:l,y:t,w:r-l+1,h:b-t+1};}

  let armAtlas=null,armRects={};const armPath=path.join(ROOT,`assets/${ID}_continuous_arms_v03.png`);
  if(fs.existsSync(armPath)){
   armAtlas=await loadImage(armPath);const cv=createCanvas(armAtlas.width,armAtlas.height),cx=cv.getContext('2d');cx.drawImage(armAtlas,0,0);const a=cx.getImageData(0,0,cv.width,cv.height).data;
   const col=['front','side','rear'].indexOf(view),rows=ID==='NPC04'?3:2,offset=ID==='NPC04'?1:0;
   for(const [j,side] of ['L','R'].entries()){let l=cv.width,r=0,t=cv.height,b=0;for(let y=Math.floor((ID==='NPC04'?[.28,.65][j]:(j+offset)/rows)*cv.height);y<Math.floor((ID==='NPC04'?[.64,1][j]:(j+offset+1)/rows)*cv.height);y++)for(let x=Math.floor(col*cv.width/3);x<Math.floor((col+1)*cv.width/3);x++)if(a[(y*cv.width+x)*4+3]>64){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}armRects[side]={x:l,y:t,w:r-l+1,h:b-t+1};}
  }
  let shoeImage=atlas,shoeRects={L:rects.Lshoe,R:rects.Rshoe};
  // Runtime alpha overlap reduces rigid cap seams without modifying source atlases.
  const blendParts={};
  for(const name of ['Lupperarm','Rupperarm','Lthigh','Rthigh','Lshin','Rshin','pelvis']){
   const r=rects[name],cv=createCanvas(r.w,r.h),cx=cv.getContext('2d');cx.drawImage(atlas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
   const gradient=cx.createLinearGradient(0,0,0,r.h);gradient.addColorStop(0,name!=='pelvis'?'rgba(255,255,255,0)':'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,1)');gradient.addColorStop(name==='pelvis'?.75:.91,'rgba(255,255,255,1)');gradient.addColorStop(1,'rgba(255,255,255,0)');cx.globalCompositeOperation='destination-in';cx.fillStyle=gradient;cx.fillRect(0,0,r.w,r.h);blendParts[name]=cv;
  }
  configs[view]={continuous_arm_atlas:armAtlas?`assets/${ID}_continuous_arms_v03.png`:null,armRects,atlas:`assets/${ID}_3view_parts_atlas_v01.png`,rects,shoeRects,shoe_atlas:null,torso_override:torsoImage?{file:path.relative(ROOT,torsoPath),rect:torsoRect}:null};
  const world=p=>view==='front'?[-p[2],p[1],2.92-p[0]]:view==='rear'?[p[2],p[1],1.8+p[0]]:[.52-p[0],p[1],2.35];
  const project=p=>{const [x,y,z]=world(p);return [W/2+F*x/z,HY+F*(1.6-y)/z,F/z]};
  for(const frame of (process.env.FRAMES?process.env.FRAMES.split(',').map(Number):Array.from({length:48},(_,i)=>i))){
   const pose=rig.frames[frame],S=CFG.height_m/1.725,p=Object.fromEntries(Object.entries(pose.joints).map(([k,v])=>[k,v.map(x=>x*S)]));
   if(CFG.prop && !['shoulderbag','crossbody'].includes(CFG.prop)){
    // Carrying arm is deliberately stabilized; opposite arm keeps walking swing.
    const sh=p.Lshoulder,hold=['parcel','folder'].includes(CFG.prop);p.Lwrist=[sh[0]+(hold?.25:.025)*S,sh[1]-(hold?.35:.545)*S,sh[2]];
    const v=p.Lwrist.map((x,i)=>x-sh[i]),d=Math.hypot(...v),u=v.map(x=>x/d),pole=[-1,0,0],dot=pole.reduce((a,x,i)=>a+x*u[i],0),n=pole.map((x,i)=>x-dot*u[i]),N=Math.hypot(...n),bend=Math.sqrt((.29*S)**2-d*d/4);p.Lelbow=sh.map((x,i)=>x+v[i]/2+n[i]/N*bend);
   }

   const art=createCanvas(W,H),g=art.getContext('2d');g.imageSmoothingEnabled=true;
   function part(name,a,b,width,over=.08,endScreen=null){
    const u=project(a),v=endScreen||project(b),dx=v[0]-u[0],dy=v[1]-u[1],len=Math.hypot(dx,dy),r=rects[name],scale=(u[2]+v[2])/2;
    g.save();g.translate(u[0],u[1]);g.rotate(Math.atan2(dy,dx)-Math.PI/2);if(blendParts[name])g.drawImage(blendParts[name],-width*scale/2,-len*over,width*scale,len*(1+2*over));else g.drawImage(atlas,r.x,r.y,r.w,r.h,-width*scale/2,-len*over,width*scale,len*(1+2*over));g.restore();
   }
   function fixed(name,pos,w,h,bottom=false){const a=project(pos),r=rects[name];if(name==='torso'&&torsoImage){const q=torsoRect;g.save();g.translate(a[0],a[1]+h*a[2]*.85);g.rotate(view==='side'?0:Math.sin(frame/48*Math.PI*2)*.018);g.drawImage(torsoImage,q.x,q.y,q.w,q.h,-w*a[2]/2,-h*a[2]*.85,w*a[2],h*a[2]);g.restore();return;}if(blendParts[name])g.drawImage(blendParts[name],a[0]-w*a[2]/2,a[1]-(bottom?h:0)*a[2],w*a[2],h*a[2]);else g.drawImage(atlas,r.x,r.y,r.w,r.h,a[0]-w*a[2]/2,a[1]-(bottom?h:0)*a[2],w*a[2],h*a[2]);}
   function shoe(s){
    const heel=project(p[s+'heel']),toe=project(p[s+'toe']),ankle=project(p[s+'ankle']);
    const r=shoeRects[s];
    if(view==='side'){
     const len=Math.hypot(toe[0]-heel[0],toe[1]-heel[1]);g.save();g.translate(heel[0],heel[1]);g.rotate(Math.atan2(toe[1]-heel[1],toe[0]-heel[0])-Math.PI);if((CFG.flip_side_shoes||[]).includes(s)){g.scale(-1,1);g.drawImage(atlas,r.x,r.y,r.w,r.h,0,-.105*ankle[2],len,.105*ankle[2]);}else g.drawImage(atlas,r.x,r.y,r.w,r.h,-len,-.105*ankle[2],len,.105*ankle[2]);g.restore();
    }else{const y=Math.max(heel[1],toe[1]),h=.108*S*ankle[2];g.drawImage(shoeImage,r.x,r.y,r.w,r.h,ankle[0]-.073*ankle[2],y-h,.146*ankle[2],h);}
   }
   function leg(s){shoe(s);let end=null;
    if(view!=='side'){const heel=project(p[s+'heel']),toe=project(p[s+'toe']),ankle=project(p[s+'ankle']);end=[ankle[0],Math.max(heel[1],toe[1])-.077*S*ankle[2],ankle[2]];}
    part(s+'shin',p[s+'knee'],[p[s+'ankle'][0],p[s+'ankle'][1]+.045*S,p[s+'ankle'][2]],(view==='side'?.165:.17)*S,.065,end);part(s+'thigh',p[s+'hip'],p[s+'knee'],(view==='side'?.174:.185)*S,.075);
   }

   function meshArm(side){
    const r=armRects[side],sh=project(p[side+'shoulder']),el=project(p[side+'elbow']),wr=project(p[side+'wrist']);
    sh[1]+=(view==='side'?-.005:.035)*S*sh[2];if(view==='side')sh[0]+=.025*S*sh[2];
    let dx=wr[0]-el[0],dy=wr[1]-el[1],len=Math.hypot(dx,dy),end=[wr[0]+dx/len*.12*S*wr[2],wr[1]+dy/len*.12*S*wr[2],wr[2]];
    const pts=[sh,el,wr,end],ts=[0,.43,(CFG.arm_wrist_fraction||.74),1];let maxT=1;if(side==='L'&&CFG.prop&&!['shoulderbag','crossbody'].includes(CFG.prop))maxT=['parcel','folder'].includes(CFG.prop)?.43:(CFG.arm_wrist_fraction||.74);
    function center(t){let j=t<ts[1]?0:t<ts[2]?1:2,z=(t-ts[j])/(ts[j+1]-ts[j]),h=ts[j+1]-ts[j];return pts[j].map((v,k)=>{const a=Math.max(0,j-1),b=Math.min(3,j+2),m0=(pts[j+1][k]-pts[a][k])/(ts[j+1]-ts[a]),m1=(pts[b][k]-pts[j][k])/(ts[b]-ts[j]);return (2*z*z*z-3*z*z+1)*v+(z*z*z-2*z*z+z)*h*m0+(-2*z*z*z+3*z*z)*pts[j+1][k]+(z*z*z-z*z)*h*m1})}
    // Continuous texture is deformed in narrow strips along actual two-bone arm.
    for(let i=0;i<48;i++){const t=i/48;if(t>=maxT)break;const t2=Math.min((i+1)/48,maxT),a=center(t),b=center(t2),dX=b[0]-a[0],dY=b[1]-a[1],L=Math.hypot(dX,dY),width=.132*S*(a[2]+b[2])/2;
      g.save();g.translate(a[0],a[1]);g.rotate(Math.atan2(dY,dX)-Math.PI/2);g.drawImage(armAtlas,r.x,r.y+r.h*t,r.w,Math.max(1,r.h*(t2-t)),-width/2,-.3,width,L+.6);g.restore();}
   }
   function arm(s){
    if(s==='L')return; // unified shoulder-through-grip asset is drawn by drawProp

    if(armAtlas){meshArm(s);return;}
    if(s==='L'&&['parcel','folder'].includes(CFG.prop)){part(s+'upperarm',p[s+'shoulder'],p[s+'elbow'],.135*S,.08);return;}
    const w=p[s+'wrist'],e=p[s+'elbow'];const dir=[w[0]-e[0],w[1]-e[1],w[2]-e[2]],L=Math.hypot(...dir);const handend=w.map((v,i)=>v+dir[i]*.155/L);
    if(!(s==='L'&&CFG.prop&&!['shoulderbag','crossbody'].includes(CFG.prop)))part(s+'hand',w,handend,.094*S,.05);part(s+'forearm',p[s+'elbow'],w,.115*S,.12);part(s+'upperarm',p[s+'shoulder'],p[s+'elbow'],.135*S,.08);
   }
   function drawProp(){
    const r=cb.views[view],q=project(p.Lshoulder),height=(ID==='NPC03'?.60:.60)*S,scale=height*q[2]/r.h;
    // One source image preserves elbow-to-wrist anatomy. The prop no longer floats over a second arm.
    g.save();g.translate(q[0]+(view==='side'?.025*S*q[2]:0),q[1]+(view==='side'?.00:.025)*S*q[2]);if(view==='rear')g.scale(-1,1);g.scale(ID==='NPC03'?.80:.90,1);
    g.drawImage(carryImage,r.x,r.y,r.w,r.h,-r.shoulder_x*r.w*scale,0,r.w*scale,r.h*scale);g.restore();
   }
   const far=view==='side'?'R':view==='rear'?'L':'R',near=far==='L'?'R':'L';
   arm(far);if(view!=='side')arm(near);leg(far);leg(near);const behind=view==='rear'&&['parcel','folder'].includes(CFG.prop);if(behind)drawProp();
   fixed('pelvis',[p.root[0],p.root[1]+.015,p.root[2]],(view==='side'?.27:.345)*S,.18*S);
   // Torso top to waist, lower hem hides the pelvis joint.
   fixed('torso',[p.root[0],p.root[1]+.535*S,p.root[2]],(view==='side'?.32:.425)*S,.57*S);
   // Fixed draws descend in screen coordinates: head/torso use positive world-height top.
   fixed('head',[p.head[0],p.head[1]+.06,p.head[2]],.235*S,.30*S);
   if(view==='side')arm(near);if(!behind)drawProp();
   const scene=createCanvas(W,H),c=scene.getContext('2d');c.drawImage(bg,0,0,W,H);
   // Shadows are runtime layers calculated from world-space feet; no background repaint.
   for(const s of ['L','R']){
    const he=p[s+'heel'],to=p[s+'toe'],floor=[(he[0]+to[0])/2,0,(he[2]+to[2])/2],q=project(floor),lift=Math.max(0,Math.min(he[1],to[1])),a=.32*Math.exp(-lift*20),rx=(view==='side'?.145:.095)*S*q[2]*(1+lift*1.6),ry=.028*S*q[2]*(1+lift*3);
    c.save();c.translate(q[0],q[1]);c.scale(1,ry/rx);const grad=c.createRadialGradient(0,0,0,0,0,rx);grad.addColorStop(0,`rgba(7,11,13,${a})`);grad.addColorStop(.5,`rgba(7,11,13,${a*.45})`);grad.addColorStop(1,'rgba(7,11,13,0)');c.fillStyle=grad;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();c.restore();
   }
   const shaded=createCanvas(W,H),sg=shaded.getContext('2d');sg.drawImage(art,0,0);sg.globalCompositeOperation='source-atop';const wash=sg.createLinearGradient(0,420,0,1000);wash.addColorStop(0,'rgba(104,115,104,0.055)');wash.addColorStop(1,'rgba(36,43,44,0.15)');sg.fillStyle=wash;sg.fillRect(0,0,W,H);c.drawImage(shaded,0,0);
   const fn=String(frame).padStart(4,'0')+'.png';fs.writeFileSync(path.join(ROOT,'renders',view,fn),scene.toBuffer('image/png'));fs.writeFileSync(path.join(ROOT,'sprites',view,fn),art.toBuffer('image/png'));
  }
 }
 fs.writeFileSync(path.join(ROOT,'binding.json'),JSON.stringify({camera,views:configs,carrying_asset:cb,revision:'v05',arm_deformation:'continuous_texture_48_strips',character:ID,background:'BG02',fps:24,frames:48,engine_applied:false},null,2));
 console.log('Rendered requested views/frames; count from output inventory');
}
main().catch(e=>{console.error(e);process.exit(1)});
