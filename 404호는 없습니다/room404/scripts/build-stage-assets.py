#!/usr/bin/env python3
"""Game copies of the approved backgrounds and full-body figures for the layered stage (v0.16.0, figures/backgrounds added v0.18.0).

  python3 scripts/build-stage-assets.py

Backgrounds: ../asset-source/02_배경/game/* (bytes fetched from the asset package on Drive). Each file must match the
SHA-256 in character-v5/docs/download_integrity_v02.json, otherwise the script stops. Game copies are 720x1280 WebP in
dist/assets/bg/ (the 1080x1920 package files are a ~1.15x upscale of 941x1672 originals, so 720x1280 loses nothing the
phone screen can show; BG04/BG05 arrived only as 941x1672 PNG originals and are downscaled the same way, never upscaled).
Figures: the approved full-body PNGs (game exports) in ../character-v5/png and, since v0.18.0, ../asset-source/01_캐릭터/game
(restored producer delivery, see asset-source/v06_sources). Same SHA-256 rule the v0.15 bust script used. Alpha <= 16 is
cleared, the figure is cropped to its alpha box (8 px margin) and stored at most 1200 px tall. The foot pivot (centre of
the sole rows) and the figure height in image pixels are written to dist/data/character_assets.json -> assets[id].figure.
"""
import json, hashlib, os, sys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(ROOT)
PKG = os.path.join(PROJECT, 'character-v5')
BG_SRC = os.path.join(PROJECT, 'asset-source', '02_배경', 'game')
BG_OUT = os.path.join(ROOT, 'dist', 'assets', 'bg')
FIG_OUT = os.path.join(ROOT, 'dist', 'assets', 'v5')
ASSETS_JSON = os.path.join(ROOT, 'dist', 'data', 'character_assets.json')
# Background id -> file in asset-source. BG04/BG05 stay on the 941x1672 PNG originals: the package WebPs (now in hand, hashes
# match) are 1080x1920 upscales of the same originals, so they add nothing at 720x1280.
BACKGROUNDS = {
    'BG01': 'BG01_security_booth_night_v01.webp', 'BG02': 'BG02_shared_entrance_night_v01.webp',
    'BG03': 'BG03_lobby_2026_v01.webp', 'BG04': 'BG04_floor4_2026_v01.png', 'BG05': 'BG05_floor4_2004_v01.png',
    'BG06': 'BG06_elevator_hall_2026_v01.webp', 'BG07': 'BG07_garage_2026_v01.webp',
    'BG06_interior': 'BG06_interior_elevator_2026_interior_v01.webp',
    'BG08': 'BG08_management_office_2026_base_v02_v01.webp',  # approved base_v02; the v01 in asset-source is not on an approval list
    'BG09': 'BG09_maintenance_cover_2026_v01.webp',
    'BG10': 'BG10_room404_2004_before_v01.webp', 'BG11': 'BG11_room404_2004_after_v01.webp',
    'BG12': 'BG12_public_archive_2026_v01.webp', 'BG13_2026': 'BG13_2026_exterior_2026_v01.webp',
    'BG13_2004': 'BG13_2004_exterior_2004_v01.webp',
}
FIGURES = ['CH09', 'CH10', 'MC15', 'MC25']  # entries already in character_assets.json (v0.16)
GAME_FIG = os.path.join(PROJECT, 'asset-source', '01_캐릭터', 'game')
# v0.18.0: story contacts CH06/CH08 and the ten visitor role bases. (id, folder, file, name). Heights: NPC02-NPC10 use
# height_m of the producer's v05 walk render config (same person as the walk clip); NPC01, CH06, CH08 have no height
# record, so they keep the [DESIGN] 1.68 m common value like CH09/CH10/MC15/MC25.
NEW_FIGURES = [
    ('CH06', GAME_FIG, 'CH06_jang_hyesook_2026_front_full_v01.png', '장혜숙, 2004 입주자대표 [DESIGN]'),
    ('CH08', GAME_FIG, 'CH08_seo_mina_2026_front_full_v01.png', '서민아, 현재 입주민 [DESIGN]'),
    ('NPC01', GAME_FIG, 'NPC01_visitor_male_2026_front_full_v01.png', '방문객 역할 그림: 귀가 주민'),
    ('NPC02', os.path.join(PKG, 'png'), 'NPC02_visitor_female_2026_front_full_v01.png', '방문객 역할 그림: 가족 방문'),
    ('NPC03', GAME_FIG, 'NPC03_courier_2026_front_full_v02_v01.png', '방문객 역할 그림: 택배 기사'),
    ('NPC04', GAME_FIG, 'NPC04_technician_2026_front_full_v01.png', '방문객 역할 그림: 시설 점검'),
    ('NPC05', GAME_FIG, 'NPC05_caregiver_2026_front_full_v01.png', '방문객 역할 그림: 돌봄 방문'),
    ('NPC06', GAME_FIG, 'NPC06_elderly_neighbor_2026_front_full_v01.png', '방문객 역할 그림: 이웃'),
    ('NPC07', GAME_FIG, 'NPC07_food_delivery_2026_front_full_v01.png', '방문객 역할 그림: 음식 배달'),
    ('NPC08', GAME_FIG, 'NPC08_vehicle_companion_2026_front_full_v01.png', '방문객 역할 그림: 차량 동승'),
    ('NPC09', GAME_FIG, 'NPC09_public_service_2026_front_full_v01.png', '방문객 역할 그림: 공공 업무'),
    ('NPC10', GAME_FIG, 'NPC10_friend_2026_front_full_v01.png', '방문객 역할 그림: 지인'),
]
V05_CODE = os.path.join(PROJECT, 'asset-source', 'v05_QA', 'code')
GAME_SIZE = (720, 1280)
FIG_MAX_H = 1200

def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()

def package_hashes():
    h = {}
    for x in json.load(open(os.path.join(PKG, 'docs', 'download_integrity_v02.json')))['images']:
        h[x['path']] = x['sha256']
    for x in json.load(open(os.path.join(PKG, 'docs', 'character_revision_manifest_v02.json'))):
        if x.get('game_path'): h[x['game_path']] = x['sha256']
    return h

def feet_of(alpha, bottom, top):
    """Left/right sole centres (image px) from the sole rows: the widest gap between opaque column runs splits the feet."""
    band = alpha[bottom - max(2, int((bottom - top) * .04)):bottom + 1] > 64; cols = np.where(band.any(axis=0))[0]
    gaps = np.diff(cols); k = int(np.argmax(gaps)) if len(gaps) else 0
    if not len(gaps) or gaps[k] < 3: c = float((cols.min() + cols.max()) / 2); return [[c, bottom + 1], [c, bottom + 1]]
    left, right = cols[:k + 1], cols[k + 1:]
    return [[round(float((left.min() + left.max()) / 2), 1), bottom + 1], [round(float((right.min() + right.max()) / 2), 1), bottom + 1]]

def main():
    want = package_hashes(); report = {'backgrounds': {}, 'figures': {}}
    os.makedirs(BG_OUT, exist_ok=True); os.makedirs(FIG_OUT, exist_ok=True)
    for bid, name in BACKGROUNDS.items():
        src = os.path.join(BG_SRC, name); s = sha(src)
        key = ('02_배경/originals/' if name.endswith('.png') else '02_배경/game/') + name
        if want.get(key) != s: sys.exit(f'{bid}: {name} does not match the package hash ({s[:12]} != {str(want.get(key))[:12]})')
        im = Image.open(src).convert('RGB')
        if im.width < GAME_SIZE[0] or im.height < GAME_SIZE[1]: sys.exit(f'{bid}: source smaller than the game size, refusing to upscale')
        out = os.path.join(BG_OUT, f'{bid}.webp'); im.resize(GAME_SIZE, Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
        report['backgrounds'][bid] = {'file': f'assets/bg/{bid}.webp', 'source': f'asset-source/02_배경/game/{name}', 'source_sha256': s,
                                      'source_size': list(im.size), 'size': list(GAME_SIZE), 'bytes': os.path.getsize(out)}
        print(bid, im.size, '->', GAME_SIZE, report['backgrounds'][bid]['bytes'])
    assets = json.load(open(ASSETS_JSON))
    def build_figure(cid, src, a, height_m, height_note):
        px = np.array(Image.open(src).convert('RGBA')); px[px[..., 3] <= 16] = 0
        ys, xs = np.where(px[..., 3] > 16); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
        m = 8; box = (max(0, x0 - m), max(0, y0 - m), min(px.shape[1], x1 + m + 1), min(px.shape[0], y1 + m + 1))
        im = Image.fromarray(px).crop(box); scale = min(1.0, FIG_MAX_H / im.height)
        if scale < 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        a2 = np.array(im)[..., 3]; rows = np.where((a2 > 64).any(axis=1))[0]; top, bottom = int(rows.min()), int(rows.max())
        sole = a2[bottom - max(2, int((bottom - top) * .04)):bottom + 1] > 64; cols = np.where(sole.any(axis=0))[0]
        foot = [round(float((cols.min() + cols.max()) / 2), 1), bottom + 1]
        out = os.path.join(FIG_OUT, f'figure-{cid}.webp'); im.save(out, 'WEBP', quality=86, method=6)
        a['file'] = f'assets/v5/figure-{cid}.webp'  # what the game shows (the v0.15 bust crops are no longer used)
        a['figure'] = {'file': f'assets/v5/figure-{cid}.webp', 'size': [im.width, im.height], 'foot': foot, 'feet': feet_of(a2, bottom, top), 'height_px': bottom + 1 - top,
                       'height_m': height_m, 'height_note': height_note}
        report['figures'][cid] = {**a['figure'], 'source_sha256': sha(src), 'source_size': [px.shape[1], px.shape[0]], 'crop': [int(v) for v in box], 'bytes': os.path.getsize(out)}
        print(cid, im.size, 'foot', foot, 'height_px', a['figure']['height_px'], 'height_m', height_m)
    DESIGN_H = '[DESIGN] 기획·에셋 문서에 키 기록 없음: 성별·외형으로 추정하지 않고 1.68m 공통값'
    for cid in FIGURES:
        a = assets['assets'][cid]; src = os.path.join(PKG, 'png', a['source']); s = sha(src)
        if s != a['source_sha256'] or s not in want.values(): sys.exit(f'{cid}: {a["source"]} does not match the package hash')
        build_figure(cid, src, a, 1.68, DESIGN_H)
    for cid, folder, name, label in NEW_FIGURES:
        src = os.path.join(folder, name); s = sha(src); key = '01_캐릭터/game/' + name
        if want.get(key) != s: sys.exit(f'{cid}: {name} does not match the package hash ({s[:12]} != {str(want.get(key))[:12]})')
        cfg = os.path.join(V05_CODE, cid, 'config.json')
        if os.path.exists(cfg):
            h = json.load(open(cfg))['height_m']; note = f'제작 측 v05 걷기 렌더 설정(asset-source/v05_QA/code/{cid}/config.json) height_m'
        else: h, note = 1.68, DESIGN_H
        target = assets.setdefault('visitor_role_figures', {}) if cid.startswith('NPC') else assets['assets']
        a = target.setdefault(cid, {})
        a.update({'name': label, 'approval': '07_검수완료/approved_static_assets_v01.json', 'source': name, 'source_sha256': s,
                  'source_dir': os.path.relpath(folder, PROJECT)})
        build_figure(cid, src, a, h, note)
    # Story contacts whose approved figure is now built move from contacts_waiting_for_files to contacts.
    waiting = assets.get('contacts_waiting_for_files') or {}
    for scene, cid in list(waiting.items()):
        if assets['assets'].get(cid, {}).get('figure'): assets['contacts'][scene] = cid; del waiting[scene]
    assets['contacts'] = dict(sorted(assets['contacts'].items()))
    if waiting: assets['contacts_waiting_for_files'] = waiting
    else: assets.pop('contacts_waiting_for_files', None)
    # Visitor role bases: all ten built from approved, hash-checked files. The switch stays off (decided here, not by
    # file count): the CCTV replay (replay.js) still draws the eight legacy looks for walking and gestures, and there is no
    # walk/gesture art for NPC01-NPC10 that may be used (v05 clips are REVISE, NPC01 has none). Turning the intercom over
    # alone would show one visitor as two different people in the same case (CCTV vs intercom), against clues such as
    # A001 "같은 옷차림의 사람" and A075 "옷차림이 기록과 같아요".
    roles = assets['visitor_roles']; rf = assets.get('visitor_role_figures', {})
    approved = {x['id'] for x in json.load(open(os.path.join(PKG, 'docs', 'approved_static_assets_v01.json'))) if x['status'] == 'PASS' and 'front_full' in x['asset_key']}
    assets['visitor_roles_status'] = {
        'files': f"{sum(1 for c in roles.values() if c in rf)}/{len(roles)}",
        'approved_static': f"{sum(1 for c in roles.values() if c in approved)}/{len(roles)}",
        'stage_check': 'tests/figures-qa.mjs (BG02 인터폰, 발·키·그림자) — test-artifacts/figures',
        'cctv_art': f"0/{len(roles)}",
        'blocked_by': 'CCTV 재생은 기존 8개 외형의 걷기·몸짓 그림을 그린다. 역할 그림(NPC01~NPC10)에 쓸 수 있는 걷기·몸짓 그림이 없어(v05 REVISE, NPC01 없음) 인터폰만 바꾸면 같은 방문객이 CCTV와 인터폰에서 다른 사람으로 보인다(A001·A075 같은 옷차림 단서와 충돌).'}
    assets['visitor_roles_enabled'] = False
    assets['visitor_roles_note'] = ('방문객 역할 그림 NPC01~NPC10 10장은 승인 파일로 만들어 visitor_role_figures에 두었고 QA 뷰어에서 볼 수 있다. '
                                    '게임에서는 아직 켜지 않는다(visitor_roles_status.blocked_by). 10장은 역할별 공용 그림이며 방문객 100명 각각의 고유 원화가 아니다.')
    # Legacy gate-visitor figures (v2 stand sprites already in the game, 8 looks). They are what the gate visitor shows
    # while visitor_roles_enabled is false (character_assets.json says why), measured here.
    legacy = {}
    for n in range(1, 9):
        f = os.path.join(ROOT, 'dist', 'assets', 'v2', f'visitor-0{n}-stand.webp'); a = np.array(Image.open(f).convert('RGBA'))[..., 3]
        rows = np.where((a > 64).any(axis=1))[0]; top, bottom = int(rows.min()), int(rows.max())
        cols = np.where((a[bottom - 18:bottom + 1] > 64).any(axis=0))[0]
        legacy[f'visitor-0{n}'] = {'file': f'assets/v2/visitor-0{n}-stand.webp', 'size': [a.shape[1], a.shape[0]], 'foot': [round(float((cols.min() + cols.max()) / 2), 1), bottom + 1], 'feet': feet_of(a, bottom, top),
                                   'height_px': bottom + 1 - top, 'height_m': 1.68, 'sha256': sha(f)}
    assets['legacy'] = {'status': 'LEGACY_IN_GAME', 'note': 'v0.6~v0.15 게임에 쓰이던 방문객 정지 그림. v02 에셋 패키지 검수 대상이 아님. NPC01~NPC10 역할군 그림이 PASS로 들어오면 교체.', 'figures': legacy}
    json.dump(assets, open(ASSETS_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(PROJECT, 'asset-source', 'stage_build_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
