// v0.18.0: restored source delivery (41 source ZIPs) and the v06 walk renders (asset-source/v06_render/render_v06.js).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
import {clipUsable} from '../dist/stage.js';
const P=p=>new URL('../../'+p,import.meta.url),J=p=>JSON.parse(readFileSync(P(p),'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(P(p))).digest('hex');
const walk=J('room404/dist/data/walk_clips.json'),review=J('asset-source/v06_QA/review_summary_v06.json');

test('restored delivery: 169 files hash-checked, 41 copied without overwrite, every v0.17 request answered by SHA-256',()=>{
 const r=J('asset-source/v06_sources/SOURCE_IMPORT_RESULT.json');assert.equal(r.format,'404-byte-pieces-v1');assert.equal(r.packages,41);assert.equal(r.files,169);
 assert.equal(r.copied+r.already_identical,169);assert.equal(r.requests,41);assert.equal(r.requests_resolved,41);assert.match(r.note,/NOT_REASSESSED|다시 하지 않았/);
 for(const row of r.rows.filter(x=>x.action==='copy'))assert.equal(sha(row.dest),row.sha256,row.dest);
 const m=J('docs/missing_assets_request.json');assert.equal(m.resolved_counts.requests_v0_17,41);assert.equal(m.resolved_counts.resolved,41);
 assert.ok(m.requests.every(q=>['file','new_art','record'].includes(q.kind)),'open requests say what kind of work they are')});
test('NPC01 game export: the recovered file, not the truncated Drive copy, and it equals the approved original pixel for pixel (recorded)',()=>{
 assert.equal(sha('asset-source/01_캐릭터/game/NPC01_visitor_male_2026_front_full_v01.png'),'6679a8051d8f4e8b9c9740074a7f70de7ce1fae8d718a96dda4aa70dd7cc2d9b')});
test('render_v06.js: v05 mode reproduced all 1,296 delivered sprites byte for byte; path constants exist only in camera_v06.json',()=>{
 const log=readFileSync(P('asset-source/v06_render/port_check_v05.log'),'utf8').trim().split('\n').at(-1),res=JSON.parse(log);
 assert.equal(Object.keys(res).length,9);for(const [id,v] of Object.entries(res)){assert.equal(v.identical,144,id);assert.equal(v.different,0,id);assert.equal(v.missing,0,id)}
 const src=readFileSync(P('asset-source/v06_render/render_v06.js'),'utf8'),cam=J('asset-source/v06_render/camera_v06.json');
 for(const k of ['2.92','1.8,','2.35','.52-'])assert.ok(!src.includes(k),'no hard-coded path constant '+k);
 assert.deepEqual(cam.paths.enter.origin,[0,2.92]);assert.deepEqual(cam.paths.exit_v05.origin,[0,1.8])});
test('v06 review: sequence continuous for all nine, side PASS except NPC10, front/rear REVISE (new art) -> no clip in a game scene',()=>{
 for(const [id,n] of Object.entries(walk.npcs)){const v=n.v06,r=review.npcs[id];assert.ok(v,id);assert.equal(v.renderer,'asset-source/v06_render/render_v06.js');
  assert.deepEqual(Object.keys(v.clips),['enter','settle','idle','turn','start','exit','pass'],id);assert.equal(v.clips.enter.frames,48);assert.equal(v.clips.exit.frames,48);assert.equal(v.clips.idle.frames,48);
  assert.ok(v.checks.enter_exit_gap_m<.01,id+' largest root jump between consecutive frames '+v.checks.enter_exit_gap_m);
  assert.equal(v.review.sequence,'PASS',id);assert.equal(r.sequence.status,'PASS');for(const view of ['front','rear']){assert.equal(v.review.views[view],'REVISE',id+' '+view);assert.ok(r[view].issues.includes('LEG_STRIP'))}
  assert.equal(v.review.views.side,id==='NPC10'?'REVISE':'PASS',id+' side');assert.equal(v.qa_status,'REVISE');assert.equal(clipUsable(v),false,id+' not usable');assert.equal(clipUsable(n),false,id+' v05 not usable')}
 const pr=J('asset-source/v06_QA/production_requests_v06.json');assert.equal(pr.v05_requests,64);
 const c=pr.v05_resolution_counts;assert.equal(c.P1.RESOLVED_V06+c.P1.OPEN,28);assert.equal(c.P1.RESOLVED_V06+c.P1.OPEN+c.P2.RESOLVED_V06+c.P2.OPEN,64);
 assert.ok(pr.requests.every(q=>q.needs_new_art&&q.art_spec.required_art&&q.art_spec.character&&q.art_spec.view),'every open request carries an art spec')});
test('NPC06: the exit starts where the person stands after the turn (no 0.533 m jump), knees under load at most 24 deg',()=>{
 const m=J('asset-source/v06_QA/NPC06/metrics_v06.json');assert.ok(m.sequence.exit_start_root_world[1]>2.2&&m.sequence.exit_start_root_world[1]<2.35,String(m.sequence.exit_start_root_world));
 assert.ok(m.seams.every(s=>Object.values(s.resting_feet_moved_mm).every(v=>v<=1)),'resting feet do not move at any boundary');assert.ok(m.knee.v06_stance_flex_max_deg<=24);assert.equal(m.knee_band.v06_all_segments.below_250,0);
 for(const f of ['compare_v05_v06.mp4','compare_v05_v06_slow.mp4','before_after.jpg','seams_sheet.jpg'])assert.ok(existsSync(P('asset-source/v06_QA/NPC06/'+f)),f)});
