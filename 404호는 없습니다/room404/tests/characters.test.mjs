// Approved character art (v0.15.0). Sources and approval lists: ../character-v5 (asset package v02, Drive 2026-10-09).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
const dist=p=>new URL('../dist/'+p,import.meta.url),pkg=p=>new URL('../../character-v5/'+p,import.meta.url);
const json=u=>JSON.parse(readFileSync(u));
const ca=json(dist('data/character_assets.json')),figs=json(dist('data/visitor_figures.json')),mapping=json(pkg('docs/main_scene_mapping_40_v03.json'));
const approvedPatch=json(pkg('docs/approved_patch_assets_v02.json')),approvedStatic=json(pkg('docs/approved_static_assets_v01.json')),backlog=json(pkg('docs/revision_backlog_v02.json'));
const approvedIds=new Set([...approvedPatch.filter(a=>a.status==='PASS').map(a=>a.id),...approvedStatic.filter(a=>/front_full/.test(a.state)).map(a=>a.id)]);

test('only approved static figures are used; revise/blocked ones never',()=>{
 const used=Object.keys(ca.assets);assert.ok(used.length>=4);
 for(const id of used)assert.ok(approvedIds.has(id),id+' is on an approval list');
 for(const b of backlog)assert.ok(!used.includes(b.id),b.id+' is '+b.status);
 for(const id of Object.values(ca.contacts))assert.ok(ca.assets[id],id);
 // v0.19.0: role figures are switched per case (data/visitor_figures.json), never as a blanket switch over CCTV art that is missing.
 assert.equal(ca.visitor_roles_enabled,true);assert.equal(ca.visitor_roles_scope,'per_case');
});
test('every portrait file exists, is cached for offline use, and comes from a verified source',()=>{
 const sw=readFileSync(dist('sw.js'),'utf8');assert.match(sw,/character_assets\.json/);
 const integ=json(pkg('docs/download_integrity_v02.json')).images,rev=json(pkg('docs/character_revision_manifest_v02.json'));
 for(const [id,a] of Object.entries(ca.assets)){assert.ok(existsSync(dist(a.file)),a.file);assert.ok(readFileSync(dist(a.file)).length>5000);
  assert.ok(sw.includes(`'${id}'`)&&sw.includes('assets/v5/figure-'),id+' precached');
  const src=readFileSync(a.source_dir?new URL('../../'+a.source_dir+'/'+a.source,import.meta.url):pkg('png/'+a.source)),sha=createHash('sha256').update(src).digest('hex');assert.equal(sha,a.source_sha256,id);
  const expected=integ.find(x=>x.path==='01_캐릭터/game/'+a.source)?.sha256||rev.find(x=>x.game_path?.endsWith(a.source))?.sha256;assert.equal(sha,expected,id+' matches the package hash')}
});
test('scene portraits follow main_scene_mapping_40_v03; nothing approved and present is left out',()=>{
 for(const m of mapping){const want=ca.assets[m.character_id]?m.character_id:null;assert.equal(ca.contacts[m.id]||null,want,m.id)}
 for(const [scene,id] of Object.entries(ca.contacts_waiting_for_files||{})){assert.equal(mapping.find(m=>m.id===scene).character_id,id);assert.ok(!ca.assets[id],id+' file not in the game yet')}
 const visitors=json(dist('data/visitors.json'));assert.deepEqual(Object.keys(ca.visitor_roles).sort(),[...new Set(visitors.map(v=>v.role))].sort(),'one role figure per visitor role');
});
test('v0.18.0: CH06/CH08 contacts come from the restored game exports; v0.19.0: role figures switch per case and all ten are cached',()=>{
 for(const id of ['CH06','CH08']){assert.equal(ca.assets[id].source_dir,'asset-source/01_캐릭터/game');assert.ok(Object.values(ca.contacts).includes(id),id+' shown in its story scenes')}
 assert.deepEqual(Object.entries(ca.contacts).filter(([,c])=>c==='CH06').map(([s])=>s),['N2_04','N3_04','N5_06']);assert.deepEqual(Object.entries(ca.contacts).filter(([,c])=>c==='CH08').map(([s])=>s),['N2_06','N5_07']);
 const rf=ca.visitor_role_figures,integ=json(pkg('docs/download_integrity_v02.json')).images,sw=readFileSync(dist('sw.js'),'utf8');
 assert.deepEqual(Object.keys(rf).sort(),Object.values(ca.visitor_roles).sort(),'one figure per role, NPC01-NPC10');
 for(const [id,a] of Object.entries(rf)){assert.ok(approvedIds.has(id),id+' approved');const src=readFileSync(new URL('../../'+a.source_dir+'/'+a.source,import.meta.url));
  const sha=createHash('sha256').update(src).digest('hex');assert.equal(sha,a.source_sha256,id);assert.equal(sha,integ.find(x=>x.path==='01_캐릭터/game/'+a.source).sha256,id+' package game export');
  assert.ok(existsSync(dist(a.figure.file)),a.figure.file);assert.ok(a.figure.height_m>1.4&&a.figure.height_m<1.9,id);assert.ok(sw.includes(`'${id}'`),id+' precached: the dealt cases use eight, an old save with free visitor x scenario pairs can show any of the ten')}
 assert.equal(rf.NPC03.source,'NPC03_courier_2026_front_full_v02_v01.png','NPC03 uses the approved v02');
 assert.equal(rf.NPC01.source_sha256,'6679a8051d8f4e8b9c9740074a7f70de7ce1fae8d718a96dda4aa70dd7cc2d9b','NPC01: the recovered game export, not the truncated Drive copy');
 assert.equal(ca.visitor_roles_status.files,'10/10');assert.equal(ca.visitor_roles_status.approved_static,'10/10');assert.match(ca.visitor_roles_status.limits,/CCTV/);assert.equal(ca.visitor_roles_status.blocked_by,undefined);
 assert.equal(ca.visitor_roles_enabled,true);assert.match(ca.visitor_roles_note,/고유 원화가 아니다/);
 const game=readFileSync(dist('game.js'),'utf8');assert.match(game,/figureFor\(/);assert.doesNotMatch(game,/visitor_role_figures/,'role figures reach the intercom and the CCTV only through figures.js figureFor (one decision for both)');
 assert.deepEqual(figs.summary.role_figures_used,['NPC02','NPC04','NPC05','NPC06','NPC07','NPC08','NPC09','NPC10'])});
