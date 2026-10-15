#!/usr/bin/env python3
"""NPC06 art revision requests after the v09 / v09r review: asset-source/v09_QA/art_revision_requests_v09.json and
NPC06_v09_원화수정요청.md. Only what code could not fix. Every request names the source picture and its crop, the joint
and reference coordinates the renderer actually used (from the v09r render's frames.json, 720x1280 canvas px) and the
frames where it shows.

  python3 -B -I tools/build_requests_v09.py <v09r render dir (frames.json)>
"""
import json, os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); QA = os.path.join(os.path.dirname(HERE), 'v09_QA')
R = json.load(open(os.path.join(sys.argv[1], 'frames.json'))); FR = R['frames']; MET = {r['label']: r for r in json.load(open(os.path.join(QA, 'metrics_v09.json')))['runs']}
HV, HD = MET['v09r']['holes']['by_segment']['turn/rear'], MET['default']['holes']['by_segment']['turn/rear']
ATLAS = 'asset-source/v05_QA/code/NPC06/assets/NPC06_3view_parts_atlas_v01.png (2172x724)'; ARMS = 'asset-source/v05_QA/code/NPC06/assets/NPC06_continuous_arms_v03.png (1536x1024)'
# leg pieces: atlas rect [x, y, w, h], and the rows v09r uses (thigh rows 0..thigh_row, shin rows shin_row..end; the rest is the rounded end)
LEGS = {'front': {'L': {'thigh': [242, 359, 93, 140], 'shin': [405, 358, 81, 141], 'thigh_row': 130, 'shin_row': 12}, 'R': {'thigh': [87, 508, 91, 155], 'shin': [255, 508, 86, 155], 'thigh_row': 144, 'shin_row': 12}},
        'rear': {'L': {'thigh': [1680, 356, 88, 143], 'shin': [1856, 357, 79, 142], 'thigh_row': 133, 'shin_row': 12}, 'R': {'thigh': [1512, 504, 95, 158], 'shin': [1689, 506, 82, 157], 'thigh_row': 148, 'shin_row': 11}}}
TORSO = {'front': [273, 6, 162, 204], 'rear': [1700, 6, 157, 194]}
ARM_CELLS = {'front': {'L': [283, 9, 100, 495], 'R': [284, 518, 108, 493]}, 'rear': {'L': [1150, 9, 102, 497], 'R': [1156, 516, 100, 497]}}
joints = lambda ns: {str(n): {'seg': f"{FR[n]['seg']} {FR[n]['i']}", 'knee_flex_deg': FR[n]['knee_flex_deg'], 'legs_px': FR[n]['legs_px'], 'feet_px': FR[n]['feet_px']} for n in ns}
shoulders = lambda ns: {str(n): {'seg': f"{FR[n]['seg']} {FR[n]['i']}", 'shoulders_px': FR[n]['shoulders_px'], 'root_px': FR[n]['root_px'], 'yaw_deg': FR[n].get('material09r', {}).get('shoulder_yaw_deg'), 'hip_yaw_deg': FR[n].get('material09r', {}).get('hip_yaw_deg')} for n in ns}
reqs = [
    {'id': 'NPC06-front-LEG_STRIP', 'view': 'front', 'priority': 'P1', 'status': 'OPEN', 'v06_request': True,
     'what_code_did': 'v09r: 허벅지 행은 무릎 쪽 둥근 끝 위에서 멈추고 정강이 행은 위쪽 둥근 끝 아래에서 시작(빈 몇 행은 직물 행을 거울로 채움, v06 무릎 UV 유지). 윤곽은 허벅지 중간에서 정강이 폭까지 곧게 이어지고, 주름 음영은 투영 무릎에 둠. 무릎 단차와 가로선 없음, 바지색·직조 그대로.',
     'still_wrong': '카메라 쪽으로 발뒤꿈치가 닿을 때 앞다리가 곧은 평면 관으로 보임: 무릎뼈 모양, 정강이를 덮는 무릎 겹침, 신발 위 바지 꺾임이 없음. 매핑이 아니라 그림의 문제.',
     'source': {'atlas': ATLAS, 'pieces': LEGS['front'], 'knee_row_of_leg_texture': round(R['frames'][0].get('material09r', {}).get('knee_uv', 0.5023), 4),
                'note': 'thigh piece spans u -0.075..1.075 of the hip->knee bone, shin piece u -0.065..1.065 of knee->ankle; rows after thigh_row / before shin_row are the rounded ends v09r does not use'},
     'frames': {'worst': 'enter 40-47 (sequence 40-47), heel strike of the near (L) leg', 'also': 'enter 16-23 (R heel strike)'}, 'joints_px': joints([40, 42, 44, 46, 47, 18, 20]),
     'required_art': '다리마다 정면 바지 3상태(기존 아틀라스 배율·조명): 곧음(착지·지지), 카메라 쪽으로 약 30도 굽힘, 약 60도(흔들기 중간). 각각 엉덩이에서 밑단까지 한 장으로 이어지고(무릎에 둥근 끝 없음), 굽힌 상태는 무릎뼈 모양과 정강이를 덮는 무릎 겹침이 있어야 함. 원래 바지색·직조·밑단 유지.',
     'evidence': ['asset-source/v09_QA/evidence/legs_front.jpg', 'asset-source/v09_QA/evidence/legs_seq_12fps.mp4', 'asset-source/v09_QA/evidence/qa_viewer_steps.jpg']},
    {'id': 'NPC06-rear-LEG_STRIP', 'view': 'rear', 'priority': 'P1', 'status': 'OPEN', 'v06_request': True,
     'what_code_did': '정면과 같음(후면 조각). 뒤에서 본 접힘은 관절선에 둠.', 'still_wrong': '카메라 반대쪽 착지에서 앞다리가 곧은 평면 관으로 보이고 무릎 뒤 꺾임이 없음.',
     'source': {'atlas': ATLAS, 'pieces': LEGS['rear']}, 'frames': {'worst': 'exit 0-8 (sequence 167-175)', 'also': 'exit 24-32 (sequence 191-199)'}, 'joints_px': joints([167, 169, 171, 173, 175, 191, 195]),
     'required_art': '후면도 같은 3상태, 굽힌 상태에 무릎 뒤 주름.', 'evidence': ['asset-source/v09_QA/evidence/legs_rear.jpg', 'asset-source/v09_QA/evidence/legs_seq_12fps.mp4']},
    {'id': 'NPC06-front-TORSO_STATIC', 'view': 'front', 'priority': 'P2', 'status': 'OPEN', 'v06_request': True,
     'what_code_did': 'v09r: 밑단은 골반선, 가슴·어깨는 어깨선을 따르고(사이는 비틀림), 리그 yaw(어깨 ±2.6도, 골반 반대)만큼 원통처럼 돌림: 위와 밑단이 반대로 최대 약 5px 벌어짐. v09는 1~2px를 반대 방향으로 옮겼음.',
     'still_wrong': '평면 그림 한 장: 앞으로 나오는 어깨가 가까워지거나 넓어지지 않고 먼 쪽이 돌아가지 않음. 자세히 볼 때만 보임.',
     'source': {'atlas': ATLAS, 'torso_rect': TORSO['front'], 'drawn_size_m': [0.425 * 1.55 / 1.725, 0.57 * 1.55 / 1.725], 'pivot': 'centre of the picture, 85 % down (waist)'},
     'frames': {'worst': 'enter 0-47 (largest yaw at enter 0, 22, 44)'}, 'reference_px': shoulders([0, 11, 22, 33, 44]),
     'required_art': '방향마다 몸통 그림 2장(약 ±8도: 왼어깨 앞 / 오른어깨 앞), 지금 몸통과 같은 크기·기준점·깃·단추·무늬·조명. 렌더러가 보폭에 맞춰 섞음.',
     'evidence': ['asset-source/v09_QA/evidence/shoulders_front.jpg', 'asset-source/v09_QA/evidence/compare_seq_12fps.mp4']},
    {'id': 'NPC06-rear-TORSO_STATIC', 'view': 'rear', 'priority': 'P2', 'status': 'OPEN', 'v06_request': True, 'what_code_did': '정면과 같음', 'still_wrong': '정면과 같음',
     'source': {'atlas': ATLAS, 'torso_rect': TORSO['rear']}, 'frames': {'worst': 'exit 0-47 (sequence 167-214)'}, 'reference_px': shoulders([167, 178, 189, 200, 211]),
     'required_art': '후면도 같은 2장.', 'evidence': ['asset-source/v09_QA/evidence/shoulders_rear.jpg']},
    {'id': 'NPC06-SLEEVE_FABRIC', 'view': 'front, rear', 'priority': 'P2', 'status': 'OPEN', 'v06_request': False, 'new_in': 'v09 review',
     'what_code_did': 'v09r: 소매 윗끝을 리그 어깨점(그림 어깨보다 12~15px 위, 2~5px 바깥, reference_px 참고) 대신 몸통 그림의 가디건 어깨 아래(u=±0.84, 윗선에서 그림 높이의 3.5% 아래)에 붙임: 둥근 소매 끝이 어깨선 위로 튀어나오지 않음.',
     'still_wrong': '소매가 가디건 몸판보다 밝고 굵은 니트이고, 팔 위쪽 40% 동안 폭 92px(칸 100px)로 일정해 몸통 옆에 따로 부푼 옷처럼 보임. 소매와 가디건이 만나는 솔기가 맞지 않음.',
     'source': {'arms': ARMS, 'cells_xywh': ARM_CELLS, 'sleeve_width_px_at_10_25_40_60pct': {'front': {'L': [92, 91, 86, 74], 'R': [93, 92, 83, 71]}, 'rear': {'L': [92, 92, 92, 76], 'R': [94, 92, 94, 77]}},
                'torso_for_colour_and_knit': {'atlas': ATLAS, 'front': TORSO['front'], 'rear': TORSO['rear']}, 'drawn_width_m': round(0.132 * 1.55 / 1.725, 4)},
     'frames': {'front': 'enter/settle/idle 0-111 (worst idle 64-111, nearest)', 'rear': 'start/exit 152-214'},
     'reference_px': {'24 enter 24 (front)': {'rig_shoulder_L': [408.8, 555.6], 'painted_shoulder_top_u0.84': [406.1, 567.8], 'u0.95': [412.0, 582.4]},
                      '64 idle 0 (front)': {'rig_shoulder_L': [416.9, 565.6], 'painted_shoulder_top_u0.84': [413.5, 579.9], 'u0.95': [420.5, 597.4]},
                      '190 exit 23 (rear)': {'rig_shoulder_L': [310.3, 559.0], 'painted_shoulder_top_u0.84': [313.3, 571.0], 'u0.95': [307.3, 583.6]}},
     'required_art': '가디건과 같은 색·니트(같은 조명)의 소매, 어깨 솔기에서 아래로 좁아지는 위팔(일정 폭으로 부풀지 않게), 기준 좌표의 가디건 어깨 솔기 아래에 들어가는 소매 윗끝. NPC06_continuous_arms_v03.png와 같은 칸 배치·크기라 렌더러가 그대로 붙일 수 있게.',
     'evidence': ['asset-source/v09_QA/evidence/shoulders_front.jpg', 'asset-source/v09_QA/evidence/shoulders_rear.jpg', 'asset-source/v09_QA/evidence/qa_viewer_steps.jpg']},
    {'id': 'NPC06-TURN_REAR_STRAP', 'view': 'turn (rear picture)', 'priority': 'P3', 'status': 'OPEN', 'v06_request': False, 'new_in': 'v09 review', 'part_of': 'NPC06/walk/TURN_45',
     'what_code_did': 'v09r: 끈 꼭짓점을 그림 어깨에 얹음. 회전 142~151의 끈 고리 안 배경 %d px(가장 큰 프레임 %d px), v06 %d px(가장 큰 프레임 %d px)' % (HV['px'], HV['max_px'], HD['px'], HD['max_px']),
     'still_wrong': '몸 방향 136~158도에서 후면 그림을 쓰는데 왼팔이 몸 뒤로 가 있어, 끈이 빈 몸통 옆선 옆에 걸림.',
     'frames': {'worst': 'turn 31-36 (sequence 142-147)'}, 'reference_px': shoulders([142, 144, 146]),
     'required_art': '몸통·팔·가방의 3/4 후면(약 135도) 그림, TURN_45와 같은 요청.', 'evidence': ['asset-source/v09_QA/evidence/switch_turn.jpg']},
]
out = {'npc': 'NPC06', 'made': '2026-10-15', 'after': 'v09 (producer) and v09r (this repository) review, asset-source/v09_QA/review_v09.json', 'closed': [], 'note': '통과한 요청이 없어 닫은 요청 없음. 좌표는 720x1280 렌더 픽셀.', 'requests': reqs}
json.dump(out, open(os.path.join(QA, 'art_revision_requests_v09.json'), 'w'), ensure_ascii=False, indent=1)
md = ['# NPC06 원화 수정 요청 (v09 검수 후)', '', '코드로 고칠 수 있는 것은 v09r에서 고쳤고(기록: `asset-source/v09_QA/review_v09.json`), 아래는 그림이 필요한 것만입니다. 좌표는 720x1280 렌더 픽셀, 프레임 번호는 시퀀스 번호(입장 0-47, 멈춤 48-63, 대기 64-111, 회전 112-151, 출발 152-166, 퇴장 167-214)입니다. 닫힌 요청: 없음.', '']
for q in reqs:
    md += [f"## {q['id']} ({q['priority']}, {q['status']})", '', f"- 코드로 한 것: {q['what_code_did']}", f"- 남은 문제: {q['still_wrong']}", f"- 문제 프레임: {json.dumps(q['frames'], ensure_ascii=False)}"]
    src = q.get('source')
    if src: md.append(f"- 원본·크롭: `{json.dumps(src, ensure_ascii=False)}`")
    for k in ('joints_px', 'reference_px'):
        if k in q: md.append(f"- {'관절 좌표' if k == 'joints_px' else '기준 좌표'}: " + '; '.join(f"#{n} {json.dumps(v, ensure_ascii=False)}" for n, v in list(q[k].items())[:3]) + (' … (전체는 JSON)' if len(q[k]) > 3 else ''))
    md += [f"- 필요한 그림: {q['required_art']}", f"- 근거: {', '.join(q['evidence'])}", '']
open(os.path.join(QA, 'NPC06_v09_원화수정요청.md'), 'w').write('\n'.join(md))
print('requests:', [q['id'] for q in reqs])
