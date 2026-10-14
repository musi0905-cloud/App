// Offline cache (v0.17.0): the service worker's cache name follows the game version (a changed build replaces the old cache
// on activate), every file it precaches exists, and everything the game itself loads — data, stage code, backgrounds,
// approved figures — is precached so a cold offline restart works. QA-only data (walk_clips.json) stays out of the game.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const dist=p=>new URL('../dist/'+p,import.meta.url),txt=p=>readFileSync(dist(p),'utf8');
const sw=txt('sw.js'),ctx={self:{addEventListener(){}},caches:{},fetch(){}};vm.createContext(ctx);vm.runInContext(sw+';this.__CACHE=CACHE;this.__FILES=FILES;',ctx);
const FILES=ctx.__FILES.map(f=>f.replace(/^\.\//,'')),game=txt('game.js'),layout=JSON.parse(txt('data/scene_layout.json')),chars=JSON.parse(txt('data/character_assets.json'));
test('cache name follows the visible game version, and activation drops every older room404 cache',()=>{
 const v=game.match(/\$\('version'\)\.textContent='(v[\d.]+)'/)[1];assert.equal(ctx.__CACHE,'room404-'+v);
 assert.match(sw,/key\.startsWith\('room404-'\)&&key!==CACHE\)await caches\.delete\(key\)/)});
test('every precached file exists in dist',()=>{for(const f of FILES.filter(f=>f))assert.ok(existsSync(dist(f)),f);assert.equal(new Set(FILES).size,FILES.length,'no duplicates')});
test('everything the game loads is precached (offline cold restart); QA-only walk data is not part of the game',()=>{
 for(const m of game.matchAll(/['`](data\/[a-z_]+\.json)['`]/g))assert.ok(FILES.includes(m[1]),m[1]);
 for(const m of game.matchAll(/from '\.\/([a-z]+\.js)'/g))assert.ok(FILES.includes(m[1]),m[1]);
 for(const b of Object.values(layout.backgrounds))if(b.file)assert.ok(FILES.includes(b.file),b.file);
 for(const a of Object.values(chars.assets))assert.ok(FILES.includes(a.figure.file),a.figure.file);
 for(const f of Object.values(chars.legacy.figures))assert.ok(FILES.includes(f.file),f.file);
 assert.ok(!FILES.includes('data/walk_clips.json'));assert.doesNotMatch(game,/walk_clips/)});
