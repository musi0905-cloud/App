// NPC06 v09 (producer's material candidate, code only) and v09r (this repository's revision of it), reviewed on real frames
// (2026-10-15). Nothing here is game data: these tests pin the import record, that v09/v09r did not touch the v06 paths,
// joints, contact or side frames, the measured differences behind the verdicts, and that no request was closed early.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {clipUsable} from '../dist/stage.js';
const P=p=>new URL('../../'+p,import.meta.url),J=p=>JSON.parse(readFileSync(P(p),'utf8')),sha=p=>createHash('sha256').update(readFileSync(P(p))).digest('hex');
const imp=J('asset-source/v09_NPC06/IMPORT_v09.json'),R=J('asset-source/v09_QA/review_v09.json'),M=J('asset-source/v09_QA/metrics_v09.json'),run=Object.fromEntries(M.runs.map(r=>[r.label,r]));

test('import: docs, code ZIP and 13 frame ZIPs matched the manifest and SHA256SUMS; safe extraction; delivered code kept as delivered',()=>{
 assert.ok(imp.documents.filter(d=>d.file!=='SHA256SUMS.txt').every(d=>d.matches_SHA256SUMS));assert.equal(imp.code_zip.matches,true);
 assert.equal(imp.frame_zips.length,13);assert.ok(imp.frame_zips.every(z=>z.size_and_sha_match_manifest_and_SHA256SUMS));assert.equal(imp.frame_zips.reduce((a,z)=>a+z.members,0),264);
 const x=imp.frame_extraction;assert.equal(x.png,263);assert.equal(x.zip_slip_or_absolute_paths,0);assert.equal(x.duplicate_names_across_archives,0);assert.equal(x.member_hash_mismatch,0);
 for(const c of imp.code)if(c.file!=='render_v06.js'){assert.equal(sha('asset-source/v09_NPC06/'+c.file),c.delivered_sha256,c.file)}
 assert.equal(imp.dependencies.canvas,'0.1.100');
 // source_lock: every difference explained (trailing newline, or the single BG02 copy), none hidden
 for(const r of imp.source_lock)assert.ok(r.equal||r.difference,r.path)});

test('reproduction: delivered v09 frames rebuilt byte for byte here; the v09r branch left the default and v09 paths untouched',()=>{
 assert.match(imp.reproduction.verify_v09_py,/^PASS technical regression only: default 263\/263, side 48\/48, geometry 263\/263/);
 assert.match(imp.reproduction.candidate_vs_drive_frames,/^263\/263 PNG byte-identical, frames\.json byte-identical/);
 const ch=imp.changes_after_import.find(c=>c.file==='render_v06.js');assert.equal(sha('asset-source/v09_NPC06/render_v06.js'),ch.now_sha256);assert.match(ch.proof,/263\/263/);
 const src=readFileSync(P('asset-source/v09_NPC06/render_v06.js'),'utf8');assert.match(src,/v09r is NPC06 v06 mode only/);assert.match(src,/v09 is NPC06 v06 mode only/);
 // render_source.js is the repository v06 renderer plus one newline (the v06 renderer itself is not edited)
 assert.equal(readFileSync(P('asset-source/v09_NPC06/render_source.js'),'utf8'),readFileSync(P('asset-source/v06_render/render_v06.js'),'utf8')+'\n')});

test('real frames: same contact, alternation and slide in all three; v09r removes the knee step and the v09 knee line, keeps colour and weave',()=>{
 for(const k of ['v09','v09r'])for(const v of ['front','rear','side']){const a=run[k].suite.views[v],b=run.default.suite.views[v];
  assert.deepEqual(a.sole_vs_rig_px,b.sole_vs_rig_px,k+v);assert.deepEqual(a.planted_shoe_slide_px,b.planted_shoe_slide_px,k+v);assert.equal(a.alternates,true);assert.deepEqual(a.shadow_under_shoe,b.shadow_under_shoe)}
 const L=(k,v,m,q='median')=>run[k].legs[v][m][q];
 for(const v of ['front','rear']){assert.ok(L('default',v,'neck')<.9,'v06 narrow knee');assert.ok(L('v09r',v,'neck')>.96);assert.ok(L('v09r',v,'step_px')<=1&&L('default',v,'step_px')>=5)}
 assert.ok(L('v09','front','seam_ratio','p95')>L('default','front','seam_ratio','p95')*2,'v09 adds a knee line');assert.ok(L('v09r','front','seam_ratio','p95')<L('v09','front','seam_ratio','p95'));
 assert.ok(run.v09r.vs_baseline.trouser_delta_e76.median<.2&&run.v09.vs_baseline.trouser_delta_e76.median>.5);assert.ok(run.v09r.vs_baseline.weave_ratio.median>.98);
 const F=J('asset-source/v09_QA/fold_position_v09.json');assert.ok(F.v09.front.dark_fold_px_from_knee.max<-5,'v09 fold above the knee');
 assert.ok(F.v09r.front.dark_fold_px_from_knee.min>=-5&&F.v09r.front.dark_fold_px_from_knee.max<0);assert.ok(Math.abs(F.v09r.rear.dark_fold_px_from_knee.median)<2)});

test('shoulders: the strap no longer floats (background inside the figure cut ~4x) without moving the bag body at the picture switches',()=>{
 assert.ok(run.v09r.holes.total_px*3<run.default.holes.total_px);for(const s of ['enter/front','idle/front','exit/rear'])assert.ok(run.v09r.holes.by_segment[s].px*5<run.default.holes.by_segment[s].px,s);
 for(const at of ['122','142']){const a=R.candidates.v09r.view_switches[at],b=R.candidates.v09.view_switches[at];assert.ok(Math.abs(a.figure_iou-b.figure_iou)<.03,at);assert.equal(a.head_width_change,b.head_width_change)}});

test('verdicts: legs and torso REVISE in both candidates, side/sequence/background PASS, every request still OPEN, nothing in the game',()=>{
 for(const k of ['v09','v09r']){const c=R.candidates[k];assert.equal(c.status,'REVISE');for(const p of ['front_legs','rear_legs','front_torso','rear_torso'])assert.equal(c[p].status,'REVISE',k+p);
  for(const p of ['side','sequence','bg_composite'])assert.equal(c[p].status,'PASS',k+p)}
 assert.ok(R.candidates.v09r.front_legs.issues.includes('LEG_STRIP'));assert.ok(R.candidates.v09r.front_torso.issues.includes('TORSO_STATIC'));assert.ok(R.candidates.v09r.front_torso.fixed.includes('STRAP_FLOAT'));
 assert.ok(Object.values(R.requests).every(r=>r.status==='OPEN'));const q=J('asset-source/v09_QA/art_revision_requests_v09.json');assert.deepEqual(q.closed,[]);
 for(const r of q.requests){assert.ok(r.frames&&r.required_art&&r.evidence.length,r.id);assert.ok(r.joints_px||r.reference_px,r.id+' has coordinates');for(const e of r.evidence)assert.ok(existsSync(P(e)),e)}
 assert.equal(R.game_applied,false);const walk=J('room404/dist/data/walk_clips.json');assert.equal(clipUsable(walk.npcs.NPC06.v06),false);assert.ok(!JSON.stringify(walk).includes('v09'));
 for(const f of readdirSync(P('room404/dist'),{recursive:true}).filter(f=>/\.(js|json|html)$/.test(f)))assert.ok(!readFileSync(P('room404/dist/'+f),'utf8').includes('v09_'),f);
 const m=J('docs/missing_assets_request.json'),leg=m.requests.find(r=>r.assetId==='NPC06/walk/LEG_STRIP');assert.equal(leg.latest_attempt.review,'asset-source/v09_QA/review_v09.json');assert.ok(Object.values(leg.latest_attempt.requests).every(s=>s==='OPEN'));
 assert.ok(m.requests.some(r=>r.assetId==='NPC06/walk/SLEEVE_FABRIC'))});

test('QA viewer atlases: v09 and v09r, 263 frames each at full render scale, REVISE, files present',()=>{
 for(const rev of ['v09','v09r']){const a=J(`asset-source/v09_QA/${rev}/atlas.json`);assert.equal(a.revision,rev);assert.equal(a.frames,263);assert.equal(a.scale,1);assert.equal(a.qa_status,'REVISE');assert.equal(a.art,rev);assert.equal(a.engine_applied,false);
  assert.ok(existsSync(P(`asset-source/v09_QA/${rev}/atlas.webp`)));assert.deepEqual(a.clips.turn.art,['front','side','rear'])}
 const pb=J('asset-source/v09_QA/viewer_playback_v09.json');for(const rev of ['v09','v09r']){assert.ok(Math.abs(pb[rev+'_24'].fps_measured-24)<1);assert.ok(Math.abs(pb[rev+'_12'].fps_measured-12)<.5);assert.equal(pb[rev+'_24'].last,214)}
 assert.deepEqual(pb.errors,[])});
