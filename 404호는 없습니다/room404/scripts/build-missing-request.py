#!/usr/bin/env python3
"""Missing-asset request list for the producer: docs/missing_assets_request.json (v0.17.0).

  python3 scripts/build-missing-request.py

Only approved (PASS) files the game or the walk QA needs and this repository does not hold. Every value comes from a
record, nothing is guessed; what no record states is null:
  assetId         asset_key of the approval record (approved_static_assets_v01.json); for v05 part art the package path
  expectedSha256  download_integrity_v02.json (package game path) or checksums_v05.json; null if neither lists it
  sourceDriveId   a Drive file id only where this session found that exact file; otherwise null
  candidateArchives  recovery ZIPs whose folder matches (ZIP_압축해제_목록_20261013.json). Their contents are not listed
                  there, so a candidate is not a claim that the file is inside.
Drive lookups (2026-10-14): title searches for every name below found only the NPC01 copies listed; the 9.4 MB
01_캐릭터_복구완료_v02_part05.zip could not be read through this session's Drive connector (response message too large).
"""
import hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(ROOT)
DOCS = os.path.join(PROJECT, 'character-v5', 'docs')
J = lambda *p: json.load(open(os.path.join(*p)))
VIEW = 'https://drive.google.com/file/d/{}/view?usp=drivesdk'

def held_hashes():
    out = set()
    for base in ('asset-source', 'character-v5', os.path.join('room404', 'dist', 'assets')):
        for dp, _, fs in os.walk(os.path.join(PROJECT, base)):
            for f in fs:
                if f.lower().endswith(('.png', '.webp', '.jpg', '.json')): out.add(hashlib.sha256(open(os.path.join(dp, f), 'rb').read()).hexdigest())
    return out

def main():
    static = J(DOCS, 'approved_static_assets_v01.json'); integ = {x['path']: x for x in J(DOCS, 'download_integrity_v02.json')['images']}
    zips = J(PROJECT, 'docs', 'extraction', 'ZIP_압축해제_목록_20261013.json'); have = held_hashes()
    archives = {os.path.basename(z['source_path']): {'driveId': z['drive_id'], 'bytes': z['zip_size'], 'sha256': z['zip_sha256']}
                for z in zips if '복구' in os.path.basename(z['source_path']) and ('01_캐릭터' in z['source_path'] or '02_배경' in z['source_path'])}
    cand = lambda word: sorted(n for n in archives if word in n)
    char_zips, bg_zips = cand('01_캐릭터_복구완료_v02'), cand('02_배경_20261008_복구저장')
    found = {  # exact files this session located on Drive (title search), with what they turned out to be
        '01_캐릭터/game/NPC01_visitor_male_2026_front_full_v01.png': ('1CDivKEz1G-SdJIh9tLj__SXxA7aTzLEw',
            'Drive의 game 사본이 잘려 있음(327,769바이트, sha256 eaee7a07…, PNG 해독 실패). 승인 원본(01_캐릭터/originals, sha256 c6836c1c…)은 받아서 asset-source/01_캐릭터/originals에 보관. 게임 출력본이 원본과 같은지 제작 측 확인 필요.')}
    rows = []
    want_char = {'NPC01', 'NPC03', 'NPC04', 'NPC05', 'NPC06', 'NPC07', 'NPC08', 'NPC09', 'NPC10', 'CH06', 'CH08'}
    for x in static:
        if x['status'] != 'PASS': continue
        is_role = x['id'] in want_char and 'front_full' in x['asset_key']
        is_bg = x['id'] in ('BG06_interior', 'BG08', 'BG13_2004')
        if not (is_role or is_bg): continue
        gp = x['game_path']; rec = integ.get(gp, {}); h = rec.get('sha256')
        if h in have: continue
        drive, reason = found.get(gp, (None, None))
        if not reason:
            reason = ('Drive에서 낱개 파일을 찾지 못함(2026-10-14 제목 검색). 복구 ZIP 안에 있을 수 있으나 ZIP 목록에 내용이 없고, 이 세션의 Drive 연결 도구로 9.4MB ZIP을 읽지 못함(응답 메시지가 너무 큼). '
                      + ('승인본은 front_full_v02(v01은 대체됨).' if x['asset_key'].endswith('_v02') and x['id'] == 'NPC03' else ''))
        ent = x['id'].split('_')[0]
        rows.append({'assetId': x['asset_key'], 'entityId': ent, 'era': x['state'][:4] if x['state'][:4].isdigit() else None,
                     'expectedFilename': gp, 'sourceDriveId': drive, 'sourceUrl': VIEW.format(drive) if drive else None, 'expectedSha256': h,
                     'priority': 'P1' if is_role or x['id'] in ('BG08', 'BG13_2004') else 'P2',
                     'blockingReason': reason.strip(),
                     'use': ('방문객 역할 그림(10장이 모두 있어야 visitor_roles_enabled를 켬)' if ent.startswith('NPC') else
                             '기록 인물 화면(CH06 N2_04·N3_04·N5_06, CH08 N2_06·N5_07). 지금은 글만 나옴' if ent.startswith('CH') else
                             {'BG08': '관리사무소 승인본(v01은 미승인이라 게임 파일 없음)', 'BG13': '2004/2026 외관 대조(4층 창 위치)', 'BG06': '엘리베이터 내부(현재 쓰는 곳 없음)'}[ent]),
                     'candidateArchives': char_zips if is_role else bg_zips, 'originalSha256': x.get('sha256')})
    # Game exports of BG04/BG05: the approved originals are held and the game files are built from them.
    for bid in ('BG04', 'BG05'):
        x = next(s for s in static if s['id'] == bid); rec = integ[x['game_path']]
        if rec['sha256'] in have: continue
        rows.append({'assetId': x['asset_key'], 'entityId': bid, 'era': x['state'][:4], 'expectedFilename': x['game_path'], 'sourceDriveId': None, 'sourceUrl': None,
                     'expectedSha256': rec['sha256'], 'priority': 'P3', 'blockingReason': '패키지 WebP 출력본은 받지 못함. 승인 원본 PNG(941x1672)를 받아 게임 파일을 만들었으므로 게임에는 영향 없음.',
                     'use': '레지스트리 대조용', 'candidateArchives': bg_zips, 'originalSha256': x.get('sha256')})
    # v05 part art (render inputs) — not part of the 93 frame ZIPs.
    for npc in ['NPC%02d' % n for n in range(2, 11)]:
        sums = J(PROJECT, 'asset-source', 'v05_QA', 'code', npc, 'checksums_v05.json')
        for k, h in sorted(sums.items()):
            if k.startswith('assets/') and h not in have:
                rows.append({'assetId': f'{npc}/{k}', 'entityId': npc, 'era': '2026', 'expectedFilename': f'06_애니메이션/NPC02-NPC10_손소품경계수정_v05/{npc}/{k}', 'sourceDriveId': None, 'sourceUrl': None,
                             'expectedSha256': h, 'priority': 'P3', 'blockingReason': 'v05 프레임 전송 ZIP 93개에는 프레임·설정·리그·QA만 있고 부품 그림은 없음(제작 측 안내). 다시 렌더할 때만 필요.',
                             'use': 'render.js 입력(걷기 프레임 재출력)', 'candidateArchives': [], 'originalSha256': None})
    out = {'generated_by': 'room404/scripts/build-missing-request.py', 'generated': '2026-10-14',
           'fields': ['assetId', 'entityId', 'era', 'expectedFilename', 'sourceDriveId', 'sourceUrl', 'expectedSha256', 'priority', 'blockingReason'],
           'extra_fields': {'use': '게임에서 쓰는 곳', 'candidateArchives': '폴더 이름이 맞는 복구 ZIP 이름(archives 참고). 내용 미확인이며 포함 여부를 주장하지 않음', 'originalSha256': '승인 기록의 원본 해시'},
           'archives': archives,
           'counts': {p: sum(r['priority'] == p for r in rows) for p in ('P1', 'P2', 'P3')}, 'requests': rows}
    path = os.path.join(PROJECT, 'docs', 'missing_assets_request.json')
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', path, out['counts'], len(rows))
    for r in rows[:16]: print(r['priority'], r['assetId'], r['expectedSha256'] and r['expectedSha256'][:12], r['sourceDriveId'])

if __name__ == '__main__':
    main()
