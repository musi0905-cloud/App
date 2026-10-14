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
    prev = old.get('requests', []) + [r for r in old.get('resolved', [])]
    resolved = []
    for r in prev:
        h = r.get('expectedSha256'); p = have.get(h) if h else None
        resolved.append({'assetId': r['assetId'], 'priority': r['priority'], 'expectedSha256': h, 'heldAt': p, 'status': 'RESOLVED' if p else 'OPEN'})
    rows = []
    # 1. v06 review: open issues that need new art (one row per NPC and issue; the views are listed in the spec)
    pr = J(AS, 'v06_QA', 'production_requests_v06.json'); review = J(AS, 'v06_QA', 'visual_review_v06.json'); by = {}
    for q in pr['requests']:
        if q['needs_new_art']: by.setdefault((q['npc'], q['issue']), []).append(q)
    for (npc, iss), qs in sorted(by.items()):
        spec = {k: v for k, v in qs[0]['art_spec'].items() if k not in ('view', 'character')}; spec['views'] = sorted({q['view'] for q in qs})
        rows.append(row(f'{npc}/walk/{iss}', npc, '2026', 'new_art', qs[0]['priority'], f"v06 재렌더 후에도 남음: {qs[0]['still_wrong']}",
                        '걷기 클립(정면·후면 PASS가 되어야 게임에 씀, stage.js clipUsable)', spec))
    for npc in sorted({q['npc'] for q in pr['requests']}):
        sug = review['suggestions']['TURN_45']
        rows.append(row(f'{npc}/walk/TURN_45', npc, '2026', 'new_art', sug['priority'], '막지 않음(연결 PASS). ' + sug['note'], '회전 구간을 끊김 없이', {'required_art': sug['required_art']}))
    # 2. visitor role figures: the switch waits for CCTV art of the same people
    ca = J(ROOT, 'dist', 'data', 'character_assets.json'); st = ca.get('visitor_roles_status', {})
    for role, npc in sorted(ca['visitor_roles'].items(), key=lambda x: x[1]):
        rows.append(row(f'{npc}/cctv_motion', npc, '2026', 'new_art', 'P2', st.get('blocked_by'), f'CCTV 재생의 {role} 방문객(지금은 기존 8개 외형) — 이것이 와야 visitor_roles_enabled를 켬',
                        {'required_art': '걷기(옆·다가옴·멀어짐)와 몸짓(손 흔들기·노크·전화·뒤돌아보기·서 있기) — replay.js의 visitor-0N-*.webp 시트 형식(384x512 칸, 발 (192,496)), 또는 정면·후면·연결이 PASS인 걷기 클립',
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
    out = {'generated_by': 'room404/scripts/build-missing-request.py', 'generated': '2026-10-14', 'version': 'v0.18.0',
           'fields': old['fields'], 'extra_fields': {'kind': 'file(받을 파일) / new_art(새로 그려야 함) / record(기록으로 정할 값)', 'use': '게임에서 쓰는 곳', 'spec': '그려야 할 것(인물·방향·부품·프레임·참고 그림)'},
           'resolved_counts': {'requests_v0_17': len(resolved), 'resolved': sum(r['status'] == 'RESOLVED' for r in resolved), 'open': sum(r['status'] == 'OPEN' for r in resolved)},
           'resolved': resolved, 'counts': counts, 'requests': rows,
           'note': '41건 해결은 파일 확보(해시 일치)이며 시각 검수 통과가 아님. 계획된 에셋 전체가 끝났다는 뜻도 아님(requests 참고).'}
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('resolved', out['resolved_counts'], 'open requests', counts, len(rows))

if __name__ == '__main__':
    main()
