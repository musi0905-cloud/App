// NPC06 v07 experiment (2026-10-14): the producer's v07b sheets bound to the v06 rig (render_v06.js --art=v07), reviewed on
// real frames. Nothing here is game data; these tests pin that the experiment stayed an experiment.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {clipUsable} from '../dist/stage.js';
const P=p=>new URL('../../'+p,import.meta.url),J=p=>JSON.parse(readFileSync(P(p),'utf8')),sha=p=>createHash('sha256').update(readFileSync(P(p))).digest('hex');
const imp=J('asset-source/v07_NPC06/IMPORT_v07.json'),B=J('asset-source/v07_NPC06/binding_v07.json'),R=J('asset-source/v07_QA/review_summary_v07.json'),M=J('asset-source/v07_QA/NPC06/metrics_v07.json');

test('import: six delivered PNGs match the producer manifest byte for byte; alpha kept as delivered (max 254, no 255)',()=>{
 assert.equal(imp.result,'ALL_MATCH');assert.equal(imp.files.length,6);
 for(const f of imp.files){assert.ok(f.sha256_ok&&f.bytes_ok&&f.bbox_equal_to_manifest,f.file);assert.equal(sha('asset-source/v07_NPC06/'+f.file),f.sha256,f.file);
  assert.deepEqual(f.size,[1536,1024]);assert.equal(f.mode,'RGBA');assert.equal(f.alpha_max,254);assert.equal(f.alpha_255_px,0);assert.equal(f.components_alpha_gt128,f.components_manifest)}
 assert.deepEqual(imp.files.map(f=>f.components_manifest).sort(),[4,4,6,6,6,6]);
 for(const d of imp.docs)assert.equal(sha('asset-source/v07_NPC06/'+d.file),d.sha256,d.file)});

test('binding: only the v07b sheets are read; v07a drafts are kept apart; 12 leg states + 4 torso cells with measured attach points',()=>{
 assert.deepEqual(Object.values(B.sheets).sort(),['asset-source/v07_NPC06/source/NPC06_몸통회전_단추수정_v07b.png','asset-source/v07_NPC06/source/NPC06_정면다리_깊이수정_v07b.png','asset-source/v07_NPC06/source/NPC06_후면다리_경계검토_v07b.png']);
 assert.ok(!JSON.stringify(B.sheets).includes('v07a'));assert.ok(readdirSync(P('asset-source/v07_NPC06/source/draft_v07a')).every(f=>f.includes('v07a')));
 for(const v of ['front','rear']){const ps=B.legs[v].parts;assert.equal(ps.length,6);
  for(const p of ps){assert.match(p.top_attach.how,/^measured/);assert.match(p.cuff_attach.how,/^measured/);assert.match(p.knee.how,/^estimated/);assert.equal(p.crop_xywh.length,4)}
  assert.equal(B.legs[v].scale.method_change.after.length>0,true)}
 assert.equal(B.torso.cells.length,4);assert.equal(B.leg_state_rule.anchor.used,'cuff');assert.equal(B.leg_state_rule.straight_below_deg,15);assert.equal(B.leg_state_rule.knee60_from_deg,45);
 // the front cells turn the other shoulder from their prompt label (measured from the shirt band), the rear cells match it
 assert.deepEqual(B.torso_state_rule.cell_for_forward_shoulder,{'front.R':'left_cell','front.L':'right_cell','rear.L':'left_cell','rear.R':'right_cell'});
 assert.equal(B.torso_state_rule.nearest_nominal.frames_selected,0);assert.ok(B.torso.mirror_check.front.iou_mirrored>.98)});

test('renderer: --art=v07 is NPC06-only and leaves every v06 frame as it was (recorded regression run)',()=>{
 const src=readFileSync(P('asset-source/v06_render/render_v06.js'),'utf8');assert.match(src,/--art=v07 exists only for NPC06/);
 const rec=J('asset-source/v07_QA/NPC06/render_record_v07.json');assert.match(rec.regression.v06_all_nine_vs_v0_18,/^2248\/2248/);
 for(const v of Object.values(JSON.parse(rec.regression.v05_port_check)))assert.deepEqual(v,{identical:144,different:0,missing:0});
 assert.equal(M.same_rig_geometry_every_frame,true);assert.equal(M.side_pass_frames_identical_to_v06,true);assert.equal(M.renders.v07_anchor,'cuff')});

test('real v07 frames: cuff on the shoe, v06 contact kept; sideways knee, state and torso pops, material -> REVISE',()=>{
 const c=M.v07_checks.summary;for(const v of ['front','rear']){assert.equal(c.cuff_join[v].holes,0);assert.equal(c.cuff_join[v].top_holes,0);assert.equal(c.cuff_join[v].all_segments.holes,0);
  assert.deepEqual(M.v07.views[v].sole_vs_rig_px,M.v06.views[v].sole_vs_rig_px,v+' contact unchanged');assert.deepEqual(M.v07.views[v].planted_shoe_slide_px,M.v06.views[v].planted_shoe_slide_px)}
 assert.ok(c.knee_sideways.front.knee60.abs_rel_leg.max>.03);assert.ok(c.colour.rear.v07_pelvis_vs_legs_dE76.median>c.colour.rear.v06_pelvis_vs_legs_dE76.median+1);
 // the top-anchored first attempt is kept as the record of why the anchor changed
 const t=J('asset-source/v07_QA/NPC06/attempt_top_anchor/metrics_v07.json');assert.equal(t.renders.v07_anchor,'top');assert.ok(t.v07_checks.summary.cuff_join.front.holes>0)});

test('verdicts: format and binding PASS kept apart from the views; front/rear/sequence REVISE, side PASS; 0 of 4 requests resolved',()=>{
 assert.equal(R.format_check.status,'PASS');assert.equal(R.binding_check.status,'PASS');assert.equal(R.binding_check.parts_bound,16);
 assert.equal(R.views.front.status,'REVISE');assert.equal(R.views.rear.status,'REVISE');assert.equal(R.views.side.status,'PASS');assert.equal(R.views.sequence.status,'REVISE');
 for(const k of ['path','resting_feet','head','turn_idle'])assert.equal(R.views.sequence.criteria[k],'PASS',k+' (v06 criteria still pass)');
 for(const v of ['front','rear'])for(const k of ['contact','planted_foot','cuff_join'])assert.equal(R.views[v].criteria[k],'PASS',v+' '+k);
 assert.equal(R.requests.length,4);assert.ok(R.requests.every(r=>r.status==='OPEN'));assert.equal(R.requests_resolved,0);
 const pr=J('asset-source/v06_QA/production_requests_v06.json');for(const r of R.requests)assert.ok(pr.requests.some(q=>q.id===r.id),r.id+' still in the v06 open list');
 const m=J('docs/missing_assets_request.json');assert.equal(m.resolved_counts.requests_v0_17,41);assert.ok(m.requests.filter(r=>r.latest_attempt).every(r=>Object.values(r.latest_attempt.requests).every(s=>s==='OPEN')))});

test('game: NPC06 stays a static visitor; walk clips, role figures and the other eight are untouched',()=>{
 const walk=J('room404/dist/data/walk_clips.json'),n6=walk.npcs.NPC06;assert.equal(R.game.applied,false);assert.equal(R.game.clipUsable_would_pass,false);
 assert.equal(clipUsable(n6.v06),false);assert.equal(n6.v06.review.views.front,'REVISE');assert.equal(n6.v06.review.views.rear,'REVISE');assert.ok(!JSON.stringify(walk).includes('v07'));
 const ca=J('room404/dist/data/character_assets.json');assert.ok(!JSON.stringify(ca).includes('v07_NPC06'));
 for(const f of readdirSync(P('room404/dist'),{recursive:true}).filter(f=>/\.(js|json|html)$/.test(f)))assert.ok(!readFileSync(P('room404/dist/'+f),'utf8').includes('v07_NPC06'),f);
 for(const r of ['asset-source/v07_QA/art_revision_requests_v07.json','asset-source/v07_QA/NPC06_v07_원화수정요청.md'])assert.ok(existsSync(P(r)),r);
 const req=J('asset-source/v07_QA/art_revision_requests_v07.json');assert.equal(req.requests.length,3);assert.ok(req.requests.every(q=>q.prompt.length>200&&q.evidence.length>=3&&q.actual.length&&q.expected.length&&q.keep.length))});
