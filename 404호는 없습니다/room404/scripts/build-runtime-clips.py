"""Runtime clip pages for the game (v0.19.0). Run from the project folder (the one holding room404/ and asset-source/).

  python3 -B -I room404/scripts/build-runtime-clips.py --side-render <dir>

1. NPC06 v10r5 (asset-source/v10r5_NPC06): the 215 sequence frames (enter 48, settle 16, idle 48, turn 40, start 15,
   exit 48 as frames.json segments says) become WebP pages in room404/dist/assets/clips/NPC06_v10r5/ plus clip.json.
   Every source PNG is checked against QA/verification_v10r5.json (bytes + SHA-256) before use; frames.json segment
   offsets must cover 0..214 with no gap. Frames are trimmed to their alpha box only: each rect keeps the box's place
   on the fixed 720x1280 canvas (dx, dy), so the game draws every frame with the background's transform and never
   re-centres it. Alpha is stored losslessly (alpha_quality 100), colour as WebP q92. Pages are at most 2048x2048
   (mobile texture limit) and hold one load group each: arrive (enter+settle), stay (idle+turn), leave (start+exit).
2. Side walks for the CCTV replay: 48-frame side passes, scale 0.7. NPC06 from v10r5 pass/ (byte-identical to v06),
   the others from a fresh `render_v06.js <NPC> <dir>/<NPC> --only=pass` run (--side-render) whose PNGs must be
   byte-identical to the v06 frames the review passed (asset-source/v06_QA/<NPC>/atlas.json sha256, side PASS).
   Only NPCs listed in SIDE_NPCS are built (the ones a visitor scene actually needs: data/visitor_figures.json).
The source PNGs, ZIPs, QA sheets and videos stay in asset-source/ and never go into dist/.
"""
import argparse, hashlib, io, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.getcwd()
V10 = os.path.join(ROOT, 'asset-source', 'v10r5_NPC06')
OUT = os.path.join(ROOT, 'room404', 'dist', 'assets', 'clips')
PAGE = 2048; PAD = 2
SIDE_NPCS = ['NPC06', 'NPC07', 'NPC09']
SIDE_SCALE = 0.7
WEBP = dict(quality=92, alpha_quality=100, method=6, exact=True)
SEGMENTS = {'enter': 48, 'settle': 16, 'idle': 48, 'turn': 40, 'start': 15, 'exit': 48}
GROUPS = {'arrive': ['enter', 'settle'], 'stay': ['idle', 'turn'], 'leave': ['start', 'exit']}

def sha(b): return hashlib.sha256(b).hexdigest()
def fsha(p): return sha(open(p, 'rb').read())
def fail(msg): sys.exit('build-runtime-clips: ' + msg)

def trim(im):
    a = np.asarray(im.getchannel('A')); ys, xs = np.nonzero(a)
    if not len(xs): fail('empty frame')
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return im.crop(box), box

def pack(items, prefix, outdir, scale=1.0):
    """Shelf-pack (image, box) in order onto pages of at most PAGE x PAGE. Returns pages and per-item [page,sx,sy,sw,sh,dx,dy]."""
    pages, rects, x, y, row, cur = [], [], 0, 0, 0, []
    def flush():
        if not cur: return
        w = max(px + c.width for c, px, py in cur); h = max(py + c.height for c, px, py in cur)
        page = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for c, px, py in cur: page.paste(c, (px, py))
        b = io.BytesIO(); page.save(b, 'WEBP', **WEBP); data = b.getvalue()
        back = Image.open(io.BytesIO(data)).convert('RGBA')
        if not np.array_equal(np.asarray(back.getchannel('A')), np.asarray(page.getchannel('A'))): fail('alpha changed in ' + prefix)
        # Round trip per frame: alpha identical; colour error weighted by alpha (what is actually seen), worst frame kept.
        errs = []
        for c, px, py in cur:
            s0 = np.asarray(c).astype(float); s1 = np.asarray(back.crop((px, py, px + c.width, py + c.height))).astype(float); al = s0[..., 3:] / 255
            errs.append(float((np.abs(s1[..., :3] - s0[..., :3]) * al).sum() / max(1e-9, al.sum() * 3)))
        name = f'{prefix}-{len(pages)}.webp'; open(os.path.join(outdir, name), 'wb').write(data)
        pages.append({'file': name, 'size': [w, h], 'bytes': len(data), 'sha256': sha(data), 'frames': len(cur), 'alpha_identical': True, 'rgb_error_alpha_weighted_max': round(max(errs), 3)})
    for im, box in items:
        c = im if scale == 1 else im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        if c.width > PAGE or c.height > PAGE: fail('frame larger than a page')
        if x + c.width > PAGE: x, y, row = 0, y + row + PAD, 0
        if y + c.height > PAGE: flush(); cur.clear(); x, y, row = 0, 0, 0
        cur.append((c, x, y)); rects.append([len(pages), x, y, c.width, c.height, box[0], box[1]]); x += c.width + PAD; row = max(row, c.height)
    flush()
    return pages, rects

def npc06():
    man = json.load(open(os.path.join(V10, 'NPC06_v10r5_manifest.json'), 'rb'))
    ver_path = os.path.join(V10, 'QA', 'verification_v10r5.json'); ver = json.load(open(ver_path, 'rb'))
    fj_path = os.path.join(V10, 'frames', 'frames.json'); fj = json.load(open(fj_path, 'rb'))
    if fj.get('art') != 'v10r5' or fj.get('npc') != 'NPC06': fail('frames.json is not NPC06 v10r5')
    seg = fj['segments']; off = 0
    for k, n in SEGMENTS.items():
        if seg[k]['offset'] != off or seg[k]['frames'] != n: fail(f'segment {k} {seg[k]} expected offset {off} frames {n}')
        off += n
    if len(fj['frames']) != off or len(fj['pass']) != 48: fail('frame count')
    # The renderer numbers enter/exit from 0 and settle/idle/turn/start from 1 (same as v06); either way contiguous.
    for i, f in enumerate(fj['frames']):
        s = next(k for k, v in seg.items() if v['offset'] <= i < v['offset'] + v['frames'])
        first = fj['frames'][seg[s]['offset']]['i']
        if f['n'] != i or f['seg'] != s or first not in (0, 1) or f['i'] != first + i - seg[s]['offset']: fail(f'frames.json order at {i}')
    want = {f['path']: f for f in ver['frames']}
    def load(rel):
        p = os.path.join(V10, 'frames', rel); b = open(p, 'rb').read(); w = want.get(rel)
        if not w or w['size'] != len(b) or w['sha256'] != sha(b): fail('hash mismatch ' + rel)
        im = Image.open(io.BytesIO(b)); im.load()
        if im.size != (720, 1280) or im.mode != 'RGBA': fail('canvas ' + rel)
        return im, w['sha256']
    seq = [load(f'seq/{i:04d}.png') for i in range(off)]
    # Where the turn may begin: the idle loop frames whose picture is as close to turn frame 0 as the authored
    # hand-over (idle 47 -> turn 0) is. Measured on the pixels, recorded with the numbers.
    T = np.asarray(seq[seg['turn']['offset']][0]).astype(int)
    def dist(n):
        A = np.asarray(seq[n][0]).astype(int); m = (A[..., 3] > 0) | (T[..., 3] > 0); return round(float(np.abs(A - T)[m].mean()), 3)
    io0 = seg['idle']['offset']; d = [dist(io0 + k) for k in range(48)]; limit = d[47]
    entries = [k for k in range(48) if d[k] <= limit + 1e-9]
    outdir = os.path.join(OUT, 'NPC06_v10r5'); os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.webp'): os.remove(os.path.join(outdir, f))
    pages, rects = [], [None] * off
    for g, names in GROUPS.items():
        idx = [i for n in names for i in range(seg[n]['offset'], seg[n]['offset'] + seg[n]['frames'])]
        items = [trim(seq[i][0]) for i in idx]
        pp, rr = pack(items, g, outdir)
        base = len(pages)
        for p in pp: p['group'] = g; pages.append(p)
        for i, r in zip(idx, rr): rects[i] = [r[0] + base] + r[1:]
    shadows = [[[round(v, 2) for v in s] for s in f['shadows']] for f in fj['frames']]
    clip = {
        'npc': 'NPC06', 'revision': 'v10r5', 'visual_status': 'REVISE',
        'note': '게임 재생용 아틀라스. 시각 판정은 REVISE 그대로이며, 사용자 예외 승인(2026-10-17)으로만 게임에 쓴다. 원본 프레임은 asset-source/v10r5_NPC06/frames.',
        'canvas': [720, 1280], 'design_scale': 1.5, 'background': 'BG02', 'fps': 24,
        'fps_basis': 'v10r5 패키지 frames.json에는 재생 속도 항목이 없다. 비교 영상 NPC06_v10r5_BG02_comparison.mp4가 24fps이고 v06 렌더러 기본값(walk_clips.json NPC06 v06.fps)도 24라 24fps로 둔다(잠정 근거).',
        'source': {
            'manifest': 'asset-source/v10r5_NPC06/NPC06_v10r5_manifest.json', 'manifest_sha256': fsha(os.path.join(V10, 'NPC06_v10r5_manifest.json')),
            'frames_json_sha256': fsha(fj_path), 'verification_sha256': fsha(ver_path),
            'frames_zips': [{k: f[k] for k in ('file', 'bytes', 'sha256')} for f in man['files'] if 'frames' in f['file']],
            'frames_checked': f'{off} seq PNG: bytes and SHA-256 equal to QA/verification_v10r5.json',
        },
        'segments': {k: {'offset': seg[k]['offset'], 'frames': seg[k]['frames'], 'art': seg[k]['art']} for k in SEGMENTS},
        'groups': GROUPS,
        'loop': ['idle'],
        'turn_entries': entries,
        'turn_entry_check': {'method': 'mean |RGBA| difference to turn frame 0 over pixels covered in either frame', 'idle_to_turn0': d, 'limit_idle47': limit},
        'sequence': fj['sequence'],
        'encoding': {'format': 'webp', **{k: v for k, v in WEBP.items()}, 'alpha': 'lossless (round trip checked)', 'page_max': PAGE},
        'pages': pages,
        'frames': rects,
        'shadows': shadows,
        'src_sha256': [h for _, h in seq],
    }
    json.dump(clip, open(os.path.join(outdir, 'clip.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    return clip, [load(f'pass/{i:04d}.png') for i in range(48)], fj

def side(passes06, fj06, render_dir):
    c = fj06['camera']; cam = {'width': c['W'], 'height': c['H'], 'focal_px': c['F'], 'horizon_y': c['HY'], 'camera_height_m': c['CH']}; outdir = os.path.join(OUT, 'side'); os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.webp'): os.remove(os.path.join(outdir, f))
    doc = {'note': 'CCTV 재현용 측면 걷기(48프레임 = 걸음 한 주기). v06 검수 side PASS 프레임과 바이트가 같은 원본만 쓴다. 화면 왼쪽으로 걷는 그림 그대로 쓰고 좌우 반전하지 않는다.',
           'canvas': [720, 1280], 'scale': SIDE_SCALE, 'fps': 24, 'camera': cam, 'npcs': {}}
    for npc in SIDE_NPCS:
        atlas = json.load(open(os.path.join(ROOT, 'asset-source', 'v06_QA', npc, 'atlas.json'), 'rb')); o = atlas['clips']['pass']['offset']
        if npc == 'NPC06':
            ims = passes06; data = fj06['pass']; height = fj06['height_m']; src = 'asset-source/v10r5_NPC06/frames/pass (v10r5, byte-identical to v06)'
        else:
            d = os.path.join(render_dir, npc); fr = json.load(open(os.path.join(d, 'frames.json'), 'rb')); data = fr['pass']; height = fr['height_m']; ims = []
            for i in range(48):
                b = open(os.path.join(d, 'pass', f'{i:04d}.png'), 'rb').read(); im = Image.open(io.BytesIO(b)); im.load(); ims.append((im, sha(b)))
            src = f'render_v06.js {npc} --only=pass (asset-source/v06_render), byte-identical to the reviewed v06 frames'
        hashes = [h for _, h in ims]
        if hashes != atlas['sha256'][o:o + 48]: fail(npc + ' side frames differ from the reviewed v06 frames')
        items = [trim(im) for im, _ in ims]
        pages, rects = pack(items, npc, outdir, SIDE_SCALE)
        root = [round(f['root_px'][0], 2) for f in data]; step = round((root[-1] - root[0]) / 47, 4)
        if any(abs((root[i + 1] - root[i]) - step) > .05 for i in range(47)): fail(npc + ' root speed not constant')
        z = data[0]['root_world'][2]; ground = round(cam['horizon_y'] + cam['focal_px'] * cam['camera_height_m'] / z, 2)
        doc['npcs'][npc] = {'source': src, 'review': 'v06 side PASS (asset-source/v06_QA/review_summary_v06.json)', 'height_m': height, 'z_m': z,
                            'ground_y': ground, 'figure_px': round(height * cam['focal_px'] / z, 2), 'root_x': root, 'step_px': step, 'direction': 'screen-left',
                            'pages': pages, 'frames': rects, 'shadows': [[[round(v, 2) for v in s] for s in f['shadows']] for f in data], 'src_sha256': hashes}
    json.dump(doc, open(os.path.join(outdir, 'side.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    return doc

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--side-render', required=True, help='dir with <NPC>/pass and <NPC>/frames.json from render_v06.js --only=pass')
    a = ap.parse_args()
    clip, passes, fj = npc06(); s = side(passes, fj, a.side_render)
    print('NPC06 v10r5 pages', [(p['file'], p['size'], p['bytes']) for p in clip['pages']], 'turn entries', clip['turn_entries'])
    print('side', {k: [(p['file'], p['size'], p['bytes']) for p in v['pages']] for k, v in s['npcs'].items()})
