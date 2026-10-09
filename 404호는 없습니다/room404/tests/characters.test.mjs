// Approved character art (v0.15.0). Sources and approval lists: ../character-v5 (asset package v02, Drive 2026-10-09).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
const dist=p=>new URL('../dist/'+p,import.meta.url),pkg=p=>new URL('../../character-v5/'+p,import.meta.url);
const json=u=>JSON.parse(readFileSync(u));
const ca=json(dist('data/character_assets.json')),mapping=json(pkg('docs/main_scene_mapping_40_v03.json'));
const approvedPatch=json(pkg('docs/approved_patch_assets_v02.json')),approvedStatic=json(pkg('docs/approved_static_assets_v01.json')),backlog=json(pkg('docs/revision_backlog_v02.json'));
const approvedIds=new Set([...approvedPatch.filter(a=>a.status==='PASS').map(a=>a.id),...approvedStatic.filter(a=>/front_full/.test(a.state)).map(a=>a.id)]);

test('only approved static figures are used; revise/blocked ones never',()=>{
 const used=Object.keys(ca.assets);assert.ok(used.length>=4);
 for(const id of used)assert.ok(approvedIds.has(id),id+' is on an approval list');
 for(const b of backlog)assert.ok(!used.includes(b.id),b.id+' is '+b.status);
 for(const id of Object.values(ca.contacts))assert.ok(ca.assets[id],id);
 assert.equal(ca.visitor_roles_enabled,false,'gate visitors switch only as a full NPC01-NPC10 set');
});
test('every portrait file exists, is cached for offline use, and comes from a verified source',()=>{
 const sw=readFileSync(dist('sw.js'),'utf8');assert.match(sw,/character_assets\.json/);
 const integ=json(pkg('docs/download_integrity_v02.json')).images,rev=json(pkg('docs/character_revision_manifest_v02.json'));
 for(const [id,a] of Object.entries(ca.assets)){assert.ok(existsSync(dist(a.file)),a.file);assert.ok(readFileSync(dist(a.file)).length>5000);
  assert.ok(sw.includes(`'${id}'`)&&sw.includes('assets/v5/bust-'),id+' precached');
  const src=readFileSync(pkg('png/'+a.source)),sha=createHash('sha256').update(src).digest('hex');assert.equal(sha,a.source_sha256,id);
  const expected=integ.find(x=>x.path==='01_캐릭터/game/'+a.source)?.sha256||rev.find(x=>x.game_path?.endsWith(a.source))?.sha256;assert.equal(sha,expected,id+' matches the package hash')}
});
test('scene portraits follow main_scene_mapping_40_v03; nothing approved and present is left out',()=>{
 for(const m of mapping){const want=ca.assets[m.character_id]?m.character_id:null;assert.equal(ca.contacts[m.id]||null,want,m.id)}
 for(const [scene,id] of Object.entries(ca.contacts_waiting_for_files)){assert.equal(mapping.find(m=>m.id===scene).character_id,id);assert.ok(!ca.assets[id],id+' file not in the game yet')}
 const visitors=json(dist('data/visitors.json'));assert.deepEqual(Object.keys(ca.visitor_roles).sort(),[...new Set(visitors.map(v=>v.role))].sort(),'one role figure per visitor role');
});
