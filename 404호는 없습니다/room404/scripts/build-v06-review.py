#!/usr/bin/env python3
"""v06 frame review -> per-NPC/per-view statuses, criteria, the resolution of every v05 request, and what stays open.

  python3 scripts/build-v06-review.py      (after scripts/analyze-v06-frames.py)

Inputs: ../asset-source/v06_QA/visual_review_v06.json (what was seen on the real v06 frames, by the reviewer),
        ../asset-source/v06_QA/<NPC>/metrics_v06.json (measurements), and
        ../asset-source/v05_QA/frame_qa/production_requests_v05.json (the 64 requests this revision answers).
Status rule (same as v0.17): PASS only when the view has no open issue and every measured criterion passes. An issue that
needs new art stays open (REVISE) whatever the renderer changed. The v05 package status is never raised by this script.
Outputs (../asset-source/v06_QA/): review_summary_v06.json (read by build-walk-binding.py and the QA viewer),
production_requests_v06.json (open requests with the art each one needs + resolution of the v05 requests).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AS = os.path.join(os.path.dirname(ROOT), 'asset-source')
QA = os.path.join(AS, 'v06_QA')
VIEWS = ['front', 'side', 'rear']

def view_criteria(view, issues, m):
    s = m['views'].get(view); seen = lambda *ids: 'REVISE' if any(i in issues for i in ids) else 'PASS'
    if not s: return {'measured': 'MISSING'}
    sole, slide = s['sole_vs_rig_px'], s['planted_shoe_slide_px']; sh = s['shadow_under_shoe']
    c = {'alternation': 'PASS' if s.get('alternates') and len(s.get('heel_strikes', [])) >= 2 else 'REVISE',
         'planted_foot': 'PASS' if not slide or slide['max'] <= 1.5 else 'REVISE',
         'contact': 'PASS' if sole and -10 <= sole['min'] and sole['max'] <= 3 else 'REVISE',  # shadow-under-shoe is reported, not gated (v0.17 rule)
         'consistency': 'PASS' if s['head_width_ratio']['cv'] <= .02 and s['height_ratio']['cv'] <= .05 else 'REVISE',
         'perspective': 'PASS',  # every joint goes through the BG02 camera of camera_v06.json (one copy of the constants)
         'joints': seen('LEG_STRIP', 'FAR_ARM', 'ARM_LONG'), 'rotation': seen('TORSO_STATIC'), 'arms': seen('FAR_ARM', 'ARM_LONG', 'CARRY_STATIC', 'TORSO_STATIC')}
    if view in ('front', 'rear'): c['knee_band'] = 'PASS' if m['knee_band']['v06_enter_exit']['below_250'] == 0 else 'REVISE'
    if view == 'side': c['knee_load'] = 'PASS' if m['knee']['v06_flat_frames_over_25'] == 0 else 'REVISE'
    return c

def sequence_criteria(issues, m):
    ref = max(m['walk_step_reference']['enter']['root_px']['max'], m['walk_step_reference']['exit']['root_px']['max'])
    href = max(m['walk_step_reference']['enter']['head_rig_px']['max'], m['walk_step_reference']['exit']['head_rig_px']['max'])
    seams = m['seams']; moved = [v for r in seams for v in r['resting_feet_moved_mm'].values()]
    slides = [v['max_mm'] for v in m['resting_contact_slide'].values()]
    return {'path': 'PASS' if all(r['root_px'] <= ref for r in seams) and m['enter_end_vs_exit_start']['root_gap_m'] < .5 else 'REVISE',
            'resting_feet': 'PASS' if max(moved + slides + [0]) <= 1.0 else 'REVISE',
            'head': 'PASS' if all(r['head_rig_px'] <= href for r in seams) and all(abs(r['head_width_change']) <= .10 for r in seams) else 'REVISE',
            'turn_idle': 'REVISE' if any(i in issues for i in ('NO_TURN_IDLE', 'PATH_GAP', 'TURN_POP')) else 'PASS'}

def main():
    review = json.load(open(os.path.join(QA, 'visual_review_v06.json')))
    v05 = json.load(open(os.path.join(AS, 'v05_QA', 'frame_qa', 'production_requests_v05.json')))['requests']
    summary = {'reviewed': review['reviewed'], 'reviewer': review['reviewer'], 'rule': review['status_rule'], 'npcs': {}}
    open_requests, metrics = [], {}
    for npc, views in review['npcs'].items():
        m = json.load(open(os.path.join(QA, npc, 'metrics_v06.json'))); metrics[npc] = m; entry = {}
        for view in VIEWS + ['sequence']:
            issues = views.get(view, []); crit = sequence_criteria(issues, m) if view == 'sequence' else view_criteria(view, issues, m)
            entry[view] = {'status': 'PASS' if not issues and all(v == 'PASS' for v in crit.values()) else 'REVISE', 'issues': issues, 'criteria': crit}
            for iss in issues:
                info = review['issues'][iss]
                open_requests.append({'id': f'{npc}-{view}-{iss}', 'npc': npc, 'view': view, 'issue': iss, 'priority': info['priority'],
                                      'v06_change': info['v06_change'], 'still_wrong': info['still_wrong'], 'needs_new_art': info['needs_new_art'],
                                      'art_spec': {**info['art_spec'], 'character': npc, 'view': view}, 'evidence': [e.replace('<NPC>', npc) for e in info['evidence']]})
        # v05 played exit right after enter, so its gap was enter end -> exit start. v06 has settle/idle/turn/start in
        # between: that distance is walked on screen; the continuity measure is the largest root jump between two
        # consecutive frames at any segment boundary (what stage.js clipUsable reads as enter_exit_gap_m for v06).
        entry['enter_end_to_exit_start_m'] = m['enter_end_vs_exit_start']['root_gap_m']
        entry['max_seam_root_m'] = max(r['root_world_m'] for r in m['seams'])
        summary['npcs'][npc] = entry
    # every v05 request: what v06 did with it
    resolution = []
    for r in v05:
        npc, view, iss = r['npc'], r['view'], r['issue']; still = iss in review['npcs'][npc].get(view, [])
        info = review['issues'].get(iss) if still else review['resolved'].get(iss)
        resolution.append({'id': r['id'], 'priority': r['priority'], 'status': 'OPEN' if still else 'RESOLVED_V06',
                           'how': (info or {}).get('v06_change') or (info or {}).get('how'), 'needs_new_art': bool(still and info and info.get('needs_new_art'))})
    counts = {}
    for x in resolution: counts.setdefault(x['priority'], {}).setdefault(x['status'], 0); counts[x['priority']][x['status']] += 1
    json.dump(summary, open(os.path.join(QA, 'review_summary_v06.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'source': 'scripts/build-v06-review.py from visual_review_v06.json + metrics_v06.json', 'reviewed': review['reviewed'],
               'note': 'Open requests after v06. needs_new_art = the existing part art cannot express it; art_spec says what to paint. Frames refer to the v06 clips (QA atlas clips enter/exit/pass).',
               'v05_requests': len(v05), 'v05_resolution_counts': counts, 'v05_resolution': resolution, 'requests': open_requests},
              open(os.path.join(QA, 'production_requests_v06.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tally = {}
    for npc, e in summary['npcs'].items():
        for view in VIEWS + ['sequence']: tally.setdefault(view, {}).setdefault(e[view]['status'], 0); tally[view][e[view]['status']] += 1
        print(npc, ' '.join(f"{v}:{e[v]['status']}" for v in VIEWS + ['sequence']), 'max seam root m', e['max_seam_root_m'], 'walked enter end -> exit start m', e['enter_end_to_exit_start_m'])
    print('per view', tally); print('v05 requests', len(v05), counts, 'open now', len(open_requests))

if __name__ == '__main__':
    main()
