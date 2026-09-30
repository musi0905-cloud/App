const CACHE='room404-v0.9.0';
const FILES=['./','./index.html','./style.css','./game.js','./engine.js','./replay.js','./voice.js','./sfx.js','./manifest.webmanifest','./data/visitors.json','./data/anomalies.json','./data/scenarios.json','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./assets/visitors.png','./assets/visitors-before-haircut.png',...['cctv-lobby','cctv-lobby-side','cctv-hall','cctv-elevator','cctv-stairs','cctv-parking','door-closed','door-open','title-night','guard-office','intercom-desk','ledger-desk','ending-dawn','visitor-01-walk','visitor-02-walk','visitor-03-walk','visitor-04-walk','prop-hat','prop-umbrella','prop-mask','prop-phone','prop-parcel','prop-glove'].map(n=>`./assets/v2/${n}.webp`)];
// Videos are not precached (8.8 MB, range requests); without network the photo backdrops are shown instead.
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('room404-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.endsWith('.mp4'))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(event.request)}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error}})());
});
