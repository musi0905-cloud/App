#!/usr/bin/env python3
"""Make intercom bust crops from the approved full-body character PNGs (asset package 'v02', see character-v5/).

  python3 scripts/build-character-busts.py            # reads ../character-v5/png, writes dist/assets/v5 + data
Only IDs listed in APPROVED below are converted; each source must match the SHA-256 recorded by the asset package
(download_integrity_v02.json or character_revision_manifest_v02.json), otherwise the script stops.
Processing: alpha <= 16 is cleared (faint generation dust, 12k-27k pixels per file), the head is located from the
alpha mask, and a head-and-shoulders crop with the intercom box aspect (1.07 : 1) is saved as WebP.
"""
import json, hashlib, os, sys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, '..', 'character-v5')
OUT = os.path.join(ROOT, 'dist', 'assets', 'v5')
# id -> (source file, approval source). Only PASS static sprites from the package's approval lists.
APPROVED = {
    'CH09': ('CH09_jeong_beomsu_2026_front_full_v01.png', '07_검수완료/approved_static_assets_v01.json'),
    'CH10': ('CH10_yoon_dogyeong_2026_front_full_v01.png', '07_검수완료/approved_static_assets_v01.json'),
    'MC15': ('MC15_2026_front_full_v02.png', '07_검수완료/approved_patch_assets_v02.json'),
    'MC25': ('MC25_2026_front_full_v02.png', '07_검수완료/approved_patch_assets_v02.json'),
    # Role figures for the 100 gate visitors (NPC01-NPC10) are switched on only as a complete set; NPC02 is verified
    # but kept out of the game until NPC01 and NPC03-NPC10 arrive as single files (they are only inside the >10 MB
    # ZIP parts, and the single NPC01 file on Drive is truncated). Also waiting: CH06, CH08.
}
ASPECT = 1.07      # width / height of the .bust box inside the 3:2 intercom screen (50% x 70%)
BUST = 0.36        # crop height as a share of the figure height (head to mid-chest)
OUT_H = 540      # 540 px covers the widest bust box (252 CSS px) at 2x density

def expected_hashes():
    h = {}
    integ = json.load(open(os.path.join(PKG, 'docs', 'download_integrity_v02.json')))['images']
    for x in integ:
        if x['path'].startswith('01_캐릭터/game/'): h[x['path'].split('/')[-1]] = x['sha256']
    for x in json.load(open(os.path.join(PKG, 'docs', 'character_revision_manifest_v02.json'))):
        if x.get('game_path'): h[x['game_path'].split('/')[-1]] = x['sha256']
    return h

def main():
    os.makedirs(OUT, exist_ok=True)
    want = expected_hashes(); report = {}
    for cid, (name, approval) in APPROVED.items():
        src = os.path.join(PKG, 'png', name)
        raw = open(src, 'rb').read(); sha = hashlib.sha256(raw).hexdigest()
        if want.get(name) != sha: sys.exit(f'{cid}: {name} does not match the package hash ({sha[:12]} != {str(want.get(name))[:12]})')
        a = np.array(Image.open(src).convert('RGBA'))
        dust = int(((a[..., 3] > 0) & (a[..., 3] <= 16)).sum()); a[a[..., 3] <= 16] = 0
        ys, xs = np.where(a[..., 3] > 16); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max(); H = y1 - y0
        head = a[y0:y0 + int(H * .12), :, 3] > 64; cx = int(np.where(head)[1].mean())
        ch = int(H * BUST); cw = int(ch * ASPECT); top = max(0, y0 - int(H * .02))
        left = cx - cw // 2; box = (left, top, left + cw, top + ch)
        im = Image.fromarray(a).crop(box)  # crop pads with transparency when the box leaves the canvas
        im = im.resize((int(OUT_H * ASPECT), OUT_H), Image.LANCZOS)
        out = os.path.join(OUT, f'bust-{cid}.webp'); im.save(out, 'WEBP', quality=84, method=6)
        report[cid] = {'file': f'assets/v5/bust-{cid}.webp', 'source': name, 'source_sha256': sha, 'approval': approval,
                       'figure_bbox': [int(x0), int(y0), int(x1), int(y1)], 'crop': [int(v) for v in box], 'dust_pixels_cleared': dust,
                       'bytes': os.path.getsize(out)}
        print(cid, report[cid]['crop'], 'dust', dust, 'bytes', report[cid]['bytes'])
    json.dump(report, open(os.path.join(PKG, 'bust_build_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
