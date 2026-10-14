#!/usr/bin/env python3
"""Frame-level walk QA of the imported v05 sprites (NPC02-NPC10), measured on the real alpha frames.

  python3 scripts/analyze-v05-frames.py [--npc NPC06] [--no-sheets]

Reads the originals in ../asset-source/v05_frames/<NPC>/sprites/{front,side,rear}/0000-0047.png (never rewritten) and the
same rig / camera the package renderer used (functions shared with scripts/build-walk-binding.py). For every frame:
  - silhouette (alpha >= 128): box, lowest row, height against the height the camera predicts for the root depth
  - head width (widest row in the top 13 % of the silhouette) against the same prediction
  - each foot: the rig says when it rests on the floor (heel or toe <= 5 mm). In a window around that foot the lowest
    opaque row is compared with the floor row the camera predicts (floating / sinking), and while the whole shoe is flat
    on the floor in two frames running, the shoe-region centroid must not move (slide, measured in the image)
  - left/right alternation from the order of heel strikes; the drawn shoe must touch the floor at those frames
  - contact shadow (engine ellipse from walk_clips.json): its centre must sit under the drawn shoe of a resting foot
  - enter end (front 47) against exit start (rear 0): image lowest row -> depth, height, root depth from the rig
Output: ../asset-source/v05_QA/frame_qa/frame_metrics_v05.json and contact sheets (JPEG) for visual review:
  <NPC>_sheet.jpg (3 views x 13 frames on BG02), <NPC>_feet.jpg (every frame, feet only, x2, floor rows marked),
  <NPC>_seam.jpg (enter end vs exit start), <NPC>_arm_side.jpg (side view upper body, every 2nd frame).
Numbers here are measurements, not a quality verdict; the verdict stays with the visual review (docs/animation_qa.md).
"""
import argparse, importlib.util, json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_frames')
OUT = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_QA', 'frame_qa')
spec = importlib.util.spec_from_file_location('binding', os.path.join(ROOT, 'scripts', 'build-walk-binding.py'))
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
F, HY, W, H = B.F, B.HY, B.W, B.H
VIEWS = ['front', 'side', 'rear']
PLANT = .005  # m, same threshold as the binding's rig slide check

def load_alpha(npc, view, i):
    im = Image.open(os.path.join(SRC, npc, 'sprites', view, f'{i:04d}.png'))
    return im, np.asarray(im.getchannel('A'))

def pose(rig, cfg, i):
    S = cfg['height_m'] / 1.725
    return S, {k: [c * S for c in v] for k, v in rig['frames'][i]['joints'].items()}

def depth(view, p): return B.world(view, p)[2]

def window(view, p, s, solid, q2):
    """Pixel window around foot s: heel..toe in x (plus half a shoe width), ankle..floor(+6 cm) in y.
    The expected lowest row is where the rig puts the sole: the lower of the projected heel and toe at their real
    heights (render.js draws the shoe with its bottom edge on the heel-toe line). A lifted toe nearer the camera can still
    be the lowest row in the front/rear views, so the floor row of the resting point alone is not the reference."""
    he, to, an = (B.project(view, p[s + k]) for k in ('heel', 'toe', 'ankle'))
    fl = {k: B.project(view, [p[s + k][0], 0, p[s + k][2]]) for k in ('heel', 'toe')}
    half = (.05 if view != 'side' else .02) * q2
    x0 = int(max(0, min(he[0], to[0]) - half)); x1 = int(min(W - 1, max(he[0], to[0]) + half))
    y0 = int(max(0, an[1] - .02 * q2)); y1 = int(min(H - 1, max(f[1] for f in fl.values()) + .06 * q2))
    return x0, y0, x1, y1, max(he[1], to[1])

def foot_metrics(view, p, s, solid, q2):
    x0, y0, x1, y1, floor_y = window(view, p, s, solid, q2)
    sub = solid[y0:y1 + 1, x0:x1 + 1]
    rows = np.where(sub.any(axis=1))[0]
    if not len(rows): return None
    low = y0 + rows[-1]
    band = solid[max(y0, low - 3):low + 1, x0:x1 + 1]; xs = np.where(band)[1]
    shoe_top = int(floor_y - .07 * q2)
    shoe = solid[max(0, shoe_top):min(H, int(floor_y + .02 * q2)) + 1, x0:x1 + 1]
    ys, xs2 = np.nonzero(shoe)
    cen = (float(x0 + xs2.mean()), float(max(0, shoe_top) + ys.mean())) if len(xs2) else None
    return {'low_y': int(low), 'contact_x': float(x0 + xs.mean()), 'floor_y': round(floor_y, 1), 'shoe_centroid': cen,
            'shoe_mask': shoe, 'win': [x0, y0, x1, y1]}

def analyse_view(npc, cfg, rig, view, walk_view):
    frames = []; slides = []; contact_err = []; heights = []; heads = []; shadow_err = []
    strikes = []; prev_down = {'L': None, 'R': None}; prev_flat = {}
    for i in range(48):
        im, a = load_alpha(npc, view, i); solid = a >= 128
        ys, xs = np.nonzero(solid); top, low, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
        S, p = pose(rig, cfg, i); root = rig['frames'][i]['root']; rootp = [c * S for c in root]
        z = depth(view, [rootp[0], 0, rootp[2]]); q2 = F / z
        h_pred = q2 * cfg['height_m']; heights.append((low - top) / h_pred)
        head_rows = solid[top:top + max(1, int(.13 * (low - top)))]
        head_w = max(int(r.sum()) for r in head_rows); heads.append(head_w / (q2 * S))
        fr = {'frame': i, 'box': [left, top, right, low], 'root_z': round(z, 3), 'height_ratio': round((low - top) / h_pred, 3),
              'head_width_px': head_w, 'feet': {}}
        for s in 'LR':
            he, to = p[s + 'heel'], p[s + 'toe']; down = min(he[1], to[1]) <= PLANT; flat = he[1] <= PLANT and to[1] <= PLANT
            m = foot_metrics(view, p, s, solid, q2)
            if prev_down[s] is False and down: strikes.append((i, s))  # a foot that was in the air touches down
            prev_down[s] = down
            if not m: fr['feet'][s] = {'down': down, 'visible': False}; continue
            err = m['low_y'] - m['floor_y']; d = {'down': down, 'flat': flat, 'low_y': m['low_y'], 'floor_y': m['floor_y'], 'sole_vs_rig_px': round(err, 1)}
            if down:
                contact_err.append(err)
                # Engine shadow ellipse of this foot: its centre must sit under the drawn shoe (inside the shoe's
                # x-range at its lowest rows, and between 7 cm above the lowest row and one ellipse radius below it).
                sx, sy, rx, ry, _ = walk_view['shadows'][i][0 if s == 'L' else 1]
                xs_band = np.where(solid[max(0, m['low_y'] - 6):m['low_y'] + 1, m['win'][0]:m['win'][2] + 1].any(axis=0))[0] + m['win'][0]
                shadow_err.append(bool(len(xs_band)) and xs_band.min() - 2 <= sx <= xs_band.max() + 2 and m['low_y'] - .07 * q2 <= sy <= m['low_y'] + ry + 2)
            if flat and s in prev_flat and m['shoe_centroid'] and prev_flat[s]['shoe_centroid']:
                (ax, ay), (bx, by) = prev_flat[s]['shoe_centroid'], m['shoe_centroid']
                px = math.hypot(bx - ax, by - ay); slides.append((px, px * z / F * 1000, i, s)); d['slide_px'] = round(px, 2)
            prev_flat = {k: v for k, v in prev_flat.items() if k != s}
            if flat: prev_flat[s] = m
            fr['feet'][s] = d
        frames.append(fr)
    order = [s for _, s in sorted(strikes)]
    alternates = all(order[k] != order[k + 1] for k in range(len(order) - 1))
    worst = max(slides, default=(0, 0, None, None))
    return {'frames': frames, 'summary': {
        'heel_strikes': [[i, s] for i, s in sorted(strikes)], 'alternates': alternates,
        'sole_vs_rig_px': {'mean': round(float(np.mean(contact_err)), 1), 'min': round(float(np.min(contact_err)), 1), 'max': round(float(np.max(contact_err)), 1)} if contact_err else None,
        'planted_shoe_slide': {'pairs': len(slides), 'max_px': round(worst[0], 2), 'max_mm': round(worst[1], 1), 'at': [worst[2], worst[3]],
                               'mean_px': round(float(np.mean([s[0] for s in slides])), 2) if slides else None},
        'height_ratio': {'mean': round(float(np.mean(heights)), 3), 'cv': round(float(np.std(heights) / np.mean(heights)), 3)},
        'head_width_ratio': {'mean': round(float(np.mean(heads)), 3), 'cv': round(float(np.std(heads) / np.mean(heads)), 3)},
        'shadow_under_shoe': {'frames': len(shadow_err), 'inside': int(sum(shadow_err))}}}

def seam(npc, cfg, rig, res):
    """Enter end (front 47) against exit start (rear 0), measured on the images and on the rig."""
    out = {}
    for key, view, i in (('enter_end', 'front', 47), ('exit_start', 'rear', 0)):
        f = res[view]['frames'][i]; low = f['box'][3]
        out[key] = {'view': view, 'frame': i, 'root_z_rig': f['root_z'], 'lowest_row_px': low,
                    'depth_from_lowest_row_m': round(F * 1.6 / (low - HY), 3), 'height_px': f['box'][3] - f['box'][1],
                    'center_x_px': round((f['box'][0] + f['box'][2]) / 2, 1)}
        S, p = pose(rig, cfg, i)
        out[key]['head_width_px'] = f['head_width_px']
        out[key]['feet_world_z_m'] = {s: round(depth(view, [p[s + 'heel'][0], 0, p[s + 'heel'][2]]), 3) for s in 'LR'}
        out[key]['feet_down'] = [s for s in 'LR' if f['feet'][s]['down']]
    a, b = out['enter_end'], out['exit_start']
    out['gap'] = {'root_z_m': round(a['root_z_rig'] - b['root_z_rig'], 3), 'lowest_row_px': b['lowest_row_px'] - a['lowest_row_px'],
                  'depth_from_lowest_row_m': round(a['depth_from_lowest_row_m'] - b['depth_from_lowest_row_m'], 3),
                  'height_px': b['height_px'] - a['height_px'], 'height_change': round(b['height_px'] / a['height_px'] - 1, 3),
                  'design_px_at_1080': (b['lowest_row_px'] - a['lowest_row_px']) * 1.5,
                  'body_scale_rig': round(a['root_z_rig'] / b['root_z_rig'] - 1, 3), 'head_width_change': round(b['head_width_px'] / a['head_width_px'] - 1, 3),
                  'facing': 'front (toward camera) -> rear (away): no turn frames in the package'}
    S = cfg['height_m'] / 1.725; travel = rig['frames'][47]['root'][0] * S - rig['frames'][0]['root'][0] * S
    out['cause'] = {'render_js_line_50': "front z = 2.92 - p[0]; rear z = 1.8 + p[0] (same constants for every NPC)",
                    'rig': cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json', 'speed_m_s': round(rig['speed_m_s'], 4),
                    'enter_travel_m': round(travel, 3), 'rear_start_needed_for_no_gap_m': round(2.92 - rig['frames'][47]['root'][0] * S, 3),
                    'constant_gap_if_travel_were_1_12m': round(2.92 - 1.12 - 1.8, 3)}
    return out

# ---- sheets ---------------------------------------------------------------------------------------------------------------
def font(n):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()

def bg02():
    return Image.open(os.path.join(ROOT, 'dist', 'assets', 'bg', 'BG02.webp')).convert('RGBA').resize((W, H))

def shadow_layer(walk_view, i):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for x, y, rx, ry, a in walk_view['shadows'][i]:
        for k in range(6, 0, -1):
            f = k / 6; d.ellipse([x - rx * f, y - ry * f, x + rx * f, y + ry * f], fill=(7, 11, 13, int(255 * a / 6)))
    return lay

def composite(npc, view, i, walk_view, base):
    im = Image.open(os.path.join(SRC, npc, 'sprites', view, f'{i:04d}.png'))
    c = base.copy(); c.alpha_composite(shadow_layer(walk_view, i)); c.alpha_composite(im); return c

def contact_sheet(npc, walk_npc, res, base):
    picks = list(range(0, 48, 4)) + [47]; rows = []
    fnt = font(15)
    for view in VIEWS:
        boxes = [f['box'] for f in res[view]['frames']]
        x0 = max(0, min(b[0] for b in boxes) - 30); x1 = min(W, max(b[2] for b in boxes) + 30)
        y0 = max(0, min(b[1] for b in boxes) - 20); y1 = min(H, max(b[3] for b in boxes) + 25)
        tiles = []
        for i in picks:
            c = composite(npc, view, i, walk_npc['views'][view], base).crop((x0, y0, x1, y1)) if view != 'side' else None
            if view == 'side':
                b = boxes[i]; cx = (b[0] + b[2]) // 2; w = 190
                c = composite(npc, view, i, walk_npc['views'][view], base).crop((cx - w // 2, y0, cx + w // 2, y1))
            d = ImageDraw.Draw(c); d.text((4, 2), f'{view} {i:02d}', fill=(255, 255, 0, 255), font=fnt)
            tiles.append(c)
        th = max(t.height for t in tiles); row = Image.new('RGBA', (sum(t.width for t in tiles), th), (0, 0, 0, 255)); x = 0
        for t in tiles: row.paste(t, (x, 0)); x += t.width
        rows.append(row)
    wmax = max(r.width for r in rows); sheet = Image.new('RGBA', (wmax, sum(r.height for r in rows)), (0, 0, 0, 255)); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    if sheet.width > 2400: sheet = sheet.resize((2400, round(sheet.height * 2400 / sheet.width)), Image.LANCZOS)
    sheet.convert('RGB').save(os.path.join(OUT, f'{npc}_sheet.jpg'), quality=86)

def feet_sheet(npc, cfg, rig, walk_npc, res, base):
    """Every frame, both shoes only (box from the higher ankle to 14 px under the lower sole, from the rig), x2 for the
    side view. Coloured rows: where the rig puts the sole of a resting foot (blue = left, orange = right)."""
    fnt = font(12); rows = []
    for view in VIEWS:
        tiles = []
        for i in range(48):
            fr = res[view]['frames'][i]; S, p = pose(rig, cfg, i)
            pts = [B.project(view, p[s + k]) for s in 'LR' for k in ('heel', 'toe', 'ankle')]
            x0 = int(min(q[0] for q in pts) - 24); x1 = int(max(q[0] for q in pts) + 24)
            y0 = int(min(q[1] for q in pts) - 16); y1 = int(max(q[1] for q in pts) + 14)
            c = composite(npc, view, i, walk_npc['views'][view], base).crop((x0, y0, x1, y1)); d = ImageDraw.Draw(c)
            for s, col in (('L', (90, 200, 255, 255)), ('R', (255, 170, 80, 255))):
                f = fr['feet'][s]
                if f.get('down') and 'floor_y' in f:
                    y = f['floor_y'] - y0; d.line([(0, y), (c.width, y)], fill=col, width=1)
            d.text((2, 1), f'{i:02d}', fill=(255, 255, 0, 255), font=fnt)
            k = 2 if view == 'side' else 1
            tiles.append(c.resize((c.width * k, c.height * k), Image.NEAREST))
        per = 12
        for k in range(0, 48, per):
            part = tiles[k:k + per]; row = Image.new('RGBA', (sum(t.width for t in part), max(t.height for t in part)), (0, 0, 0, 255)); x = 0
            for t in part: row.paste(t, (x, row.height - t.height)); x += t.width
            rows.append(row)
    sheet = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), (0, 0, 0, 255)); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    if sheet.width > 2400: sheet = sheet.resize((2400, round(sheet.height * 2400 / sheet.width)), Image.LANCZOS)
    sheet.convert('RGB').save(os.path.join(OUT, f'{npc}_feet.jpg'), quality=86)

def seam_sheet(npc, walk_npc, base, info):
    a = composite(npc, 'front', 47, walk_npc['views']['front'], base); b = composite(npc, 'rear', 0, walk_npc['views']['rear'], base)
    onion = base.copy()
    for view, i, tint in (('front', 47, (80, 200, 255)), ('rear', 0, (255, 120, 80))):
        im = Image.open(os.path.join(SRC, npc, 'sprites', view, f'{i:04d}.png')); al = im.getchannel('A').point(lambda v: v * 6 // 10)
        onion.alpha_composite(Image.merge('RGBA', [Image.new('L', im.size, c) for c in tint] + [al]))
    box = (150, 380, 570, 1180); tiles = [x.crop(box) for x in (a, b, onion)]
    sheet = Image.new('RGBA', (sum(t.width for t in tiles), tiles[0].height + 60), (0, 0, 0, 255)); d = ImageDraw.Draw(sheet); fnt = font(16)
    for k, t in enumerate(tiles): sheet.paste(t, (k * t.width, 60))
    g = info['gap']
    d.text((6, 4), f"{npc}  enter end (front 47) | exit start (rear 0) | overlay (blue=enter, orange=exit)", fill=(255, 255, 0, 255), font=fnt)
    d.text((6, 26), f"root z {info['enter_end']['root_z_rig']} -> {info['exit_start']['root_z_rig']} m (gap {g['root_z_m']} m), lowest row {info['enter_end']['lowest_row_px']} -> {info['exit_start']['lowest_row_px']} px, height {info['enter_end']['height_px']} -> {info['exit_start']['height_px']} px", fill=(255, 255, 255, 255), font=fnt)
    for k in range(3):
        for key, col in (('enter_end', (80, 200, 255, 255)), ('exit_start', (255, 120, 80, 255))):
            y = info[key]['lowest_row_px'] - box[1] + 60; d.line([(k * tiles[0].width, y), ((k + 1) * tiles[0].width - 1, y)], fill=col, width=1)
    sheet.convert('RGB').save(os.path.join(OUT, f'{npc}_seam.jpg'), quality=88)

def arm_sheet(npc, walk_npc, res, base):
    """Side view, upper body, every 2nd frame, x1.5 — the carrying arm and the far arm."""
    tiles = []; fnt = font(13)
    for i in range(0, 48, 2):
        b = res['side']['frames'][i]['box']; cx = (b[0] + b[2]) // 2; top = b[1]; h = int((b[3] - b[1]) * .62)
        c = composite(npc, 'side', i, walk_npc['views']['side'], base).crop((cx - 85, top - 8, cx + 85, top + h))
        ImageDraw.Draw(c).text((3, 2), f'{i:02d}', fill=(255, 255, 0, 255), font=fnt)
        tiles.append(c.resize((int(c.width * 1.5), int(c.height * 1.5)), Image.LANCZOS))
    per = 12; rows = []
    for k in range(0, len(tiles), per):
        part = tiles[k:k + per]; row = Image.new('RGBA', (sum(t.width for t in part), max(t.height for t in part)), (0, 0, 0, 255)); x = 0
        for t in part: row.paste(t, (x, 0)); x += t.width
        rows.append(row)
    sheet = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), (0, 0, 0, 255)); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    sheet.convert('RGB').save(os.path.join(OUT, f'{npc}_arm_side.jpg'), quality=86)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--npc', action='append'); ap.add_argument('--no-sheets', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    walk = json.load(open(os.path.join(ROOT, 'dist', 'data', 'walk_clips.json')))
    path = os.path.join(OUT, 'frame_metrics_v05.json')
    report = json.load(open(path)) if os.path.exists(path) and a.npc else {'note': 'measurements on the original alpha frames; not a quality verdict', 'npcs': {}}
    base = None if a.no_sheets else bg02()
    for npc in a.npc or ['NPC%02d' % n for n in range(2, 11)]:
        cfg = json.load(open(os.path.join(SRC, npc, 'config.json'))); rig = json.load(open(os.path.join(SRC, npc, cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json')))
        res = {view: analyse_view(npc, cfg, rig, view, walk['npcs'][npc]['views'][view]) for view in VIEWS}
        info = seam(npc, cfg, rig, res)
        report['npcs'][npc] = {'rig': cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json', 'height_m': cfg['height_m'], 'prop': cfg.get('prop'),
                               'views': {v: res[v]['summary'] for v in VIEWS}, 'seam': info,
                               'per_frame': {v: [{k: f[k] for k in ('frame', 'box', 'root_z', 'height_ratio', 'head_width_px', 'feet')} for f in res[v]['frames']] for v in VIEWS}}
        if not a.no_sheets:
            contact_sheet(npc, walk['npcs'][npc], res, base); feet_sheet(npc, cfg, rig, walk['npcs'][npc], res, base)
            seam_sheet(npc, walk['npcs'][npc], base, info)
            arm_sheet(npc, walk['npcs'][npc], res, base)
        s = report['npcs'][npc]['views']
        print(npc, 'seam', info['gap'], '\n  ' + '\n  '.join(f"{v}: alt={s[v]['alternates']} strikes={len(s[v]['heel_strikes'])} floor_err={s[v]['sole_vs_rig_px']} slide={s[v]['planted_shoe_slide']} h={s[v]['height_ratio']} head={s[v]['head_width_ratio']} shadow_in={s[v]['shadow_under_shoe']}" for v in VIEWS))
    json.dump(report, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('wrote', path, os.path.getsize(path))

if __name__ == '__main__':
    main()
