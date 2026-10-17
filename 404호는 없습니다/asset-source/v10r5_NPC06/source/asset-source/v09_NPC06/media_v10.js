const {createCanvas,loadImage}=require('@napi-rs/canvas'),fs=require('fs'),path=require('path');
(async()=>{const base=process.argv[2],candidate=process.argv[3],out=process.argv[4];if(!out)throw Error('baseline candidate output-directory required');fs.mkdirSync(path.join(out,'video_frames'),{recursive:true});const bg=await loadImage(path.resolve(__dirname,'../v05_QA/code/NPC06/assets/BG02_shared_entrance_night_v01.webp'));const sets=[base,candidate],reports=sets.map(s=>JSON.parse(fs.readFileSync(path.join(s,'frames.json')))),c=createCanvas(720,640),g=c.getContext('2d');let sheet,sg;
for(let n=0;n<215;n++){
 if(n%40===0){sheet=createCanvas(1280,1650);sg=sheet.getContext('2d');sg.fillStyle='#424a52';sg.fillRect(0,0,1280,1650)}
 for(let j=0;j<2;j++){const f=reports[j].frames[n],im=await loadImage(path.join(sets[j],'seq',String(n).padStart(4,'0')+'.png'));g.save();g.translate(j*360,0);g.scale(.5,.5);g.drawImage(bg,0,0,720,1280);for(const [x,y,rx,ry,a] of f.shadows){g.fillStyle=`rgba(0,0,0,${a})`;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()}g.drawImage(im,0,0);g.fillStyle='#111d';g.fillRect(0,0,720,54);g.fillStyle='white';g.font='23px sans-serif';g.fillText(`${j?'v10r5 REVISE':'v09r'} ${n} ${f.seg}`,16,35);g.restore();if(j===1){const k=n%40,x=k%8*160,y=Math.floor(k/8)*330;sg.drawImage(im,220,430,300,620,x+5,y+20,150,310);sg.fillStyle='white';sg.font='13px sans-serif';sg.fillText(`${n} ${f.seg}`,x+4,y+15)}}
 fs.writeFileSync(path.join(out,'video_frames',String(n).padStart(4,'0')+'.png'),c.toBuffer('image/png'));
 if(n%40===39||n===214)fs.writeFileSync(path.join(out,`sequence_${Math.floor(n/40)+1}.jpg`),sheet.toBuffer('image/jpeg',{quality:85}));
 if(global.gc)global.gc();await new Promise(r=>setImmediate(r));}
})();
