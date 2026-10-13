#!/usr/bin/env python3
"""Game copies of the approved backgrounds and full-body figures for the layered stage (v0.16.0).

  python3 scripts/build-stage-assets.py

Backgrounds: ../asset-source/02_배경/game/* (bytes fetched from the asset package on Drive). Each file must match the
SHA-256 in character-v5/docs/download_integrity_v02.json, otherwise the script stops. Game copies are 720x1280 WebP in
dist/assets/bg/ (the 1080x1920 package files are a ~1.15x upscale of 941x1672 originals, so 720x1280 loses nothing the
phone screen can show; BG04/BG05 arrived only as 941x1672 PNG originals and are downscaled the same way, never upscaled).
Figures: the approved full-body PNGs in ../character-v5/png (same SHA-256 rule the v0.15 bust script used). Alpha <= 16 is
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
# Background id -> file in asset-source. BG13 has a 2026 and a 2004 state; only the 2026 file is in hand.
BACKGROUNDS = {
    'BG01': 'BG01_security_booth_night_v01.webp', 'BG02': 'BG02_shared_entrance_night_v01.webp',
    'BG03': 'BG03_lobby_2026_v01.webp', 'BG04': 'BG04_floor4_2026_v01.png', 'BG05': 'BG05_floor4_2004_v01.png',
    'BG06': 'BG06_elevator_hall_2026_v01.webp', 'BG07': 'BG07_garage_2026_v01.webp',
    'BG09': 'BG09_maintenance_cover_2026_v01.webp',  # BG08: the approved file is ..._2026_base_v02_v01 (not in hand); the v01 in asset-source is not on an approval list, so no game copy
    'BG10': 'BG10_room404_2004_before_v01.webp', 'BG11': 'BG11_room404_2004_after_v01.webp',
    'BG12': 'BG12_public_archive_2026_v01.webp', 'BG13_2026': 'BG13_2026_exterior_2026_v01.webp',
}
FIGURES = ['CH09', 'CH10', 'MC15', 'MC25']
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
    for cid in FIGURES:
        a = assets['assets'][cid]; src = os.path.join(PKG, 'png', a['source']); s = sha(src)
        if s != a['source_sha256'] or s not in want.values(): sys.exit(f'{cid}: {a["source"]} does not match the package hash')
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
                       'height_m': 1.68, 'height_note': '[DESIGN] 기획·에셋 문서에 키 기록 없음: 성별·외형으로 추정하지 않고 1.68m 공통값'}
        report['figures'][cid] = {**a['figure'], 'source_sha256': s, 'crop': [int(v) for v in box], 'bytes': os.path.getsize(out)}
        print(cid, im.size, 'foot', foot, 'height_px', a['figure']['height_px'])
    # Legacy gate-visitor figures (v2 stand sprites already in the game, 8 looks). The 100 gate visitors' role bases
    # NPC01-NPC10 are not usable yet (static files missing, walk clips REVISE), so the stage keeps these, measured here.
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
