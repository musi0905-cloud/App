#!/usr/bin/env python3
"""QA-viewer atlases of the v06 walk renders (asset-source/v06_render/render_v06.js), NPC02-NPC10.

  python3 scripts/import-v06-frames.py --render <out root> [--npc NPC06] [--scale 0.5]

<out root>/<NPC>/ is what render_v06.js wrote (seq/NNNN.png, pass/NNNN.png, frames.json). The rendered PNGs are not
kept in the repository (they are rebuilt byte for byte from the inputs; their SHA-256 are kept here). Every frame is a
720x1280 RGBA file on the fixed canvas; each is cropped to its own alpha box and the offset is stored, exactly like
import-v05-frames.py (no re-centring, no per-frame scaling, no mirroring); every rect is checked to map back onto its box.
The atlas is lossy WebP (quality 90) with lossless alpha: QA viewing only.
Output (QA only, never the game build): ../asset-source/v06_QA/<NPC>/atlas.webp + atlas.json
  atlas.json: {src, scale, frames, canvas, clips: {enter, settle, idle, turn, start, exit, pass: {offset, frames, art}},
               rects: [[sx,sy,sw,sh,dx,dy]...], sha256: [...], data: per frame {seg, i, art, feet, shadows, root_px},
               sequence: stand point / exit origin (render report), qa_status}
"""
import argparse, hashlib, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QA = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v06_QA')
MAX_W = 4096

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def import_npc(src, npc, scale):
    R = json.load(open(os.path.join(src, 'frames.json'))); problems = []
    files = [('seq', n) for n in range(len(R['frames']))] + [('pass', i) for i in range(len(R['pass']))]
    crops, hashes = [], []
    for d, n in files:
        p = os.path.join(src, d, f'{n:04d}.png')
        if not os.path.exists(p): problems.append(f'{d}/{n:04d}.png missing'); continue
        im = Image.open(p)
        if im.size != (720, 1280) or im.mode != 'RGBA': problems.append(f'{d}/{n:04d}.png {im.size} {im.mode}'); continue
        box = im.getchannel('A').getbbox()
        if box is None: problems.append(f'{d}/{n:04d}.png empty'); continue
        crops.append((im.crop(box), box)); hashes.append(sha(p))
    if problems: return {'npc': npc, 'ok': False, 'problems': problems}
    placed, x, y, row_h = [], 0, 0, 0
    for c, b in crops:
        c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS) if scale != 1 else c
        if x + c.width > MAX_W: x, y, row_h = 0, y + row_h, 0
        placed.append((c, b, x, y)); x += c.width; row_h = max(row_h, c.height)
    atlas = Image.new('RGBA', (MAX_W if y else x, y + row_h), (0, 0, 0, 0))
    for c, b, px, py in placed:
        atlas.paste(c, (px, py))
        if abs(b[0] + c.width / scale - b[2]) > 1 / scale or abs(b[1] + c.height / scale - b[3]) > 1 / scale: problems.append(f'rect {px},{py} does not map back onto {b}')
    if problems: return {'npc': npc, 'ok': False, 'problems': problems}
    out = os.path.join(QA, npc); os.makedirs(out, exist_ok=True)
    # Lossy colour, exact alpha: QA-only and rebuilt from the renders, so ~4x smaller than lossless (v05 atlases are lossless).
    atlas.save(os.path.join(out, 'atlas.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    clips = {k: {'offset': v['offset'], 'frames': v['frames'], 'art': v['art']} for k, v in R['segments'].items()}
    clips['pass'] = {'offset': len(R['frames']), 'frames': len(R['pass']), 'art': ['side']}
    # Pivot per frame for the overlay: centre between the feet on the floor (projected), like walk_clips.json feet.
    data = []
    for f in R['frames']:
        hx = [f['feet_px'][s][k][0] for s in 'LR' for k in ('heel', 'toe')]; hy = [f['feet_px'][s][k][1] for s in 'LR' for k in ('heel', 'toe')]
        data.append({'seg': f['seg'], 'i': f['i'], 'art': f['art'], 'heading': f['heading'], 'feet': [round(sum(hx) / 4, 1), round(max(hy), 1)], 'shadows': f['shadows'], 'root_px': f['root_px']})
    for p in R['pass']:
        data.append({'seg': 'pass', 'i': p['i'], 'art': 'side', 'heading': 90, 'feet': None, 'shadows': p['shadows'], 'root_px': None})
    meta = {'npc': npc, 'revision': 'v06', 'src': 'atlas.webp', 'scale': scale, 'frames': len(placed), 'canvas': [720, 1280], 'fps': 24, 'clips': clips,
            'rects': [[px, py, c.width, c.height, b[0], b[1]] for c, b, px, py in placed], 'sha256': hashes, 'data': data,
            'sequence': R['sequence'], 'rig': R['rig'], 'height_m': R['height_m'], 'fixes': R['fixes'],
            'qa_status': 'REVISE', 'note': 'QA 뷰어 전용. render_v06.js 출력에서 만든 아틀라스. 게임 빌드(dist)에 넣지 않는다.'}
    json.dump(meta, open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))
    return {'npc': npc, 'ok': True, 'frames': len(placed), 'atlas': list(atlas.size), 'bytes': os.path.getsize(os.path.join(out, 'atlas.webp'))}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--render', required=True); ap.add_argument('--npc', action='append'); ap.add_argument('--scale', type=float, default=.5)
    a = ap.parse_args(); names = a.npc or sorted(d for d in os.listdir(a.render) if d.startswith('NPC') and os.path.isdir(os.path.join(a.render, d)))
    report = [import_npc(os.path.join(a.render, n), n, a.scale) for n in names]
    for r in report: print(r['npc'], 'OK' if r['ok'] else 'STOPPED', r.get('frames', ''), r.get('atlas', ''), r.get('bytes', ''), '\n  '.join([''] + r.get('problems', [])[:12]))
    if not all(r['ok'] for r in report): sys.exit(1)

if __name__ == '__main__':
    main()
