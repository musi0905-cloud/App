#!/usr/bin/env python3
"""Asset registry: every production asset file that is actually in this repository, hashed here (v0.16.0).

  python3 scripts/build-asset-registry.py        -> ../asset_registry.json

Rules (작업 지시 6항):
- Only files read and hashed by this script are entries. Nothing is marked PASS from a file or folder name: qaStatus comes
  from the package QA records (approved_static_assets_v01.json, approved_patch_assets_v02.json, character_revision_
  manifest_v02.json, ui_inventory_v02.json, evidence_readable_20_v03.json, validation_all_v05.json) matched by SHA-256 or
  by the package path the record names; legacy game files are LEGACY_IN_GAME, everything else UNREVIEWED.
  download_integrity_v02.json is byte integrity only and never sets qaStatus.
- Entries are de-duplicated by SHA-256 (every other path with the same bytes goes to duplicatePaths).
- ID systems stay separate: entityId is one of CH## / MC## / NPC## / BG## / UI## / EV## (asset entities); gate visitors
  (V001-V100), scene ids (N1_01-N5_08), story contacts and gate_visitor_id live in game data and are only referenced from
  selectedFor as 'scene:N3_01' or 'visitor:V001'.
- `missing` lists files the package manifests name but this repository does not hold (expected SHA-256 where known).
"""
import hashlib, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # room404
PROJECT = os.path.dirname(ROOT)
OUT = os.path.join(PROJECT, 'asset_registry.json')
DOCS = os.path.join(PROJECT, 'character-v5', 'docs')
SRC = os.path.join(PROJECT, 'asset-source')
DIST = os.path.join(ROOT, 'dist')
PKG_NAME = '404호는_없습니다_최종_게임에셋'
J = lambda *p: json.load(open(os.path.join(*p)))

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def rel(p): return os.path.relpath(p, PROJECT)
def revision(name):
    m = re.findall(r'_v(\d\d)(?=[._])', name); return 'v' + m[-1] if m else None

def image_info(p):
    ext = os.path.splitext(p)[1].lower()
    if ext in ('.png', '.webp', '.jpg', '.jpeg'):
        im = Image.open(p); fmt = im.format.lower(); has = 'A' in im.getbands()
        used = has and im.getchannel('A').getextrema()[0] < 255
        return im.width, im.height, fmt, bool(used), has
    if ext == '.svg':
        t = open(p, encoding='utf-8').read(); m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', t) or re.search(r'width="(\d+)"[^>]*height="(\d+)"', t)
        return (int(float(m.group(1))), int(float(m.group(2))), 'svg', True, True) if m else (None, None, 'svg', True, True)
    if ext == '.mp4': return None, None, 'mp4', False, False
    if ext == '.json': return None, None, 'json', False, False
    return None, None, ext.lstrip('.'), False, False

def main():
    static = J(DOCS, 'approved_static_assets_v01.json'); patch = J(DOCS, 'approved_patch_assets_v02.json'); revmf = J(DOCS, 'character_revision_manifest_v02.json')
    integrity = J(DOCS, 'download_integrity_v02.json')['images']; ui = J(SRC, '05_UI', 'ui_inventory_v02.json')
    cards = J(SRC, '04_증거소품', 'evidence_readable_20_v03.json'); v05 = {x['id']: x for x in J(SRC, 'v05_QA', 'code', 'validation_all_v05.json')}
    layout = J(DIST, 'data', 'scene_layout.json'); chars = J(DIST, 'data', 'character_assets.json')
    qa_by_sha = {x['sha256']: ('PASS' if x['status'] == 'PASS' else x['status'], 'approved_static_assets_v01.json') for x in static if x.get('sha256')}
    for x in revmf:
        if x.get('sha256'): qa_by_sha.setdefault(x['sha256'], (x['status'], 'character_revision_manifest_v02.json'))
    qa_by_path = {x['game_path'].split('/')[-1]: (x['status'], 'approved_static_assets_v01.json') for x in static if x.get('game_path')}
    qa_by_path.update({x['path'].split('/')[-1]: (x['status'], 'approved_patch_assets_v02.json') for x in patch if x.get('path')})
    qa_by_path.update({os.path.basename(x['game_path']): (x['status'], 'ui_inventory_v02.json') for x in ui})
    qa_by_path.update({os.path.basename(x['source_path']): (x['status'], 'ui_inventory_v02.json') for x in ui})
    entries = {}

    def add(path, entity, era, category, package, selected=(), replacement=None, notes='', qa=None, derived=None):
        h = sha(path)
        if h in entries: entries[h]['duplicatePaths'].append(rel(path)); return entries[h]
        w, hgt, fmt, alpha, channel = image_info(path); name = os.path.basename(path)
        status, basis = qa or qa_by_sha.get(h) or qa_by_path.get(name) or ('UNREVIEWED', None)
        e = {'assetId': None, 'entityId': entity, 'era': era, 'category': category, 'sourcePath': rel(path), 'sourcePackage': package,
             'revision': revision(name), 'sha256': h, 'width': w, 'height': hgt, 'format': fmt, 'hasAlpha': alpha, 'alphaChannel': channel,
             'bytes': os.path.getsize(path), 'qaStatus': status, 'qaBasis': basis, 'selectedFor': list(selected), 'replacementOf': replacement,
             'derivedFrom': derived, 'duplicatePaths': [], 'notes': notes}
        entries[h] = e; return e

    # 1. Backgrounds: package files (sources) and the game copies.
    bg_files = {v['source'].split('/')[-1]: k for k, v in J(SRC, 'stage_build_report.json')['backgrounds'].items()}
    add(os.path.join(SRC, '02_배경', 'game', 'BG08_management_office_2026_v01.webp'), 'BG08', '2026', 'background', f'{PKG_NAME}/02_배경/game',
        notes='승인 목록에 없는 판(승인본은 BG08_management_office_2026_base_v02_v01, 미반입). 게임 파일을 만들지 않음.')
    usage = layout['usage']; bg_use = {}
    bg_use.setdefault(usage['intercom']['background'], []).append('game:intercom'); bg_use.setdefault(usage['desk']['background'], []).append('game:desk')
    for n, b in usage['night_intro'].items(): bg_use.setdefault(b, []).append(f'game:night_intro:N{n}')
    for s, b in usage['cutscene_setting'].items(): bg_use.setdefault(b, []).append(f'game:cutscene:{s}')
    for ev, b in usage['evidence_backdrop'].items(): bg_use.setdefault(b, []).append(f'game:evidence_backdrop:{ev}')
    repl = {'BG02': 'assets/v2/lobby-door-inside.webp (인터폰 배경)', 'BG01': 'assets/v2/guard-monitors.webp (엔딩 컷 경비실)'}
    for name, bid in bg_files.items():
        era = layout['backgrounds'][bid]['era']; ent = bid.split('_')[0]
        src = add(os.path.join(SRC, '02_배경', 'game', name), ent, era, 'background', f'{PKG_NAME}/02_배경/' + ('originals' if name.endswith('.png') else 'game'),
                  notes='패키지 원본 바이트. 1080x1920 WebP는 941x1672 원본의 약 1.15배 확대 패키징.' if name.endswith('.webp') else '941x1672 원본 PNG(게임용 WebP는 반입 못 함).')
        game = add(os.path.join(DIST, 'assets', 'bg', f'{bid}.webp'), ent, era, 'background', 'room404/scripts/build-stage-assets.py',
                   selected=bg_use.get(bid, []), replacement=repl.get(bid), derived=src['sha256'], qa=(src['qaStatus'], 'derived:' + str(src['qaBasis'])),
                   notes='게임용 720x1280 축소본. 장면 좌표는 dist/data/scene_layout.json.')
    # 2. Approved character figures (sources + game crops) and the NPC02 file that is held back.
    for f in sorted(os.listdir(os.path.join(PROJECT, 'character-v5', 'png'))):
        ent = f.split('_')[0]; era = '2026' if '_2026_' in f else '2004' if '_2004_' else None
        a = chars['assets'].get(ent); scenes = [f'scene:{s}' for s, c in chars['contacts'].items() if c == ent]
        src = add(os.path.join(PROJECT, 'character-v5', 'png', f), ent, era, 'character', f'{PKG_NAME}/01_캐릭터/game',
                  notes='' if a else '검증된 파일이지만 NPC01~NPC10 역할군 그림은 10장이 다 모일 때 한 번에 켬(visitor_roles_enabled=false).')
        if a:
            add(os.path.join(DIST, a['figure']['file']), ent, era, 'character', 'room404/scripts/build-stage-assets.py', selected=scenes,
                replacement=f'assets/v5/bust-{ent}.webp (v0.15 흉상 크롭, v0.16에서 삭제)', derived=src['sha256'], qa=(src['qaStatus'], 'derived:' + str(src['qaBasis'])),
                notes=f"전신 컷, 발 기준점 {a['figure']['foot']}, 키 {a['figure']['height_m']}m [DESIGN]")
    # 3. Legacy game files (v2): in the game before the v02 asset package; not reviewed by it.
    legacy_sel = {f['file'].split('/')[-1]: 'game:intercom:gate_visitors' for f in chars['legacy']['figures'].values()}
    for f in sorted(os.listdir(os.path.join(DIST, 'assets', 'v2'))):
        p = os.path.join(DIST, 'assets', 'v2', f)
        if os.path.isdir(p):
            for g in sorted(os.listdir(p)): add(os.path.join(p, g), None, '2026', 'legacy_motion' if g.endswith('.mp4') else 'legacy_preview', 'room404 v0.6~v0.15', selected=['game:legacy'], qa=('LEGACY_IN_GAME', None))
            continue
        add(p, None, '2026', 'legacy_visitor' if f.startswith('visitor-') else 'legacy_scene', 'room404 v0.6~v0.15', selected=['game:legacy'] + ([legacy_sel[f]] if f in legacy_sel else []), qa=('LEGACY_IN_GAME', None))
    for f in ('visitors.png', 'visitors-before-haircut.png'): add(os.path.join(DIST, 'assets', f), None, '2026', 'legacy_sheet', 'room404 v0.6~v0.15', qa=('LEGACY_IN_GAME', None), notes='게임 코드가 읽지 않는 옛 시트.')
    # 4. UI package (vector + PNG frames). The game draws its UI in HTML/CSS; these are registered, not selected.
    for sub in ('game', 'sources'):
        for f in sorted(os.listdir(os.path.join(SRC, '05_UI', sub))):
            add(os.path.join(SRC, '05_UI', sub, f), f.split('_')[0], None, 'ui', f'{PKG_NAME}/05_UI/{sub}', notes='게임 UI는 DOM/CSS로 그림(문구 별도 JSON 원칙). 이 파일은 연결하지 않음.')
    # 5. Evidence text layer and the v05 QA material.
    add(os.path.join(SRC, '04_증거소품', 'evidence_readable_20_v03.json'), None, 'mixed', 'evidence_text', f'{PKG_NAME}/04_증거소품', selected=['game:story_evidence.body'],
        qa=('PASS_TEXT_LAYOUT_PER_ITEM', 'evidence_readable_20_v03.json (항목별 status: PASS 15 · REVISE 3 · BLOCKED 2)'), notes='증거 화면 본문. 항목별 상태는 story_evidence.json text_status.')
    for f in sorted(os.listdir(os.path.join(SRC, 'v05_QA', 'review'))):
        ent = f[:5]; add(os.path.join(SRC, 'v05_QA', 'review', f), ent, '2026', 'review_video' if f.endswith('.mp4') else 'review_image', f'{PKG_NAME}/v05 (NPC02-NPC10_재현코드_QA_v05)',
                         selected=['qa_viewer'], qa=('REFERENCE_ONLY', 'validation_all_v05.json: ' + v05[ent]['status']), notes='불투명 합성 검토 자료. 투명 에셋으로 쓰지 않음.')
    for npc in sorted(v05):
        d = os.path.join(SRC, 'v05_QA', 'code', npc)
        for f in sorted(os.listdir(d)):
            if f.endswith('.json') and (f.startswith('walk_rig') or f in ('config.json', 'binding.json', 'carrying_binding_v05.json')):
                add(os.path.join(d, f), npc, '2026', 'animation_data', f'{PKG_NAME}/v05 (NPC02-NPC10_재현코드_QA_v05)', selected=['dist/data/walk_clips.json', 'qa_viewer'],
                    qa=(v05[npc]['status'], 'validation_all_v05.json'), notes='걷기 클립 재현 데이터. 렌더된 스프라이트는 missing 참고.')
    add(os.path.join(SRC, '00_스타일가이드', 'QA_NPC01_BG02_static_placement_v01.jpg'), 'NPC01', '2026', 'reference', f'{PKG_NAME}/00_스타일가이드', selected=['scene_layout:BG02.stand_points.idle'],
        qa=('REFERENCE_ONLY', None), notes='BG02 정지 배치 기준(발 y 1780). 이 이미지 자체는 게임에 쓰지 않음.')
    # 6. v1.1 planning blockouts.
    for dp, _, fs in os.walk(os.path.join(PROJECT, 'story-plan', 'v1.1', 'assets')):
        for f in sorted(fs):
            m = re.match(r'(BG\d\d|NPC)_?(\d\d)?', f); ent = (m.group(1) + (m.group(2) or '')) if m and m.group(1) == 'NPC' else (m.group(1) if m else None)
            add(os.path.join(dp, f), ent, None, 'blockout', 'story-plan/v1.1/assets', qa=('NOT_GAME_ASSET', None), notes='기획 v1.1 블록아웃·콘셉트. 게임 에셋 아님.')
    # assetId: category:entity:variant, unique.
    seen = {}
    for e in entries.values():
        base = f"{e['category']}:{e['entityId'] or os.path.splitext(os.path.basename(e['sourcePath']))[0]}:{'game' if e['sourcePath'].startswith('room404/dist') else 'src'}"
        n = seen.get(base, 0); seen[base] = n + 1; e['assetId'] = base if n == 0 else f'{base}#{n + 1}'
    # Missing: named by the package manifests, not held here.
    have = set(entries)
    missing = [{'path': x['path'], 'sha256': x['sha256'], 'size': x.get('size'), 'source': 'download_integrity_v02.json'} for x in integrity if x['sha256'] not in have]
    for npc in sorted(v05):
        sums = J(SRC, 'v05_QA', 'code', npc, 'checksums_v05.json')
        for view in ('front', 'side', 'rear'):
            keys = [k for k in sums if k.startswith(f'sprites/{view}/')]
            missing.append({'path': f'{npc}/sprites/{view}/0000-0047.png', 'count': len(keys), 'sha256': 'checksums_v05.json', 'size': [720, 1280], 'source': f'asset-source/v05_QA/code/{npc}/checksums_v05.json'})
        for k, h in sums.items():
            if k.startswith('assets/') and h not in have: missing.append({'path': f'{npc}/{k}', 'sha256': h, 'source': f'asset-source/v05_QA/code/{npc}/checksums_v05.json'})
    reg = {'generated_by': 'room404/scripts/build-asset-registry.py', 'rules': __doc__.split('Rules (작업 지시 6항):')[1].split('`missing`')[0].strip(),
           'counts': {'entries': len(entries), 'duplicate_paths': sum(len(e['duplicatePaths']) for e in entries.values()), 'missing': len(missing)},
           'assets': sorted(entries.values(), key=lambda e: e['assetId']), 'missing': missing}
    json.dump(reg, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    from collections import Counter
    print('entries', len(entries), Counter(e['qaStatus'] for e in entries.values()), 'missing', len(missing))

if __name__ == '__main__':
    main()
