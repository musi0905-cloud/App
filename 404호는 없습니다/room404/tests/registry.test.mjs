// asset_registry.json (v0.17.0): hashes match the files, ids do not collide, ID systems stay apart, eras and alpha are
// right for where an asset is used, and only reviewed (or legacy in-game) files are selected for the game.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';import {join,relative} from 'node:path';
const project=fileURLToPath(new URL('../../',import.meta.url)),P=p=>join(project,p);
const reg=JSON.parse(readFileSync(P('asset_registry.json'))),assets=reg.assets;
const sha=p=>createHash('sha256').update(readFileSync(P(p))).digest('hex');
const data=n=>JSON.parse(readFileSync(P('room404/dist/data/'+n+'.json')));
const slots=data('story_slots'),layout=data('scene_layout'),chars=data('character_assets');
const byPath=new Map(assets.flatMap(a=>[a.sourcePath,...a.duplicatePaths].map(p=>[p,a])));
test('every entry is a real file whose bytes match its SHA-256; duplicates share the bytes',()=>{for(const a of assets){assert.ok(existsSync(P(a.sourcePath)),a.sourcePath);assert.equal(sha(a.sourcePath),a.sha256,a.sourcePath);for(const d of a.duplicatePaths)assert.equal(sha(d),a.sha256,d)}
 assert.equal(new Set(assets.map(a=>a.sha256)).size,assets.length,'one entry per SHA-256')});
test('asset ids are unique and the ID systems stay apart',()=>{assert.equal(new Set(assets.map(a=>a.assetId)).size,assets.length);
 for(const a of assets){if(a.entityId!==null)assert.match(a.entityId,/^(CH|MC|NPC|BG|UI|EV)\d\d$/,a.assetId);assert.doesNotMatch(a.assetId,/:(V\d{3}|N\d_\d\d):/,a.assetId);
  for(const s of a.selectedFor){if(s.startsWith('scene:'))assert.ok(slots.some(x=>x.scene_id===s.slice(6)),s);assert.doesNotMatch(s,/^(V\d{3}|N\d_\d\d)$/,'game ids are referenced with a prefix: '+s)}}});
test('every required field is present',()=>{const f=['assetId','entityId','era','category','sourcePath','sourcePackage','revision','sha256','width','height','format','hasAlpha','qaStatus','selectedFor','replacementOf','notes'];
 for(const a of assets)for(const k of f)assert.ok(k in a,a.assetId+' '+k)});
test('QA status comes from QA records, never from a name; REVISE and unreviewed files are not used by the game',()=>{
 for(const a of assets){if(a.qaStatus==='PASS')assert.ok(a.qaBasis&&/json/.test(a.qaBasis),a.assetId+' PASS needs a QA record');
  const inGame=a.selectedFor.some(s=>s.startsWith('game:')||s.startsWith('scene:'));if(inGame)assert.ok(['PASS','LEGACY_IN_GAME','PASS_TEXT_LAYOUT_PER_ITEM'].includes(a.qaStatus),a.assetId+' '+a.qaStatus)}
 assert.equal(assets.find(a=>a.sourcePath.endsWith('BG08_management_office_2026_v01.webp')).qaStatus,'UNREVIEWED');
 for(const a of assets.filter(a=>['animation_data','animation_frame','qa_atlas'].includes(a.category))){assert.equal(a.qaStatus,'REVISE',a.assetId);assert.ok(!a.selectedFor.some(x=>x.startsWith('game:')||x.startsWith('scene:')),a.assetId+' not in the game')}});
test('era: 2004 files only behind 2004 records; alpha kept where figures are cut out, backgrounds opaque',()=>{
 for(const a of assets){if(a.era==='2004')for(const s of a.selectedFor)assert.match(s,/^game:evidence_backdrop:EV\d\d$/,a.assetId+' '+s);
  if(a.category==='character')assert.equal(a.hasAlpha,true,a.assetId+' keeps transparency');if(a.category==='background')assert.equal(a.hasAlpha,false,a.assetId);if(a.category==='review_video')assert.equal(a.hasAlpha,false,'MP4 is not a transparent asset')}
 for(const f of Object.values(chars.legacy.figures))assert.equal(byPath.get('room404/dist/'+f.file).hasAlpha,true,f.file)});
test('every image the game loads is registered (paths), and every file in asset-source and dist/assets is accounted for',()=>{
 const game=[...Object.values(layout.backgrounds).map(b=>b.file).filter(Boolean),...Object.values(chars.assets).map(a=>a.figure.file),...Object.values(chars.legacy.figures).map(f=>f.file)];
 for(const f of game)assert.ok(byPath.has('room404/dist/'+f),f);
 const walk=d=>readdirSync(P(d)).flatMap(f=>statSync(join(P(d),f)).isDirectory()?walk(join(d,f)):[join(d,f)]);
 const skip=/(stage_build_report\.json|ui_inventory_v0[12]\.json|ui_text_ko_v01\.json|\.md|\.js|\.py|checksums_v05\.json|QA_v05\.json|execution_v05\.json|frame_connectivity_check\.json|package\.json|validation_all_v05\.json|prompts_v05\.json|walk_rig_elder_v02_original\.json|TRANSFER_MANIFEST\.json|V05_IMPORT_RESULT\.json|V05_VERIFY_REPORT\.json|import_report\.json|\/frame_qa\/.*)$/;
 for(const f of [...walk('asset-source'),...walk('room404/dist/assets')])if(!skip.test(f))assert.ok(byPath.has(f),'registered: '+f)});
test('missing files are not secretly present; the 1,296 v05 sprites are held and registered, their part art is still missing',()=>{const have=new Set(assets.map(a=>a.sha256));
 for(const m of reg.missing)if(/^[0-9a-f]{64}$/.test(m.sha256))assert.ok(!have.has(m.sha256),m.path);
 assert.equal(reg.missing.filter(m=>/sprites\/(front|side|rear)\/0000-0047\.png$/.test(m.path)).length,0);
 const frames=assets.flatMap(a=>a.category==='animation_frame'?[a.sourcePath,...a.duplicatePaths]:[]);assert.equal(frames.length,1296);
 for(const a of assets.filter(a=>a.category==='animation_frame')){assert.equal(a.width,720);assert.equal(a.height,1280);assert.equal(a.hasAlpha,true,a.sourcePath)}
 assert.ok(reg.missing.filter(m=>/^NPC\d\d\/assets\//.test(m.path)).length>0,'v05 part art (assets/) not in hand');
 for(const p of ['01_캐릭터/game/NPC01_visitor_male_2026_front_full_v01.png','02_배경/game/BG13_2004_exterior_2004_v01.webp','02_배경/game/BG08_management_office_2026_base_v02_v01.webp','02_배경/game/BG06_interior_elevator_2026_interior_v01.webp'])assert.ok(reg.missing.some(m=>m.path===p),p)});
