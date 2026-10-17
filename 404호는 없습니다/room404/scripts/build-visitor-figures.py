"""data/visitor_figures.json (v0.19.0): which picture each gate visitor gets, for every case the game can reach, and
why. Run from the project folder after build-runtime-clips.py:  python3 -B -I room404/scripts/build-visitor-figures.py

The rule is the one in room404/dist/figures.js (cctvPlan/figureFor); tests/figures.test.mjs re-derives every row with
the game's own code. Reachable cases: the 100 daily pairs (story_visitors.json anomaly_id), the fixed night-1 list
(engine.js newRun 'story') and the 32 story slots of nights 2-5 (story_slots.json).
"""
import hashlib, json, os
import numpy as np
from PIL import Image

ROOT = os.getcwd(); DIST = os.path.join(ROOT, 'room404', 'dist'); D = os.path.join(DIST, 'data')
J = lambda p: json.load(open(p, 'rb'))
visitors = J(os.path.join(D, 'visitors.json')); anomalies = J(os.path.join(D, 'anomalies.json')); scenarios = {s['id']: s for s in J(os.path.join(D, 'scenarios.json'))}
story_visitors = J(os.path.join(D, 'story_visitors.json')); slots = J(os.path.join(D, 'story_slots.json')); chars = J(os.path.join(D, 'character_assets.json'))
side = J(os.path.join(DIST, 'assets', 'clips', 'side', 'side.json'))
clip_path = os.path.join(DIST, 'assets', 'clips', 'NPC06_v10r5', 'clip.json'); clip = J(clip_path)
V = {v['id']: v for v in visitors}

# Scenarios whose CCTV clue depends on which way the visitor walks across the frame (the replay draws a cross
# left -> right). A role side walk goes screen-left and is never mirrored, so these keep the legacy look.
DIRECTION_BOUND = {
    'A075': '“방문객이 더 밝은 조명 쪽으로 걸어가요”: 공동현관 CCTV는 오른쪽이 밝다(cctv-lobby 열 평균 밝기 왼쪽 43, 가운데·오른쪽 64~76). 왼쪽으로 걸으면 어두운 쪽으로 가게 돼 단서가 뒤집힌다.',
    'A038': '“사람이 걸어온 쪽과 발자국 방향을 비교하세요”: 발자국은 오른쪽 위로 그려진다. 걷는 방향을 바꾸면 비교 대상이 달라진다.',
}
ROLE_LOOK = {'택배 기사': 5, '시설 점검': 6, '돌봄 방문': 7, '지인': 8}
def look_for(v): return ROLE_LOOK.get(v['role']) or (int(v['id'][1:]) - 1) % 4 + 1

def plan(sc, npc):
    needs, missing = [], []
    for s in sc['scenes']:
        if s.get('mode') == 'repeat': need = 'walk_front_rear'
        elif s['action'] in ('wait', 'pan'): need = 'stand'
        elif s['action'] == 'cross': need = 'walk_side'
        elif s['action'] in ('enter', 'descend'): need = 'walk_front_rear'
        else: need = 'gesture_' + s['action']
        if need not in needs: needs.append(need)
        if need == 'stand': continue
        if need == 'walk_side' and npc in side['npcs'] and sc['id'] not in DIRECTION_BOUND: continue
        why = ('direction_bound' if sc['id'] in DIRECTION_BOUND else 'no_side_clip') if need == 'walk_side' else need
        if why not in missing: missing.append(why)
    return {'ok': not missing and bool(needs), 'needs': needs, 'missing': missing}

def head_box(fig):
    """Head of a still role figure (image px): the opaque rows from the top of the head down 13% of the figure height,
    x from those rows' extent. Used for the CCTV close-ups (faceLock, preMove) and the registered-photo boxes."""
    a = np.asarray(Image.open(os.path.join(DIST, fig['file'])).getchannel('A')); top = fig['foot'][1] - fig['height_px']; h = round(fig['height_px'] * .13)
    rows = a[int(top):int(top + h)] > 128; xs = np.nonzero(rows.any(0))[0]
    return [int(xs.min()), int(top), int(xs.max() - xs.min() + 1), int(h)]

cases = {}
def add(vid, aid, run):
    cases.setdefault((vid, aid), []).append(run)
for sv in story_visitors: add(sv['id'], sv['anomaly_id'], 'daily')
for o, p in zip([60, 0, 70, 20, 80, 40, 93, 30], [0, 11, 24, 35, 46, 57, 62, 79]): add(visitors[p]['id'], anomalies[o]['id'], 'night1')
for s in slots: add(s['gate_visitor_id'], s['anomaly_id'], f"night{s['night']}:{s['scene_id']}")

record = {
    'npc': 'NPC06', 'revision': 'v10r5', 'clip': 'assets/clips/NPC06_v10r5/clip.json', 'clip_sha256': hashlib.sha256(open(clip_path, 'rb').read()).hexdigest(),
    'visual_status': 'REVISE', 'qa_status': 'REVISE',
    'visual_note': '시각 판정은 REVISE 그대로다. 아래 네 가지 한계는 해결되지 않았고, 사용자가 이번 게임 적용에서 수용했다.',
    'user_accepted_limitations': ['다리 볼륨: 정면·후면 다리가 관 모양으로 보이는 한계(무릎 가로선은 줄었으나 남음)', '몸통 회전: 3차원 몸통 회전이 부족함',
                                  '소매 표현: 소매 질감·접합 한계', '가방끈: 후면 가방끈 표현 한계'],
    'approval_basis': '사용자 지시(2026-10-17): “NPC06 v10r5에 남은 다리 볼륨, 몸통 회전, 소매 표현, 가방끈의 시각적 한계는 이번 게임 적용에서 수용한다.” 시각 품질 PASS로 바꾸지 않으며, 파일 손상·잘못된 경로·재생 오류·인물 바뀜·소품 좌우 뒤집힘·진행·저장 오류는 이 승인에 포함되지 않는다.',
    'approved_on': '2026-10-17', 'runtime_enabled': True,
    'scope': {'npc': 'NPC06', 'revision': 'v10r5', 'manifest_sha256': clip['source']['manifest_sha256'], 'frames_json_sha256': clip['source']['frames_json_sha256'],
              'pages': {p['file']: p['sha256'] for p in clip['pages']}, 'note': '이 버전·해시에만 적용. 다른 NPC나 다른 판(이전 후보 등), 해시가 다른 파일에는 적용하지 않는다(figures.js USER_EXCEPTIONS·loadClip).'},
    'runtime_validation': {
        'frames': clip['source']['frames_checked'] + '; side pass 48 PNG equal to the reviewed v06 side frames',
        'segments': {k: v['frames'] for k, v in clip['segments'].items()},
        'turn_entries': clip['turn_entries'], 'alpha_round_trip': 'identical on every page', 'rgb_error_alpha_weighted_max': max(p['rgb_error_alpha_weighted_max'] for p in clip['pages']),
        'fps': clip['fps'], 'fps_basis': clip['fps_basis'],
        'game_checks': 'tests/npc06-flow.mjs (실제 게임 화면 재생·판정·실패 대체); 결과는 test-artifacts/npc06_v10r5/flow.json',
    },
}

rows = []
for (vid, aid), runs in sorted(cases.items()):
    v = V[vid]; sc = scenarios[aid]; npc = chars['visitor_roles'][v['role']]; look = look_for(v); p = plan(sc, npc)
    role = p['ok'] and npc in chars['visitor_role_figures']
    rows.append({'visitor': vid, 'name': v['name'], 'role': v['role'], 'anomaly': aid, 'runs': runs, 'npc': npc,
                 'figure': npc if role else f'visitor-0{look}', 'kind': 'role' if role else 'legacy',
                 'intercom': ('seq:NPC06_v10r5' if npc == 'NPC06' else f'still:{npc}') if role else f'still:visitor-0{look}',
                 'cctv': ('role: still' + (' + side walk ' + npc if 'walk_side' in p['needs'] else '')) if role else f'legacy look {look} (walk/gesture sheets)',
                 'needs': p['needs'], 'missing': p['missing'],
                 'reason': '모든 CCTV 장면을 같은 인물 그림으로 그릴 수 있음' if role else '이 인물 그림으로 그릴 수 없는 CCTV 장면: ' + ', '.join(p['missing'])})

out = {
    'version': 'v0.19.0', 'enabled': True,
    'source': 'room404/scripts/build-visitor-figures.py; 규칙 room404/dist/figures.js; 측면 걷기 assets/clips/side/side.json; NPC06 assets/clips/NPC06_v10r5/clip.json',
    'rule': ['인터폰과 CCTV는 같은 판정(figureFor)을 쓴다. 한 사건 안에서 두 화면의 인물은 항상 같다.',
             '역할 그림은 그 사건의 CCTV 장면을 모두 같은 인물 그림으로 그릴 수 있을 때만 쓴다. 아니면 그 사건만 기존 외형(visitor-01~08)을 두 화면에 똑같이 쓴다.',
             '측면 걷기는 v06 검수 side PASS 프레임만, 그림 방향(화면 왼쪽) 그대로 쓴다. 좌우 반전하지 않는다. 걷는 방향이 단서인 사건(direction_bound)은 쓰지 않는다.',
             '정면·후면 걷기(입장)와 몸짓(뒤돌아보기·전화·손 흔들기·노크)은 어느 역할에도 승인된 그림이 없다. NPC01은 걷기가 없고 다른 사람의 걷기로 대신하지 않는다.',
             'NPC06 v10r5는 시각 REVISE 상태에서 사용자 예외 승인으로만 인터폰에 재생한다(intercom_clips.NPC06).'],
    'side_clips': sorted(side['npcs']),
    'side_clips_note': 'NPC02~NPC05, NPC08도 v06 side PASS지만 지금 역할 그림으로 그릴 수 있는 사건 중 측면 걷기가 필요한 사건이 없어 런타임 파일을 만들지 않았다(asset-source/v06_QA에 보관). NPC10 측면은 REVISE.',
    'direction_bound': DIRECTION_BOUND,
    'role_heads': {k: head_box(v['figure']) for k, v in chars['visitor_role_figures'].items()},
    'intercom_clips': {'NPC06': record},
    'summary': {'cases': len(rows), 'role_cases': sum(r['kind'] == 'role' for r in rows),
                'role_visitors': sorted({r['visitor'] for r in rows if r['kind'] == 'role'}),
                'role_figures_used': sorted({r['npc'] for r in rows if r['kind'] == 'role'}),
                'npc06_sequence_cases': [f"{r['visitor']}/{r['anomaly']} ({', '.join(r['runs'])})" for r in rows if r['intercom'] == 'seq:NPC06_v10r5'],
                'legacy_reasons': {k: sum(k in r['missing'] for r in rows if r['kind'] == 'legacy') for k in sorted({m for r in rows for m in r['missing']})}},
    'cases': rows,
}
json.dump(out, open(os.path.join(D, 'visitor_figures.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out['summary'], ensure_ascii=False, indent=1))
