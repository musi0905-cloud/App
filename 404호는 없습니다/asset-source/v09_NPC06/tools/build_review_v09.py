#!/usr/bin/env python3
"""NPC06 v09 review record: asset-source/v09_QA/review_v09.json (read by the QA viewer and the request/registry builders).

  python3 -B -I tools/build_review_v09.py

The verdicts below are the reviewer's, made on the real frames (BG02 composites, knee/shoulder close-ups, the QA viewer at
24 fps, 12 fps and frame by frame); every number is read here from this repository's own measurements:
asset-source/v09_QA/metrics_v09.json (analyze_v09.py), fold_position_v09.json (fold_position.py) and
viewer_playback_v09.json (viewer_capture.mjs). Same rule as v06: a part is PASS only with no open issue; equal joint
coordinates never make a picture PASS; format and reproduction checks are recorded separately.
"""
import json, os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); QA = os.path.join(os.path.dirname(HERE), 'v09_QA')
J = lambda *p: json.load(open(os.path.join(*p)))
M = J(QA, 'metrics_v09.json'); FOLD = J(QA, 'fold_position_v09.json'); PLAY = J(QA, 'viewer_playback_v09.json'); IMP = J(HERE, 'IMPORT_v09.json')
run = {r['label']: r for r in M['runs']}; D, V9, VR = run['default'], run['v09'], run['v09r']
L = lambda r, v, k, q='median': r['legs'][v][k][q]
H = lambda r, seg: r['holes']['by_segment'].get(seg, {'with_holes': 0, 'frames': 0, 'px': 0, 'max_px': 0})
def hole_txt(r, segs): return ', '.join(f"{s} {H(r, s)['with_holes']}/{H(r, s)['frames']}프레임 {H(r, s)['px']}px(최대 {H(r, s)['max_px']})" for s in segs)
def legs_numbers(r, v):
    return {'neck_median_p95': [L(r, v, 'neck'), L(r, v, 'neck', 'p95')], 'step_px_median_p95': [L(r, v, 'step_px'), L(r, v, 'step_px', 'p95')],
            'seam_ratio_median_p95': [L(r, v, 'seam_ratio'), L(r, v, 'seam_ratio', 'p95')], 'rim_band_median': L(r, v, 'rim_band'),
            'baseline_v06': {'neck': [L(D, v, 'neck'), L(D, v, 'neck', 'p95')], 'step_px': [L(D, v, 'step_px'), L(D, v, 'step_px', 'p95')], 'seam_ratio': [L(D, v, 'seam_ratio'), L(D, v, 'seam_ratio', 'p95')]}}
sw = lambda r: {str(s['at']): {'figure_iou': s['figure_iou'], 'head_width_change': s['head_width_change'], 'box_height_change': s['box_height_change']} for s in r['switches']}
suite = D['suite']['views']
common = {
    'side': {'status': 'PASS', 'issues': [], 'why': 'side pass 48/48 PNG byte-identical to v06 (verify_v09.py) and turn side frames unchanged; v06 side PASS stands',
             'numbers': {'alternates': suite['side']['alternates'], 'planted_slide_px_max': suite['side']['planted_shoe_slide_px']['max'], 'shadow_under_shoe': suite['side']['shadow_under_shoe']}},
    'sequence': {'status': 'PASS', 'issues': [], 'why': 'joint paths, feet and shadows identical to v06 in all 263 frames (verify_v09.py geometry); resting feet do not slide (0.0 mm in every synthesised segment); the view switches change shape no more than v06',
                 'numbers': {'resting_slide_mm_max': max(v['max_mm'] for v in D['suite']['resting_contact_slide'].values()), 'enter_end_to_exit_start_m': D['suite']['enter_end_vs_exit_start']['root_gap_m']}},
    'bg_composite': {'status': 'PASS', 'issues': [], 'why': 'same BG02 camera and contact shadows as v06: sole vs rig floor line front %.2f / rear %.2f px, shadow under the planted shoe front %d/%d, rear %d/%d; figure not relit (same as v06)' % (
        suite['front']['sole_vs_rig_px']['mean'], suite['rear']['sole_vs_rig_px']['mean'], suite['front']['shadow_under_shoe']['inside'], suite['front']['shadow_under_shoe']['frames'], suite['rear']['shadow_under_shoe']['inside'], suite['rear']['shadow_under_shoe']['frames'])},
}
f9, fr = FOLD['v09'], FOLD['v09r']
def twist(r):
    rows = [x for x in r['vs_baseline']['torso_shift']['rows'] if x['seg'] in ('enter', 'exit')]
    return max(abs(x['shift_px_top_mid_low'][0] - x['shift_px_top_mid_low'][2]) for x in rows)
def fold_txt(f, v): x = f[v]['dark_fold_px_from_knee']; return f"주름 중심 {x['min']}~{x['max']}px(중앙 {x['median']}), 어둡게 {f[v]['darkening_luma']['median']} luma"
rec = {
    'npc': 'NPC06', 'reviewed': '2026-10-15', 'reviewer': 'Claude Code (이 저장소의 재렌더 실프레임)', 'rule': __doc__.split('Same rule as v06: ')[1].strip(),
    'reproduction': {'drive_frames_vs_this_repo_v09': '263/263 PNG + frames.json byte-identical', 'verify_v09_py': 'PASS (default 263/263 = reference, side 48/48, geometry 263/263)',
                     'npm_ci': IMP['dependencies']['result'], 'node': IMP['dependencies']['node'], 'canvas': IMP['dependencies']['canvas']},
    'viewer_playback': {k: v for k, v in PLAY.items() if k != 'errors'}, 'viewer_errors': PLAY['errors'], 'reviewed': '2026-10-15',
    'game_applied': False, 'game_rule': 'NPC06 걷기는 정면·후면·연결이 모두 PASS일 때만 게임에 씀(stage.js clipUsable). 이번에도 켜지 않음.',
    'candidates': {
        'v09': {'status': 'REVISE', 'what': '제작 측 v09: render_v06.js --art=v09 (material_v09.js). 이 저장소에서 다시 렌더한 263장이 Drive 전달본과 같음.',
                'front_legs': {'status': 'REVISE', 'issues': ['LEG_STRIP', 'V09_KNEE_LINE', 'V09_FOLD_ABOVE_KNEE'], 'numbers': legs_numbers(V9, 'front'), 'fold': fold_txt(f9, 'front'),
                               'note': '무릎 폭 단차는 사라졌지만(목조임 %.3f) 허벅지·정강이 조각의 둥근 끝 행을 가로로 늘려 무릎에 가로선이 생김(이음선 비율 p95 %.2f, v06 %.2f; 30-37 L이 최악). 바지색 ΔE %.2f, 직조 %.3f배.' % (
                                   L(V9, 'front', 'neck'), L(V9, 'front', 'seam_ratio', 'p95'), L(D, 'front', 'seam_ratio', 'p95'), V9['vs_baseline']['trouser_delta_e76']['median'], V9['vs_baseline']['weave_ratio']['median'])},
                'rear_legs': {'status': 'REVISE', 'issues': ['LEG_STRIP', 'V09_FOLD_ABOVE_KNEE'], 'numbers': legs_numbers(V9, 'rear'), 'fold': fold_txt(f9, 'rear')},
                'front_torso': {'status': 'REVISE', 'issues': ['TORSO_STATIC', 'V09_YAW_REVERSED', 'WHOLE_TILT', 'STRAP_FLOAT', 'SLEEVE_ABOVE_SHOULDER', 'SLEEVE_FABRIC'],
                                'note': '몸통 UV 이동이 2px 안팎이고 어깨가 앞으로 나오는 쪽으로 움직임(실제 회전의 반대). 그림 전체를 어깨선 각도로 기울임. 가방끈 꼭짓점이 리그 어깨점에 붙어 그림 어깨보다 10~15px 위·바깥에 떠 끈과 팔 사이로 배경이 보임: ' + hole_txt(V9, ['enter/front', 'idle/front'])},
                'rear_torso': {'status': 'REVISE', 'issues': ['TORSO_STATIC', 'V09_YAW_REVERSED', 'WHOLE_TILT', 'STRAP_FLOAT', 'SLEEVE_ABOVE_SHOULDER', 'SLEEVE_FABRIC'], 'note': '끈이 어깨 위에 뜸: ' + hole_txt(V9, ['start/rear', 'exit/rear', 'turn/rear'])},
                **common, 'view_switches': sw(V9)},
        'v09r': {'status': 'REVISE', 'what': 'v09를 이 저장소에서 다시 고친 것: render_v06.js --art=v09r (material_v09r.js). 둥근 끝 없는 무릎 텍스처, 무릎 위치 주름, 골반→어깨 비틀림과 올바른 방향의 원통 yaw, 소매 윗끝과 가방끈을 그림 어깨에 맞춤.',
                 'front_legs': {'status': 'REVISE', 'issues': ['LEG_STRIP'], 'fixed': ['V09_KNEE_LINE', 'V09_FOLD_ABOVE_KNEE', 'knee notch'], 'numbers': legs_numbers(VR, 'front'), 'fold': fold_txt(fr, 'front'),
                                'note': '단차·가로선 없음, 주름은 투영 무릎 바로 위(무릎뼈 위 접힘). 남은 것: 발뒤꿈치 착지(정면 40-47)에서 무릎 모양·겹침이 없는 곧은 관 — 원화가 필요(v06 LEG_STRIP 그대로). 바지색 ΔE %.3f, 직조 %.3f배.' % (VR['vs_baseline']['trouser_delta_e76']['median'], VR['vs_baseline']['weave_ratio']['median'])},
                 'rear_legs': {'status': 'REVISE', 'issues': ['LEG_STRIP'], 'fixed': ['V09_FOLD_ABOVE_KNEE', 'knee notch'], 'numbers': legs_numbers(VR, 'rear'), 'fold': fold_txt(fr, 'rear'), 'note': '남은 것: 착지(퇴장 0-8 = 시퀀스 167-175)에서 곧은 관.'},
                 'front_torso': {'status': 'REVISE', 'issues': ['TORSO_STATIC', 'SLEEVE_FABRIC'], 'fixed': ['V09_YAW_REVERSED', 'WHOLE_TILT', 'STRAP_FLOAT', 'SLEEVE_ABOVE_SHOULDER'],
                                 'note': f'비틀림은 리그 크기(위·아래 반대 이동, 최대 차 {twist(VR)}px; v09 {twist(V9)}px)로 보이지만 평면 그림 한 장이라 입체 회전은 아님. 끈 꼭짓점이 가디건 어깨에 얹힘: ' + hole_txt(VR, ['enter/front', 'idle/front']) + '. 소매 직물(밝은 굵은 니트)과 가디건이 다름 — 원화.'},
                 'rear_torso': {'status': 'REVISE', 'issues': ['TORSO_STATIC', 'SLEEVE_FABRIC', 'TURN_REAR_STRAP'], 'fixed': ['V09_YAW_REVERSED', 'WHOLE_TILT', 'STRAP_FLOAT', 'SLEEVE_ABOVE_SHOULDER'],
                                'note': hole_txt(VR, ['start/rear', 'exit/rear', 'turn/rear']) + '. 회전 142-147(몸 방향 136-158도)에서 왼팔이 몸 뒤로 가려 끈 바깥쪽과 몸통 옆선 사이로 배경 — v06보다 작지만 남음(3/4 후면 원화 필요).'},
                 **common, 'view_switches': sw(VR)},
    },
    'requests': {
        'NPC06-front-LEG_STRIP': {'status': 'OPEN', 'v09': 'REVISE', 'v09r': 'REVISE (notch, knee line and fold placement fixed in code; knee shape at heel strike needs art)'},
        'NPC06-rear-LEG_STRIP': {'status': 'OPEN', 'v09': 'REVISE', 'v09r': 'REVISE (same)'},
        'NPC06-front-TORSO_STATIC': {'status': 'OPEN', 'v09': 'REVISE', 'v09r': 'REVISE (twist and yaw at the rig size; still one flat picture)'},
        'NPC06-rear-TORSO_STATIC': {'status': 'OPEN', 'v09': 'REVISE', 'v09r': 'REVISE (same)'},
    },
    'issues': {
        'V09_KNEE_LINE': 'v09: the thigh piece’s rounded knee end (dark outline) and the shin piece’s rounded top (light rim) are inside the knee cross-fade, and the row stretch widens them across the leg: a horizontal line at the knee',
        'V09_FOLD_ABOVE_KNEE': 'v09: the fold shading sits 3-8 px above the projected knee',
        'V09_YAW_REVERSED': 'v09: torso texture moves ~1-2 px toward the shoulder that comes forward (the turn would move it the other way)',
        'WHOLE_TILT': 'v06/v09: the torso is one picture rotated by the shoulder line about the waist, so its hem tilts against the pelvis piece',
        'STRAP_FLOAT': 'v06/v09: the bag strap apex is pinned to the rig shoulder point, 10-15 px above and outside the painted cardigan shoulder: background between the strap and the shoulder/arm',
        'SLEEVE_ABOVE_SHOULDER': 'v06/v09: the sleeve top starts at the rig shoulder, above the painted shoulder line, so its round cap shows as a puff',
        'SLEEVE_FABRIC': 'art: the sleeves (NPC06_continuous_arms_v03.png) are a lighter, coarser knit than the cardigan body in the parts atlas, constant 92 px wide over the top 40 % of the arm: they read as a separate puffy garment',
        'TURN_REAR_STRAP': 'art/turn: rear picture used at 136-158 deg during the turn while the left arm is hidden behind the body; the strap hangs outside the torso edge (3/4 rear art, see TURN_45)',
    },
}
json.dump(rec, open(os.path.join(QA, 'review_v09.json'), 'w'), ensure_ascii=False, indent=1)
print('review_v09.json:', {k: {p: rec['candidates'][k][p]['status'] for p in ('front_legs', 'rear_legs', 'front_torso', 'rear_torso', 'side', 'sequence', 'bg_composite')} for k in rec['candidates']})
