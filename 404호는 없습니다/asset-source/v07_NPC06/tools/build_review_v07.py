#!/usr/bin/env python3
"""NPC06 v07 verdicts: format, binding and visual quality kept apart, per view and for the sequence.

  python3 -I tools/build_review_v07.py      (after analyze_v07.py)

Inputs: IMPORT_v07.json and binding_v07.json (this folder), asset-source/v07_QA/visual_review_v07.json (the reviewer's
findings on the real frames), asset-source/v07_QA/NPC06/metrics_v07.json (measurements), production_requests_v06.json
(the four requests this art answers) and room404/dist/data/walk_clips.json (read only: what the game would use).
Rules: the v06 criteria are applied unchanged (room404/scripts/build-v06-review.py view_criteria / sequence_criteria on
the v07 frames), plus measured v07 criteria for the new failure modes. A view is PASS only with no open issue and every
criterion PASS. Requests are never resolved by receiving art. Output: asset-source/v07_QA/review_summary_v07.json.
"""
import importlib.util, json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(HERE))
QA = os.path.join(PROJECT, 'asset-source', 'v07_QA')
J = lambda *p: json.load(open(os.path.join(*p), encoding='utf-8'))
spec = importlib.util.spec_from_file_location('r6', os.path.join(PROJECT, 'room404', 'scripts', 'build-v06-review.py')); R6 = importlib.util.module_from_spec(spec); spec.loader.exec_module(R6)
REQUESTS = ['NPC06-front-LEG_STRIP', 'NPC06-rear-LEG_STRIP', 'NPC06-front-TORSO_STATIC', 'NPC06-rear-TORSO_STATIC']

def as_v06(m):
    """The v07 render's measurements in the shape build-v06-review.py reads."""
    return {'views': m['views'], 'knee_band': {'v06_enter_exit': m['knee_band']['enter_exit']}, 'knee': {'v06_flat_frames_over_25': m['knee']['flat_frames_over_25']},
            'walk_step_reference': m['walk_step_reference'], 'seams': m['seams'], 'resting_contact_slide': m['resting_contact_slide'], 'enter_end_vs_exit_start': m['enter_end_vs_exit_start']}

def v07_criteria(view, M):
    c = M['v07_checks']; seg = {'front': 'enter', 'rear': 'exit'}[view]; cj = c['summary']['cuff_join'][view]; tr = c['same_state_travel_max'][seg]
    ks = [r for r in c['knee_sideways_rows'] if r['view'] == view and r['seg'] == seg]
    sw = [r for r in c['leg_switches'] if r['seg'].startswith(seg) and r['seg'].split('->')[1].startswith(seg)]
    ts = [r for r in c['torso_switches'] if r['seg'].startswith(seg) and r['seg'].split('->')[1].startswith(seg)]
    col = c['summary']['colour'][view]
    out = {'cuff_join': 'PASS' if cj['holes'] == 0 and cj['top_holes'] == 0 and cj['below_sole'] == 0 and cj['covers_over_half_shoe'] == 0 else 'REVISE',
           'knee_line': 'PASS' if max(abs(r['sideways_rel_leg']) for r in ks) <= .03 else 'REVISE',
           'state_switch': 'PASS' if all(r['leg_iou'] >= tr['iou_min'] for r in sw) else 'REVISE',
           'material': 'PASS' if col['v07_pelvis_vs_legs_dE76']['median'] <= col['v06_pelvis_vs_legs_dE76']['median'] + 1.0 else 'REVISE',
           'torso_switch': 'PASS' if all(r['pixel_change'] <= tr['torso_pixel_change'] for r in ts) else 'REVISE'}
    detail = {'cuff_join': cj, 'knee_line_max_rel': max(abs(r['sideways_rel_leg']) for r in ks),
              'state_switch': {'switches': len(sw), 'below_same_state_overlap': sum(r['leg_iou'] < tr['iou_min'] for r in sw), 'same_state_overlap_min': tr['iou_min'],
                               'overlap_range': [min(r['leg_iou'] for r in sw), max(r['leg_iou'] for r in sw)] if sw else None},
              'material': {'v07_median_dE76': col['v07_pelvis_vs_legs_dE76']['median'], 'v06_median_dE76': col['v06_pelvis_vs_legs_dE76']['median'], 'v07_legs_lab': col['v07_legs_lab_mean'], 'v06_legs_lab': col['v06_legs_lab_mean']},
              'torso_switch': {'switches': len(ts), 'pixel_change': [r['pixel_change'] for r in ts], 'same_picture_max': tr['torso_pixel_change']}}
    return out, detail

def main():
    imp = J(HERE, 'IMPORT_v07.json'); B = J(HERE, 'binding_v07.json'); review = J(QA, 'visual_review_v07.json'); M = J(QA, 'NPC06', 'metrics_v07.json')
    pr = {q['id']: q for q in J(PROJECT, 'asset-source', 'v06_QA', 'production_requests_v06.json')['requests']}; walk = J(PROJECT, 'room404', 'dist', 'data', 'walk_clips.json')
    m7 = as_v06(M['v07']); m6 = as_v06(M['v06'])
    fmt = {'status': 'PASS' if imp['result'] == 'ALL_MATCH' else 'FAIL', 'what': 'hash, bytes, full decode, 1536x1024 RGBA, alpha>128 components 6/6/4 and their boxes equal to the producer manifest (6 files; v07a drafts included)', 'alpha_max': sorted({r['alpha_max'] for r in imp['files']})}
    parts = sum(len(B['legs'][v]['parts']) for v in ('front', 'rear')) + len(B['torso']['cells'])
    bind = {'status': 'PASS' if parts == 16 and all(p['top_attach'] and p['cuff_attach'] for v in ('front', 'rear') for p in B['legs'][v]['parts']) else 'FAIL',
            'parts_bound': parts, 'leg_states': 12, 'torso_cells': 4, 'anchor': M['renders']['v07_anchor'], 'calibration': M['renders']['v07_calibration'],
            'what': 'every v07b state picture placed from measured attach points at one fixed scale per sheet; a binding PASS says the pictures are wired, not that they look right'}
    out = {'npc': 'NPC06', 'reviewed': review['reviewed'], 'rule': review['status_rule'], 'art': 'v07b (3 sheets, 16 state pictures)', 'format_check': fmt, 'binding_check': bind,
           'same_rig_geometry_every_frame': M['same_rig_geometry_every_frame'], 'side_pass_frames_identical_to_v06': M['side_pass_frames_identical_to_v06'], 'views': {}}
    for view in ('front', 'side', 'rear', 'sequence'):
        issues = review['views'][view]
        if view == 'sequence':
            crit = R6.sequence_criteria(issues, m7); c = M['v07_checks']; synth = ('settle', 'idle', 'turn', 'start')
            tr = c['same_state_travel_max']; iou_min = min(tr['enter']['iou_min'], tr['exit']['iou_min']); tmax = max(tr['enter']['torso_pixel_change'], tr['exit']['torso_pixel_change'])
            sw = [r for r in c['leg_switches'] if any(r['seg'].split('->')[k].rstrip('0123456789') in synth for k in (0, 1))]
            ts = [r for r in c['torso_switches'] if any(r['seg'].split('->')[k].rstrip('0123456789') in synth for k in (0, 1))]
            crit['v07_switches_outside_walk'] = 'PASS' if all(r['leg_iou'] >= iou_min for r in sw) and all(r['pixel_change'] <= tmax for r in ts) else 'REVISE'
            crit['v07_cuff_join_all_segments'] = 'PASS' if all(c['summary']['cuff_join'][v]['all_segments']['holes'] == 0 and c['summary']['cuff_join'][v]['all_segments']['top_holes'] == 0 for v in ('front', 'rear')) else 'REVISE'
            detail = {'leg_switches': [(r['seg'], r['side'], r['from'], r['to'], r['leg_iou']) for r in sw], 'torso_switches': [(r['seg'], r['from'], r['to'], r['pixel_change']) for r in ts],
                      'v06_criteria_on_v06_render': R6.sequence_criteria([], m6)}
        else:
            crit = R6.view_criteria(view, issues, m7); detail = {'v06_criteria_on_v06_render': R6.view_criteria(view, ['LEG_STRIP', 'TORSO_STATIC'] if view != 'side' else [], m6)}
            if view != 'side': c7, d7 = v07_criteria(view, M); crit.update(c7); detail.update(d7)
        out['views'][view] = {'status': 'PASS' if not issues and all(v == 'PASS' for v in crit.values()) else 'REVISE', 'issues': issues, 'criteria': crit, 'detail': detail}
    # the four requests: never resolved by delivery; resolved only if every view they belong to passes with the issue gone
    reqs = []
    for rid in REQUESTS:
        q = pr[rid]; v = out['views'][q['view']]
        reqs.append({'id': rid, 'priority': q['priority'], 'status': 'OPEN' if q['issue'] in v['issues'] or v['status'] != 'PASS' else 'RESOLVED_V07',
                     'v07_art': {'LEG_STRIP': {'front': 'NPC06_정면다리_깊이수정_v07b.png', 'rear': 'NPC06_후면다리_경계검토_v07b.png'}, 'TORSO_STATIC': {'front': 'NPC06_몸통회전_단추수정_v07b.png (top row)', 'rear': 'NPC06_몸통회전_단추수정_v07b.png (bottom row)'}}[q['issue']][q['view']],
                     'why': review['v06_issues_still_open'][q['issue']], 'view_status': v['status'], 'blocking_issues': [i for i in v['issues'] if i != q['issue']]})
    out['requests'] = reqs; out['requests_resolved'] = sum(r['status'] != 'OPEN' for r in reqs)
    # game: clipUsable needs qa_status PASS, front, rear and sequence PASS (stage.js); nothing is written to the game data here
    usable = all(out['views'][v]['status'] == 'PASS' for v in ('front', 'rear', 'sequence'))
    n6 = walk['npcs']['NPC06']['v06']
    out['game'] = {'clipUsable_would_pass': usable, 'applied': False, 'walk_clips_NPC06_v06_review': n6['review'], 'walk_clips_NPC06_qa_status': n6['qa_status'],
                   'note': 'NPC06 stays a static visitor (no walk clip in a game scene). walk_clips.json, character_assets.json and the visitor role switch are not changed by v07.'}
    json.dump(out, open(os.path.join(QA, 'review_summary_v07.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('format', fmt['status'], 'binding', bind['status'], 'parts', parts)
    for v, e in out['views'].items(): print(v, e['status'], {k: x for k, x in e['criteria'].items()}, e['issues'])
    print('requests', [(r['id'], r['status']) for r in reqs], 'resolved', out['requests_resolved'], 'game usable', usable)
    for v in ('front', 'rear'): print(v, json.dumps({k: out['views'][v]['detail'][k] for k in ('knee_line_max_rel', 'state_switch', 'material', 'torso_switch')}))
    print('sequence', json.dumps(out['views']['sequence']['detail']))

if __name__ == '__main__':
    main()
