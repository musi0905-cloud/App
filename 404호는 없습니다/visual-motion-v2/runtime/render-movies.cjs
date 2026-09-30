// Build distributable silent H.264 samples using the same renderer as preview.html.
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {spawn}=require('child_process');const fs=require('fs'),path=require('path');const {once}=require('events');
(async()=>{
 const root=path.resolve(__dirname,'..');const {PRESETS,loadAssets,renderScene}=await import('./scene-player.mjs');
 const assets=await loadAssets(loadImage,root+'/');
 const canvas=createCanvas(960,640),ctx=canvas.getContext('2d');
 fs.mkdirSync(path.join(root,'motion'),{recursive:true});fs.mkdirSync(path.join(root,'previews'),{recursive:true});
 const only=process.argv[2];const presets=only?PRESETS.filter(p=>p.id===only):PRESETS;
 const report=[];
 for(const p of presets){
  renderScene(ctx,assets,p,2.5,{overlay:false});
  fs.writeFileSync(path.join(root,'previews',p.id+'.jpg'),canvas.toBuffer('image/jpeg',85));
  const target=path.join(root,'motion',p.id+'.mp4');
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  let err='';encoder.stderr.on('data',d=>err+=d);const completion=once(encoder,'close');
  for(let f=0;f<144;f++){renderScene(ctx,assets,p,f/24,{overlay:false});const jpeg=canvas.toBuffer('image/jpeg',90);if(!encoder.stdin.write(jpeg))await once(encoder.stdin,'drain');}
  encoder.stdin.end();const [code]=await completion;if(code!==0)throw Error(err);const fd=fs.openSync(target,'r+');fs.fsyncSync(fd);fs.closeSync(fd);
  report.push({id:p.id,location:p.location,mode:p.mode,seconds:6,fps:24,width:960,height:640,audio:false,loop:p.loop!==false,path:'motion/'+p.id+'.mp4',bytes:fs.statSync(target).size});
  console.log('RENDERED',p.id,fs.statSync(target).size);
 }
 const mf=path.join(root,'runtime','motion-manifest.json');const previous=only&&fs.existsSync(mf)?JSON.parse(fs.readFileSync(mf)):[];const merged=[...previous.filter(x=>!report.some(y=>y.id===x.id)),...report].sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(mf,JSON.stringify(merged,null,2));
})();
