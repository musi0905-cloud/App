#!/usr/bin/env python3
"""Asset request list for the producer: docs/missing_assets_request.json (v0.18.0).

  python3 scripts/build-missing-request.py      (after import-v06-sources.py and build-v06-review.py)

resolved: the 41 requests of v0.17.0, each matched by SHA-256 to a file now in the repository (the restored delivery of
2026-10-14, asset-source/v06_sources/SOURCE_IMPORT_RESULT.json). A request counts as resolved only when its expected
hash is held; nothing is resolved by name.
requests: what is still needed, taken from records only (null where no record says it):
  new_art   the v06 frame review's open issues that the existing parts cannot express (production_requests_v06.json),
            CCTV walk/gesture art for the visitor role figures (character_assets.json visitor_roles_status), the NPC01
            walk clip (no package), the approval-backlog revisions (revision_backlog_v02.json)
  record    facts the game needs but no document gives (figure heights marked [DESIGN], the 4th-floor window row of BG13)
Fields as v0.17.0 (assetId, entityId, era, expectedFilename, sourceDriveId, sourceUrl, expectedSha256, priority,
blockingReason) plus kind, use and spec.
"""
import hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(ROOT)
AS = os.path.join(PROJECT, 'asset-source')
J = lambda *p: json.load(open(os.path.join(*p)))

def held_hashes():
    out = {}
    for base in ('asset-source', 'character-v5', os.path.join('room404', 'dist', 'assets')):
        for dp, _, fs in os.walk(os.path.join(PROJECT, base)):
            for f in fs:
                if f.lower().endswith(('.png', '.webp', '.jpg', '.json')): out.setdefault(hashlib.sha256(open(os.path.join(dp, f), 'rb').read()).hexdigest(), os.path.relpath(os.path.join(dp, f), PROJECT))
    return out

def row(asset, ent, era, kind, priority, reason, use, spec=None, filename=None):
    return {'assetId': asset, 'entityId': ent, 'era': era, 'expectedFilename': filename, 'sourceDriveId': None, 'sourceUrl': None, 'expectedSha256': None,
            'priority': priority, 'blockingReason': reason, 'kind': kind, 'use': use, 'spec': spec}

def main():
    path = os.path.join(PROJECT, 'docs', 'missing_assets_request.json'); old = json.load(open(path)); have = held_hashes()
    # The v0.17 requests: the file's own 'resolved' list once it exists (its 'requests' are the open rows this script writes;
    # reading both double-counted them on a second run, 41 -> 96, found 2026-10-14).
    prev = old['resolved'] if 'resolved' in old else old.get('requests', [])
    resolved = []
    for r in prev:
        h = r.get('expectedSha256'); p = have.get(h) if h else None
        resolved.append({'assetId': r['assetId'], 'priority': r['priority'], 'expectedSha256': h, 'heldAt': p, 'status': 'RESOLVED' if p else 'OPEN'})
    rows = []
    # 1. v06 review: open issues that need new art (one row per NPC and issue; the views are listed in the spec)
    pr = J(AS, 'v06_QA', 'production_requests_v06.json'); review = J(AS, 'v06_QA', 'visual_review_v06.json'); by = {}
    for q in pr['requests']:
        if q['needs_new_art']: by.setdefault((q['npc'], q['issue']), []).append(q)
    # art that was delivered against a request and tested (NPC06 v07, 2026-10-14): the request stays open unless the review resolves it
    r7p = os.path.join(AS, 'v07_QA', 'review_summary_v07.json'); r7 = J(r7p) if os.path.exists(r7p) else None
    tried = {q['id']: q for q in (r7 or {}).get('requests', [])}
    r9p = os.path.join(AS, 'v09_QA', 'review_v09.json'); r9 = J(r9p) if os.path.exists(r9p) else None
    q9p = os.path.join(AS, 'v09_QA', 'art_revision_requests_v09.json'); q9 = J(q9p) if os.path.exists(q9p) else None
    for (npc, iss), qs in sorted(by.items()):
        spec = {k: v for k, v in qs[0]['art_spec'].items() if k not in ('view', 'character')}; spec['views'] = sorted({q['view'] for q in qs})
        rows.append(row(f'{npc}/walk/{iss}', npc, '2026', 'new_art', qs[0]['priority'], f"v06 재렌더 후에도 남음: {qs[0]['still_wrong']}",
                        '걷기 클립(정면·후면 PASS가 되어야 게임에 씀, stage.js clipUsable)', spec))
        att = [tried[q['id']] for q in qs if q['id'] in tried]
        if att:
            rows[-1]['latest_attempt'] = {'art': 'v07b (asset-source/v07_NPC06/source)', 'review': 'asset-source/v07_QA/review_summary_v07.json', 'requests': {a['id']: a['status'] for a in att},
                                          'revision_requests': 'asset-source/v07_QA/art_revision_requests_v07.json'}
        # NPC06 v09 (producer, code only) and v09r (this repository): the request stays open unless review_v09.json closes it
        t9 = {k: v for k, v in (r9 or {}).get('requests', {}).items() if any(q['id'] == k for q in qs)}
        if t9:
            if 'latest_attempt' in rows[-1]: rows[-1]['previous_attempts'] = [rows[-1]['latest_attempt']]
            rows[-1]['latest_attempt'] = {'art': 'v09 / v09r: no new art, the original parts re-mapped in code (asset-source/v09_NPC06)', 'review': 'asset-source/v09_QA/review_v09.json',
                                          'requests': {k: v['status'] for k, v in t9.items()}, 'revision_requests': 'asset-source/v09_QA/art_revision_requests_v09.json'}
    # found in the v09 review and not fixable in code (new rows; the leg/torso ones above stay the v06 rows)
    for q in (q9 or {}).get('requests', []):
        if q.get('v06_request'): continue
        rows.append(row(f"NPC06/walk/{q['id'].split('NPC06-')[1]}", 'NPC06', '2026', 'new_art', q['priority'], q['still_wrong'], '걷기 클립(정면·후면 PASS가 되어야 게임에 씀)',
                        {'required_art': q['required_art'], 'source': q.get('source'), 'frames': q['frames'], 'evidence': q['evidence'], 'request': 'asset-source/v09_QA/art_revision_requests_v09.json'}))
    for npc in sorted({q['npc'] for q in pr['requests']}):
        sug = review['suggestions']['TURN_45']
        rows.append(row(f'{npc}/walk/TURN_45', npc, '2026', 'new_art', sug['priority'], '막지 않음(연결 PASS). ' + sug['note'], '회전 구간을 끊김 없이', {'required_art': sug['required_art']}))
    # v0.19.0: the four NPC06 limits the user accepted for this release. Still open (visual REVISE): marked as accepted
    # for the release and left for a later fix, never as resolved.
    accepted = {'LEG_STRIP': '다리 볼륨', 'TORSO_STATIC': '몸통 회전', 'SLEEVE_FABRIC': '소매 표현', 'TURN_REAR_STRAP': '가방끈'}
    for r in rows:
        k = r['assetId'].split('/')[-1]
        if r['entityId'] == 'NPC06' and k in accepted:
            r['release_v0_19_0'] = {'status': '이번 릴리스에서 사용자 수용, 후속 개선', 'resolved': False, 'visual_status': 'REVISE', 'limit': accepted[k],
                                    'applied_as': 'NPC06 v10r5를 사용자 예외 승인(2026-10-17)으로 인터폰에 재생(room404/dist/data/visitor_figures.json intercom_clips.NPC06)',
                                    'producer_attempt': 'v10r5 (asset-source/v10r5_NPC06, NPC06_v10r5_report.md: 시각 판정 보류, 기존 요청 종결 안 함)'}
    # 2. visitor role figures (v0.19.0): switched per case. A role still shows only in cases whose CCTV scenes its art can
    #    draw; the art below would let the remaining cases of that role switch too.
    ca = J(ROOT, 'dist', 'data', 'character_assets.json'); st = ca.get('visitor_roles_status', {}); vf = J(ROOT, 'dist', 'data', 'visitor_figures.json')
    names = {'walk_front_rear': '정면·후면 걷기(입장·다가옴·멀어짐)', 'gesture_turn': '뒤돌아보기', 'gesture_phone': '전화', 'gesture_wave': '손 흔들기', 'gesture_knock': '노크', 'direction_bound': '오른쪽으로 걷는 측면 걷기(방향이 단서인 사건)', 'no_side_clip': '측면 걷기'}
    for role, npc in sorted(ca['visitor_roles'].items(), key=lambda x: x[1]):
        legacy = [c for c in vf['cases'] if c['npc'] == npc and c['kind'] == 'legacy']; need = {}
        for c in legacy:
            for m in c['missing']: need[m] = need.get(m, 0) + 1
        rows.append(row(f'{npc}/cctv_motion', npc, '2026', 'new_art', 'P2', st.get('limits'),
                        f"CCTV 재생의 {role} 방문객: 지금 {len(legacy)}개 사건이 기존 외형(인터폰도 같은 외형). 아래 그림이 오면 그 사건들도 역할 그림으로 바꿀 수 있음",
                        {'required_art': '걷기(옆·다가옴·멀어짐)와 몸짓(손 흔들기·노크·전화·뒤돌아보기·서 있기) — replay.js의 visitor-0N-*.webp 시트 형식(384x512 칸, 발 (192,496)), 또는 정면·후면·연결이 PASS인 걷기 클립',
                         'needed_by_cases': {names.get(k, k): n for k, n in sorted(need.items())}, 'cases': [c['visitor'] + '/' + c['anomaly'] for c in legacy],
                         'reference': [f"room404/dist/{ca['visitor_role_figures'][npc]['figure']['file']}" if npc in ca.get('visitor_role_figures', {}) else None, 'room404/dist/assets/v2/visitor-01-walk.webp']}))
    rows.append(row('NPC01/walk', 'NPC01', '2026', 'new_art', 'P2', 'v05 걷기 패키지에 NPC01이 없음(NPC02~NPC10만).', '귀가 주민 역할 걷기 클립', {'required_art': 'NPC01 3방향 부품 아틀라스(…_3view_parts_atlas)·연속 팔 그림, v05 패키지와 같은 구성'}))
    # 3. approval backlog (records say what is wrong)
    for b in J(PROJECT, 'character-v5', 'docs', 'revision_backlog_v02.json'):
        rows.append(row(f"{b['id']}/{b['status']}", b['id'], None, 'new_art', 'P2' if b['id'].startswith('EV') else 'P3', b['reason'],
                        '증거 카드' if b['id'].startswith('EV') else '이야기 장면 인물(초안만 있음)'))
    # 4. records the game needs
    for cid in ['CH06', 'CH08', 'CH09', 'CH10', 'MC15', 'MC25', 'NPC01']:
        f = (ca['assets'].get(cid) or ca.get('visitor_role_figures', {}).get(cid) or {}).get('figure')
        if f and 'DESIGN' in f.get('height_note', ''):
            rows.append(row(f'{cid}/height', cid, None, 'record', 'P3', '기획·에셋 문서에 키 기록이 없어 [DESIGN] 1.68m 공통값으로 세움.', '정지 인물의 화면 키(머리 크기)', {'required': '키(m) 한 값'}))
    rows.append(row('BG13/floor4_row', 'BG13', None, 'record', 'P3', '보이는 1층이 몇 층인지 기록이 없어 4층 창 줄을 지정하지 못함(2004·2026 건물 윤곽은 같은 자리, 이동 0px).', '외관에서 404호 창 위치', {'required': '외관 그림의 층 번호(가장 낮은 창 줄이 몇 층인지)'}))
    counts = {}
    for r in rows: counts.setdefault(r['priority'], 0); counts[r['priority']] += 1
    out = {'generated_by': 'room404/scripts/build-missing-request.py', 'generated': '2026-10-17', 'version': 'v0.19.0',
           'fields': old['fields'], 'extra_fields': {'kind': 'file(받을 파일) / new_art(새로 그려야 함) / record(기록으로 정할 값)', 'use': '게임에서 쓰는 곳', 'spec': '그려야 할 것(인물·방향·부품·프레임·참고 그림)'},
           'resolved_counts': {'requests_v0_17': len(resolved), 'resolved': sum(r['status'] == 'RESOLVED' for r in resolved), 'open': sum(r['status'] == 'OPEN' for r in resolved)},
           'resolved': resolved, 'counts': counts, 'requests': rows,
           'note': '41건 해결은 파일 확보(해시 일치)이며 시각 검수 통과가 아님. 계획된 에셋 전체가 끝났다는 뜻도 아님(requests 참고).'}
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('resolved', out['resolved_counts'], 'open requests', counts, len(rows))

if __name__ == '__main__':
    main()
