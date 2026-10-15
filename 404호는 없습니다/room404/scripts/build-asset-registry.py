#!/usr/bin/env python3
"""Asset registry: every production asset file that is actually in this repository, hashed here (v0.18.0).

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
        notes='승인 목록에 없는 판. 게임 파일은 승인본 BG08_management_office_2026_base_v02_v01(v0.18.0 복원 반입)로 만듦.')
    usage = layout['usage']; bg_use = {}
    bg_use.setdefault(usage['intercom']['background'], []).append('game:intercom'); bg_use.setdefault(usage['desk']['background'], []).append('game:desk')
    for n, b in usage['night_intro'].items(): bg_use.setdefault(b, []).append(f'game:night_intro:N{n}')
    for s, b in usage['cutscene_setting'].items(): bg_use.setdefault(b, []).append(f'game:cutscene:{s}')
    for ev, b in usage['evidence_backdrop'].items(): bg_use.setdefault(b, []).append(f'game:evidence_backdrop:{ev}')
    for ev, b in usage.get('evidence_found_at', {}).items(): bg_use.setdefault(b, []).append(f'game:evidence_found_at:{ev}')
    repl = {'BG02': 'assets/v2/lobby-door-inside.webp (인터폰 배경)', 'BG01': 'assets/v2/guard-monitors.webp (엔딩 컷 경비실)'}
    for name, bid in bg_files.items():
        era = layout['backgrounds'][bid]['era']; ent = bid.split('_')[0]
        src = add(os.path.join(SRC, '02_배경', 'game', name), ent, era, 'background', f'{PKG_NAME}/02_배경/' + ('originals' if name.endswith('.png') else 'game'),
                  notes='패키지 원본 바이트. 1080x1920 WebP는 941x1672 원본의 약 1.15배 확대 패키징.' if name.endswith('.webp') else '941x1672 원본 PNG(게임용 WebP는 반입 못 함).')
        game = add(os.path.join(DIST, 'assets', 'bg', f'{bid}.webp'), ent, era, 'background', 'room404/scripts/build-stage-assets.py',
                   selected=bg_use.get(bid, []), replacement=repl.get(bid), derived=src['sha256'], qa=(src['qaStatus'], 'derived:' + str(src['qaBasis'])),
                   notes='게임용 720x1280 축소본. 장면 좌표는 dist/data/scene_layout.json.')
    # 2. Approved character figures (sources + game crops): character-v5/png (v0.15) and asset-source/01_캐릭터/game (game
    #    exports restored 2026-10-14). Story contacts are shown in their scenes; the ten visitor role figures are built but
    #    the switch stays off (character_assets.json visitor_roles_status.blocked_by), so they are not selected.
    role_off = chars.get('visitor_roles_status', {}).get('blocked_by', '')
    for folder, pkg in ((os.path.join(PROJECT, 'character-v5', 'png'), f'{PKG_NAME}/01_캐릭터/game'), (os.path.join(SRC, '01_캐릭터', 'game'), f'{PKG_NAME}/01_캐릭터/game (복원 전달 2026-10-14, asset-source/v06_sources)')):
        for f in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            ent = f.split('_')[0]; era = '2026' if '_2026_' in f else '2004' if '_2004_' in f else None
            a = chars['assets'].get(ent); r = chars.get('visitor_role_figures', {}).get(ent); scenes = [f'scene:{s}' for s, c in chars['contacts'].items() if c == ent]
            if (a and a.get('source') != f) or (r and r.get('source') != f): a = r = None  # another revision of the same entity
            src = add(os.path.join(folder, f), ent, era, 'character', pkg,
                      notes='' if a else ('방문객 역할 그림: 게임 파일은 만들었지만 켜지 않음. ' + role_off) if r else '')
            if a:
                add(os.path.join(DIST, a['figure']['file']), ent, era, 'character', 'room404/scripts/build-stage-assets.py', selected=scenes,
                    replacement=f'assets/v5/bust-{ent}.webp (v0.15 흉상 크롭, v0.16에서 삭제)' if ent in ('CH09', 'CH10', 'MC15', 'MC25') else None, derived=src['sha256'], qa=(src['qaStatus'], 'derived:' + str(src['qaBasis'])),
                    notes=f"전신 컷, 발 기준점 {a['figure']['foot']}, 키 {a['figure']['height_m']}m ({'DESIGN' if 'DESIGN' in a['figure'].get('height_note', '') else a['figure'].get('height_note', '')})")
            if r:
                add(os.path.join(DIST, r['figure']['file']), ent, era, 'character', 'room404/scripts/build-stage-assets.py', selected=['qa_viewer'], derived=src['sha256'], qa=(src['qaStatus'], 'derived:' + str(src['qaBasis'])),
                    notes=f"역할 그림 전신 컷(게임 꺼짐, 오프라인 캐시 제외), 발 기준점 {r['figure']['foot']}, 키 {r['figure']['height_m']}m. 방문객 100명의 고유 원화가 아님.")
    # 2b. Approved character originals received as single files (01_캐릭터/originals). QA from the approval record by SHA-256.
    #     Role figures switch on only when all ten are in hand, so these are not selected for the game.
    orig = os.path.join(SRC, '01_캐릭터', 'originals')
    for f in sorted(os.listdir(orig)) if os.path.isdir(orig) else []:
        add(os.path.join(orig, f), f.split('_')[0], '2026' if '_2026_' in f else '2004' if '_2004_' in f else None, 'character', f'{PKG_NAME}/01_캐릭터/originals',
            notes='승인 원본(게임 출력본 아님). 게임 출력본 6679a805…는 2026-10-14 복원 전달로 받았고 이 원본과 픽셀이 같음(PNG 압축만 다름).')
    # 2c. Package game WebPs of BG04/BG05 (restored 2026-10-14): hash-matched; the game files stay built from the PNG originals.
    for f in ('BG04_floor4_2026_v01.webp', 'BG05_floor4_2004_v01.webp'):
        p = os.path.join(SRC, '02_배경', 'game', f)
        if os.path.exists(p): add(p, f[:4], '2026' if '2026' in f else '2004', 'background', f'{PKG_NAME}/02_배경/game (복원 전달 2026-10-14)', notes='패키지 WebP(941x1672 원본의 1080x1920 확대 출력). 게임 파일은 원본 PNG에서 만듦.')
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
        # part art (render inputs), restored 2026-10-14; the BG02 copy each package carries equals 02_배경/game/BG02 and is not kept twice
        for f in sorted(os.listdir(os.path.join(d, 'assets'))) if os.path.isdir(os.path.join(d, 'assets')) else []:
            add(os.path.join(d, 'assets', f), npc, '2026', 'animation_art', f'{PKG_NAME}/06_애니메이션/NPC02-NPC10_손소품경계수정_v05 (복원 전달 2026-10-14)', selected=['asset-source/v06_render/render_v06.js'],
                qa=(v05[npc]['status'], 'validation_all_v05.json'), notes='걷기 렌더 입력 부품 그림(원본 바이트). v06 재렌더에 사용.')
    # v05 walk sprites: the original 720x1280 RGBA frames (asset-source/v05_frames, from the 93 transfer ZIPs) and the
    # QA-viewer atlases built from them. Package status REVISE; the frame review (frame_qa/review_summary_v05.json) did
    # not pass any view, so none of them is selected for the game.
    review_path = os.path.join(SRC, 'v05_QA', 'frame_qa', 'review_summary_v05.json'); review = J(review_path) if os.path.exists(review_path) else None
    frames_root = os.path.join(SRC, 'v05_frames')
    for npc in sorted(v05):
        d = os.path.join(frames_root, npc)
        if not os.path.isdir(d): continue
        for view in ('front', 'side', 'rear'):
            st = review['npcs'][npc][view]['status'] if review else None
            for f in sorted(os.listdir(os.path.join(d, 'sprites', view))):
                add(os.path.join(d, 'sprites', view, f), npc, '2026', 'animation_frame', f'{PKG_NAME}/v05 frames (TRANSFER_MANIFEST.json, {npc}_v05_frames_part*.zip)',
                    selected=['qa_viewer'], qa=(v05[npc]['status'], 'validation_all_v05.json' + (f'; frame review {st}' if st else '')),
                    notes=f'{view} 원본 프레임(고정 캔버스, 루트 이동 포함). 게임 미적용.')
        for f in sorted(os.listdir(d)):
            if f.endswith('.json') and (f.startswith('walk_rig') or f in ('config.json', 'binding.json', 'carrying_binding_v05.json')):
                add(os.path.join(d, f), npc, '2026', 'animation_data', f'{PKG_NAME}/v05 frames', selected=['qa_viewer'], qa=(v05[npc]['status'], 'validation_all_v05.json'))
        atlas = os.path.join(SRC, 'v05_QA', 'frames', npc)
        if os.path.isdir(atlas):
            for f in ('atlas.webp', 'atlas.json'):
                add(os.path.join(atlas, f), npc, '2026', 'qa_atlas', 'room404/scripts/import-v05-frames.py', selected=['qa_viewer'], qa=(v05[npc]['status'], 'derived:validation_all_v05.json'),
                    derived=f'asset-source/v05_frames/{npc}/sprites', notes='QA 뷰어용 아틀라스(원본 알파 상자 + 오프셋, 0.5배). 게임 빌드에 넣지 않음.')
    # v06 renders (own renderer): QA atlases and the side-by-side review videos. Status from review_summary_v06.json.
    r6p = os.path.join(SRC, 'v06_QA', 'review_summary_v06.json'); r6 = J(r6p) if os.path.exists(r6p) else None
    for npc in sorted(v05):
        d = os.path.join(SRC, 'v06_QA', npc)
        if not os.path.isdir(d): continue
        st6 = ', '.join(f"{v} {r6['npcs'][npc][v]['status']}" for v in ('front', 'side', 'rear', 'sequence')) if r6 and npc in r6['npcs'] else None
        for f in ('atlas.webp', 'atlas.json'):
            if os.path.exists(os.path.join(d, f)):
                add(os.path.join(d, f), npc, '2026', 'qa_atlas', 'asset-source/v06_render/render_v06.js -> room404/scripts/import-v06-frames.py', selected=['qa_viewer'],
                    qa=('REVISE' if not st6 or 'REVISE' in st6 else 'PASS', 'v06 frame review: ' + str(st6)), derived='asset-source/v06_render (render_v06.js, 입력 asset-source/v05_QA/code)',
                    notes='v06 재렌더 프레임의 QA 아틀라스(입장·멈춤·대기·회전·출발·퇴장·지나감). 게임 빌드에 넣지 않음.')
        for f in sorted(x for x in os.listdir(d) if x.endswith('.mp4')):
            add(os.path.join(d, f), npc, '2026', 'review_video', 'room404/scripts/analyze-v06-frames.py', selected=['qa_viewer'], qa=('REFERENCE_ONLY', None),
                notes='v05 원본 프레임과 v06 재렌더를 나란히 놓은 검토 영상(불투명 합성).')
    # NPC06 v07 experiment (2026-10-14): the producer's sheets (v07b bound by render_v06.js --art=v07, v07a drafts kept for
    # comparison only), their documents and the review videos. Status from the producer manifest and review_summary_v07.json;
    # nothing here is selected for the game.
    d7 = os.path.join(SRC, 'v07_NPC06', 'source'); r7p = os.path.join(SRC, 'v07_QA', 'review_summary_v07.json'); r7 = J(r7p) if os.path.exists(r7p) else None
    if os.path.isdir(d7):
        st7 = ', '.join(f"{v} {r7['views'][v]['status']}" for v in ('front', 'side', 'rear', 'sequence')) if r7 else None; pkg7 = 'Drive 1gMILNQsB8yY7VBo2oFHRml7BYYDca8cA (NPC06_보행부품_v07_1차검수_20261014)'
        for f in sorted(x for x in os.listdir(d7) if x.endswith('.png')):
            add(os.path.join(d7, f), 'NPC06', '2026', 'animation_art', pkg7, selected=['asset-source/v06_render/render_v06.js --art=v07'], qa=('REVISE', 'producer manifest visual REVISE; v07 frame review: ' + str(st7)),
                notes='NPC06 v07b 후보 시트(정면·후면 다리 6상태, 몸통 4상태). 시험 연결만 했고 게임에는 쓰지 않음.')
        for f in sorted(os.listdir(os.path.join(d7, 'draft_v07a'))):
            add(os.path.join(d7, 'draft_v07a', f), 'NPC06', '2026', 'animation_art', pkg7, qa=('REVISE', 'producer manifest: draft (candidate false)'), notes='v07a 초안. 비교용으로만 보관, 렌더러가 읽지 않음.')
        for f in ('NPC06_v07_asset_manifest.json', 'NPC06_v07_prompts.json'):
            add(os.path.join(d7, f), 'NPC06', None, 'delivery_record', pkg7, qa=('RECORD', None), notes='제작자 기록. 품질 상태를 정하지 않음.')
        for f in sorted(x for x in os.listdir(os.path.join(SRC, 'v07_QA', 'NPC06')) if x.endswith('.mp4')):
            add(os.path.join(SRC, 'v07_QA', 'NPC06', f), 'NPC06', '2026', 'review_video', 'asset-source/v07_NPC06/tools/analyze_v07.py', qa=('REFERENCE_ONLY', None),
                notes='같은 조건의 v06 재렌더와 v07 시험 렌더 비교(또는 v07 겹침 표시) 영상.')
    for f in ('SOURCE_MANIFEST.json', 'MATCH_REPORT.json', 'SOURCE_IMPORT_RESULT.json'):
        p = os.path.join(SRC, 'v06_sources', f)
        if os.path.exists(p): add(p, None, None, 'delivery_record', 'Drive 1OjyxfqzZS7wWfcNo-ppjmi2dYft7i1xM (2026-10-14)', qa=('RECORD', None), notes='복원 전달 기록(41 source ZIP, 169 파일). 품질 상태를 정하지 않음.')
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
            if any(sums[k] not in have for k in keys):
                missing.append({'path': f'{npc}/sprites/{view}/0000-0047.png', 'count': sum(sums[k] not in have for k in keys), 'sha256': 'checksums_v05.json', 'size': [720, 1280], 'source': f'asset-source/v05_QA/code/{npc}/checksums_v05.json'})
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
