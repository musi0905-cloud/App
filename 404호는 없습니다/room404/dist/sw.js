const CACHE='room404-v0.6.0';
const FILES=['./','./index.html','./style.css','./game.js','./engine.js','./manifest.webmanifest','./data/visitors.json','./data/anomalies.json','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./assets/cctv-lobby.png','./assets/visitors.png','./assets/apartment-scenes.png','./assets/mystery-props.png','./assets/detail-scenes.png','./assets/visitors-before-haircut.png','./replay.js','./data/scenarios.json'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('room404-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(event.request)}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error}})());
});
