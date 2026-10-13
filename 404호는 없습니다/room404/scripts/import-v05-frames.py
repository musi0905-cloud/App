#!/usr/bin/env python3
"""Imports the rendered v05 walk sprites (NPC02-NPC10) for the internal QA viewer once the frame ZIPs are available.

  python3 scripts/import-v05-frames.py --source "<folder with NPC02 ... NPC10 sub-folders>" [--scale 0.5] [--npc NPC03]

Each <source>/<NPC>/sprites/{front,side,rear}/0000-0047.png (720x1280 RGBA) is checked against the SHA-256 in that NPC's
checksums_v05.json (the copy in ../asset-source/v05_QA/code/<NPC>/ is used when the source has none). Any missing file,
hash mismatch, wrong size or missing alpha stops the import for that NPC; nothing is guessed from file names.
Frames are never mirrored and sheets are never cut into equal cells: every frame is its own file, cropped to its own
alpha box, and the crop offset is stored, so the engine draws every frame on the same fixed 720x1280 canvas.
Output (QA only, not the game build): ../asset-source/v05_QA/frames/<NPC>/atlas.webp + atlas.json
  atlas.json: {src, scale, frames, clips:{enter:{offset,frames}, exit:{...}, pass:{...}}, rects:[[sx,sy,sw,sh,dx,dy]...],
               sha256:[...], qa_status} — dx,dy in clip-canvas pixels; sw/sh are atlas pixels (scale x clip pixels).
Run scripts/build-walk-binding.py afterwards to refresh frames_in_hand in dist/data/walk_clips.json.
"""
import argparse, hashlib, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_QA')
ORDER = [('enter', 'front'), ('exit', 'rear'), ('pass', 'side')]
MAX_W = 4096

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def import_npc(src_dir, npc, scale, out_root):
    sums_path = os.path.join(src_dir, 'checksums_v05.json')
    if not os.path.exists(sums_path): sums_path = os.path.join(PKG, 'code', npc, 'checksums_v05.json')
    sums = json.load(open(sums_path)); problems = []; crops = []; hashes = []
    for clip, view in ORDER:
        for i in range(48):
            rel = f'sprites/{view}/{i:04d}.png'; p = os.path.join(src_dir, rel)
            if rel not in sums: problems.append(f'{rel}: not in checksums_v05.json'); continue
            if not os.path.exists(p): problems.append(f'{rel}: missing'); continue
            h = sha(p)
            if h != sums[rel]: problems.append(f'{rel}: sha256 {h[:12]} != {sums[rel][:12]}'); continue
            im = Image.open(p)
            if im.size != (720, 1280) or im.mode != 'RGBA': problems.append(f'{rel}: {im.size} {im.mode}, expected 720x1280 RGBA'); continue
            box = im.getchannel('A').getbbox()
            if box is None: problems.append(f'{rel}: fully transparent'); continue
            crops.append((im.crop(box), box)); hashes.append(h)
    if problems: return {'npc': npc, 'ok': False, 'problems': problems}
    # Shelf packing in frame order (enter, exit, pass), scaled crops.
    placed, x, y, row_h = [], 0, 0, 0
    scaled = [(c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS) if scale != 1 else c, b) for c, b in crops]
    for c, b in scaled:
        if x + c.width > MAX_W: x, y, row_h = 0, y + row_h, 0
        placed.append((c, b, x, y)); x += c.width; row_h = max(row_h, c.height)
    atlas = Image.new('RGBA', (MAX_W if y else x, y + row_h), (0, 0, 0, 0))
    for c, b, px, py in placed: atlas.paste(c, (px, py))
    out = os.path.join(out_root, npc); os.makedirs(out, exist_ok=True)
    atlas.save(os.path.join(out, 'atlas.webp'), 'WEBP', lossless=True, method=6)
    meta = {'npc': npc, 'src': 'atlas.webp', 'scale': scale, 'frames': len(placed), 'canvas': [720, 1280],
            'clips': {clip: {'offset': k * 48, 'frames': 48, 'view': view} for k, (clip, view) in enumerate(ORDER)},
            'rects': [[px, py, c.width, c.height, b[0], b[1]] for c, b, px, py in placed], 'sha256': hashes,
            'qa_status': 'REVISE', 'note': 'QA 뷰어 전용. qa_status가 PASS가 되기 전에는 게임 빌드(dist)에 넣지 않는다.'}
    json.dump(meta, open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))
    return {'npc': npc, 'ok': True, 'frames': len(placed), 'atlas': list(atlas.size), 'bytes': os.path.getsize(os.path.join(out, 'atlas.webp'))}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--source', required=True); ap.add_argument('--scale', type=float, default=.5)
    ap.add_argument('--npc', action='append'); ap.add_argument('--out', default=os.path.join(PKG, 'frames'))
    a = ap.parse_args(); names = a.npc or sorted(d for d in os.listdir(a.source) if d.startswith('NPC') and os.path.isdir(os.path.join(a.source, d)))
    if not names: sys.exit('no NPC folders under ' + a.source)
    report = [import_npc(os.path.join(a.source, n), n, a.scale, a.out) for n in names]
    for r in report: print(r['npc'], 'OK' if r['ok'] else 'STOPPED', r.get('frames', ''), r.get('atlas', ''), '\n  '.join([''] + r.get('problems', [])[:12]))
    json.dump(report, open(os.path.join(a.out, 'import_report.json') if os.path.isdir(a.out) else os.devnull, 'w'), ensure_ascii=False, indent=1)
    if not all(r['ok'] for r in report): sys.exit(1)

if __name__ == '__main__':
    main()
