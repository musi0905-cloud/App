// Minimal static server for the browser tests. Supports HTTP Range requests so <video> can seek, like real hosting.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';
export const TYPES={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
export async function startServer(root,{blocked=()=>false}={}){
 const server=createServer(async(req,res)=>{if(blocked()){req.socket.destroy();return}try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/'))throw Error();const body=await readFile(file);res.setHeader('Content-Type',TYPES[extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
  const range=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');if(range){const start=range[1]?Number(range[1]):body.length-Number(range[2]),end=range[1]&&range[2]?Math.min(Number(range[2]),body.length-1):body.length-1;res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${body.length}`);res.end(body.subarray(start,end+1));return}
  res.end(body)}catch{res.statusCode=404;res.end('Not found')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,origin:`http://127.0.0.1:${server.address().port}`};
}
