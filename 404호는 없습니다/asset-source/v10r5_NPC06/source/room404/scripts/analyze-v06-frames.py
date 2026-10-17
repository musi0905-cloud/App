#!/usr/bin/env python3
"""Frame-level QA of the v06 walk renders (asset-source/v06_render/render_v06.js), measured on the real alpha frames.

  python3 scripts/analyze-v06-frames.py --render <out root> [--npc NPC06] [--ffmpeg <path>] [--no-sheets]

<out root>/<NPC>/ holds what render_v06.js wrote: seq/NNNN.png (enter -> settle -> idle -> turn -> start -> exit),
pass/NNNN.png (side view) and frames.json (segments, world joints, projected feet, engine shadows, knee angles).
Measured (numbers, not a verdict; the verdict is the visual review in docs/animation_qa.md):
  per frame   silhouette box (alpha >= 128), lowest row, head width (widest row of the top 13 %), head centre x
  per view    same checks as v0.17 (analyze-v05-frames.py): sole row against the rig's sole row for every resting foot,
              planted-shoe slide in the image, height and head-width ratio spread, shadow centre under the drawn shoe
  knee band   alpha on the leg axis at the projected knee (v05 faded both part ends, so the floor showed through)
  seams       every segment boundary and every art switch inside the turn: root, head (rig and image), head width,
              lowest row, box height, and how far each foot that stays on the floor moves in the world (must be 0)
  slide       every pair of frames in the synthesised segments: world movement of a resting contact point
Output: ../asset-source/v06_QA/<NPC>/metrics_v06.json, sheets (sequence, seams, turn, feet, before/after) and
compare_v05_v06.mp4 (24 fps and 8 fps) when an ffmpeg binary is given. v05 frames for the comparison come from
../asset-source/v05_frames (the delivered originals).
"""
import argparse, json, math, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(ROOT)
QA = os.path.join(PROJECT, 'asset-source', 'v06_QA')
V05 = os.path.join(PROJECT, 'asset-source', 'v05_frames')
W, H = 720, 1280
PLANT = .005

def font(n):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()

def bg02():
    return Image.open(os.path.join(ROOT, 'dist', 'assets', 'bg', 'BG02.webp')).convert('RGBA').resize((W, H))

def shadow_layer(sh):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for x, y, rx, ry, a in sh:
        for k in range(6, 0, -1):
            f = k / 6; d.ellipse([x - rx * f, y - ry * f, x + rx * f, y + ry * f], fill=(7, 11, 13, int(255 * a / 6)))
    return lay

def silhouette(im):
    a = np.asarray(im.getchannel('A')); solid = a >= 128; ys, xs = np.nonzero(solid)
    top, low, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    head = solid[top:top + max(1, int(.13 * (low - top)))]; hw = max(int(r.sum()) for r in head)
    hx = np.nonzero(solid[top:top + max(1, int(.08 * (low - top)))])[1]
    return a, solid, {'box': [left, top, right, low], 'head_width_px': hw, 'head_center_x': round(float(hx.mean()), 1), 'area': int(solid.sum())}

def project(q, F=1100 * 720 / 1080, HY=675 * 720 / 1080, CH=1.6):
    x, y, z = q; return [W / 2 + F * x / z, HY + F * (CH - y) / z, F / z]

def contact(f, s):
    """Resting contact point of foot s in world coordinates (toe if the toe rests, else heel), or None in the air."""
    ft = f['feet_world'][s]; he, to = ft['heel'], ft['toe']
    if to[1] <= PLANT: return to
    if he[1] <= PLANT: return he
    return None

def foot_window(f, s, solid, q2, view):
    he, to = (f['feet_px'][s][k] for k in ('heel', 'toe')); an = project(f['feet_world'][s]['ankle'])
    half = (.05 if view != 'side' else .02) * q2
    x0 = int(max(0, min(he[0], to[0]) - half)); x1 = int(min(W - 1, max(he[0], to[0]) + half))
    fl = [project([f['feet_world'][s][k][0], 0, f['feet_world'][s][k][2]])[1] for k in ('heel', 'toe')]
    y0 = int(max(0, an[1] - .02 * q2)); y1 = int(min(H - 1, max(fl) + .06 * q2))
    sub = solid[y0:y1 + 1, x0:x1 + 1]; rows = np.where(sub.any(axis=1))[0]
    if not len(rows): return None
    low = y0 + int(rows[-1]); floor_y = max(he[1], to[1]); shoe_top = int(floor_y - .07 * q2)
    shoe = solid[max(0, shoe_top):min(H, int(floor_y + .02 * q2)) + 1, x0:x1 + 1]; ys, xs = np.nonzero(shoe)
    cen = (float(x0 + xs.mean()), float(max(0, shoe_top) + ys.mean())) if len(xs) else None
    band = np.where(solid[max(0, low - 6):low + 1, x0:x1 + 1].any(axis=0))[0] + x0
    return {'low_y': low, 'floor_y': round(floor_y, 1), 'centroid': cen, 'x_range': [int(band.min()), int(band.max())] if len(band) else None}

def knee_axis_alpha(a, hip, knee, ankle):
    """Lowest alpha on the leg axis from 4 % of the thigh above the knee to 4 % of the shin below it (v05 faded the
    thigh end and the shin start there, so the floor showed through as a band)."""
    vals = []
    for p0, p1 in ((knee, hip), (knee, ankle)):
        for t in np.linspace(0, .04, 6):
            x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < W and 0 <= yi < H: vals.append(int(a[yi, xi]))
    return min(vals) if vals else None

def per_view(frames, imgs, view, S):
    out = {'sole_vs_rig_px': [], 'slide_px': [], 'heights': [], 'heads': [], 'shadow_in': 0, 'shadow_n': 0}; prev = {}; was_down = {}; strikes = []
    for f, (a, solid, sil) in zip(frames, imgs):
        root = f['root_world']; z = root[2] if view != 'side' else root[2]; q2 = (1100 * 720 / 1080) / z
        out['heights'].append((sil['box'][3] - sil['box'][1]) / (q2 * S * 1.725)); out['heads'].append(sil['head_width_px'] / (q2 * S))
        for s in 'LR':
            ft = f['feet_world'][s]; down = min(ft['heel'][1], ft['toe'][1]) <= PLANT; flat = ft['heel'][1] <= PLANT and ft['toe'][1] <= PLANT
            if was_down.get(s) is False and down: strikes.append((f['i'], s))
            was_down[s] = down
            if not down: prev.pop(s, None); continue
            m = foot_window(f, s, solid, q2, view)
            if not m: continue
            out['sole_vs_rig_px'].append(m['low_y'] - m['floor_y'])
            sx, sy, rx, ry, _ = f['shadows'][0 if s == 'L' else 1]; out['shadow_n'] += 1
            if m['x_range'] and m['x_range'][0] - 2 <= sx <= m['x_range'][1] + 2 and m['low_y'] - .07 * q2 <= sy <= m['low_y'] + ry + 2: out['shadow_in'] += 1
            if flat and s in prev and prev[s] and m['centroid']:
                (ax, ay), (bx, by) = prev[s], m['centroid']; out['slide_px'].append(math.hypot(bx - ax, by - ay))
            prev[s] = m['centroid'] if flat else None
    st = lambda v: {'mean': round(float(np.mean(v)), 2), 'min': round(float(np.min(v)), 2), 'max': round(float(np.max(v)), 2)} if v else None
    order = [s for _, s in sorted(strikes)]
    return {'frames': len(frames), 'heel_strikes': [[i, s] for i, s in sorted(strikes)], 'alternates': all(order[k] != order[k + 1] for k in range(len(order) - 1)),
            'sole_vs_rig_px': st(out['sole_vs_rig_px']), 'planted_shoe_slide_px': st(out['slide_px']),
            'height_ratio': {'mean': round(float(np.mean(out['heights'])), 3), 'cv': round(float(np.std(out['heights']) / np.mean(out['heights'])), 3)},
            'head_width_ratio': {'mean': round(float(np.mean(out['heads'])), 3), 'cv': round(float(np.std(out['heads']) / np.mean(out['heads'])), 3)},
            'shadow_under_shoe': {'frames': out['shadow_n'], 'inside': out['shadow_in']}}

def seams(fr, sils):
    """Every segment boundary and every art switch: what changes between frame n-1 and frame n."""
    rows = []
    for n in range(1, len(fr)):
        a, b = fr[n - 1], fr[n]
        if a['seg'] == b['seg'] and a['art'] == b['art']: continue
        sa, sb = sils[n - 1], sils[n]; moved = {}
        for s in 'LR':
            for k in ('heel', 'toe'):
                pa, pb = a['feet_world'][s][k], b['feet_world'][s][k]
                if pa[1] <= PLANT and pb[1] <= PLANT: moved[s + k] = round(math.dist([pa[0], pa[2]], [pb[0], pb[2]]) * 1000, 2)
        rows.append({'at': n, 'from': f"{a['seg']} {a['i']} ({a['art']})", 'to': f"{b['seg']} {b['i']} ({b['art']})",
                     'root_px': round(math.dist(a['root_px'], b['root_px']), 2), 'head_rig_px': round(math.dist(a['head_px'], b['head_px']), 2),
                     'head_center_x_px': round(sb['head_center_x'] - sa['head_center_x'], 1), 'head_top_px': sb['box'][1] - sa['box'][1],
                     'head_width_change': round(sb['head_width_px'] / sa['head_width_px'] - 1, 3), 'lowest_row_px': sb['box'][3] - sa['box'][3],
                     'box_height_change': round((sb['box'][3] - sb['box'][1]) / (sa['box'][3] - sa['box'][1]) - 1, 3),
                     'resting_feet_moved_mm': moved, 'root_world_m': round(math.dist(a['root_world'], b['root_world']), 4)})
    return rows

def walk_steps(fr, sils, seg):
    """Typical frame-to-frame change inside a walk segment, the scale the seam numbers are read against."""
    idx = [n for n, f in enumerate(fr) if f['seg'] == seg]
    d = lambda k: [math.dist(fr[n - 1][k], fr[n][k]) for n in idx[1:]]
    hc = [abs(sils[n]['head_center_x'] - sils[n - 1]['head_center_x']) for n in idx[1:]]
    hw = [abs(sils[n]['head_width_px'] / sils[n - 1]['head_width_px'] - 1) for n in idx[1:]]
    low = [abs(sils[n]['box'][3] - sils[n - 1]['box'][3]) for n in idx[1:]]
    q = lambda v: {'median': round(float(np.median(v)), 3), 'max': round(float(np.max(v)), 3)}
    return {'root_px': q(d('root_px')), 'head_rig_px': q(d('head_px')), 'head_center_x_px': q(hc), 'head_width_change': q(hw), 'lowest_row_px': q(low)}

def slides(fr):
    """World movement of each resting point (heel with heel, toe with toe, both <= 5 mm high in both frames) between
    consecutive frames of the synthesised segments and across their boundaries (the walk segments are rig data)."""
    out = {}
    for n in range(1, len(fr)):
        a, b = fr[n - 1], fr[n]
        if b['seg'] in ('enter', 'exit') and a['seg'] == b['seg']: continue
        key = b['seg'] if a['seg'] == b['seg'] else f"{a['seg']}->{b['seg']}"; out.setdefault(key, (0.0, None, None))
        for s in 'LR':
            for k in ('heel', 'toe'):
                pa, pb = a['feet_world'][s][k], b['feet_world'][s][k]
                if pa[1] <= PLANT and pb[1] <= PLANT:
                    d = math.dist([pa[0], pa[2]], [pb[0], pb[2]]) * 1000
                    if d > out[key][0]: out[key] = (round(d, 2), n, s + k)
    return {k: {'max_mm': v[0], 'at': v[1], 'point': v[2]} for k, v in out.items()}

def knee_band_v06(fr, imgs, segs):
    vals = [knee_axis_alpha(imgs[n][0], *(fr[n]['legs_px'][s][k] for k in ('hip', 'knee', 'ankle'))) for n, f in enumerate(fr) if f['seg'] in segs for s in 'LR']
    vals = [v for v in vals if v is not None]
    return {'legs': len(vals), 'min_alpha': min(vals), 'below_250': sum(v < 250 for v in vals)}

def knee_band_v05(npc):
    """Same check on the delivered v05 frames, knees projected with the v05 paths (scripts/build-walk-binding.py)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('binding', os.path.join(ROOT, 'scripts', 'build-walk-binding.py')); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
    cfg = json.load(open(os.path.join(V05, npc, 'config.json'))); rig = json.load(open(os.path.join(V05, npc, cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json'))); S = cfg['height_m'] / 1.725
    out = {}
    for view in ('front', 'rear'):
        vals = []
        for i in range(48):
            a = np.asarray(Image.open(os.path.join(V05, npc, 'sprites', view, f'{i:04d}.png')).getchannel('A')); p = {k: [c * S for c in v] for k, v in rig['frames'][i]['joints'].items()}
            for s in 'LR':
                v = knee_axis_alpha(a, *(B.project(view, p[s + k]) for k in ('hip', 'knee', 'ankle')))
                if v is not None: vals.append(v)
        out[view] = {'legs': len(vals), 'min_alpha': min(vals), 'below_250': sum(v < 250 for v in vals)}
    return out

def crop_union(boxes, pad=(30, 20, 30, 25)):
    return (max(0, min(b[0] for b in boxes) - pad[0]), max(0, min(b[1] for b in boxes) - pad[1]), min(W, max(b[2] for b in boxes) + pad[2]), min(H, max(b[3] for b in boxes) + pad[3]))

def comp(base, im, sh):
    c = base.copy(); c.alpha_composite(shadow_layer(sh)); c.alpha_composite(im); return c

def grid(tiles, per, bg=(0, 0, 0, 255)):
    rows = []
    for k in range(0, len(tiles), per):
        part = tiles[k:k + per]; row = Image.new('RGBA', (sum(t.width for t in part), max(t.height for t in part)), bg); x = 0
        for t in part: row.paste(t, (x, 0)); x += t.width
        rows.append(row)
    sheet = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), bg); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    if sheet.width > 1800: sheet = sheet.resize((1800, round(sheet.height * 1800 / sheet.width)), Image.LANCZOS)
    return sheet

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--render', required=True); ap.add_argument('--npc', action='append'); ap.add_argument('--ffmpeg'); ap.add_argument('--no-sheets', action='store_true')
    a = ap.parse_args(); base = None if a.no_sheets else bg02(); fnt = font(15); small = font(12)
    for npc in a.npc or sorted(d for d in os.listdir(a.render) if d.startswith('NPC')):
        src = os.path.join(a.render, npc); R = json.load(open(os.path.join(src, 'frames.json'))); fr = R['frames']; S = R['S']
        out = os.path.join(QA, npc); os.makedirs(out, exist_ok=True)
        ims = [Image.open(os.path.join(src, 'seq', f'{n:04d}.png')) for n in range(len(fr))]; imgs = [silhouette(im) for im in ims]; sils = [x[2] for x in imgs]
        passims = [Image.open(os.path.join(src, 'pass', f'{i:04d}.png')) for i in range(48)]
        views = {}
        for seg, view in (('enter', 'front'), ('exit', 'rear')):
            idx = [n for n, f in enumerate(fr) if f['seg'] == seg]; views[view] = per_view([fr[n] for n in idx], [imgs[n] for n in idx], view, S)
        if R['pass'] and 'feet_world' in R['pass'][0]: views['side'] = per_view(R['pass'], [silhouette(im) for im in passims], 'side', S)
        seam_rows = seams(fr, sils)
        rep = {'npc': npc, 'rig': R['rig'], 'height_m': R['height_m'], 'segments': R['segments'], 'sequence': R['sequence'], 'fixes': R['fixes'],
               'knee': {'rig_v05_stance_flex_max_deg': max([v for d in R['rig_stance_knee_flex_deg'] for v in d.values()] or [0]),
                        'v06_stance_flex_max_deg': max([v for d in R['stance_knee_flex_deg'] for v in d.values()] or [0]),
                        'v06_flat_frames_over_25': sum(1 for d in R['stance_knee_flex_deg'] if any(v > 25 for v in d.values())),
                        'body_lift_max_m': max(R['knee_lift_m'])},
               'views': views, 'seams': seam_rows, 'walk_step_reference': {'enter': walk_steps(fr, sils, 'enter'), 'exit': walk_steps(fr, sils, 'exit')},
               'resting_contact_slide': slides(fr),
               'knee_band': {'v06_enter_exit': knee_band_v06(fr, imgs, ('enter', 'exit')), 'v06_all_segments': knee_band_v06(fr, imgs, tuple(R['segments'])), 'v05_delivered': knee_band_v05(npc)},
               'enter_end_vs_exit_start': {'root_world': [R['sequence']['enter_end_root_world'], R['sequence']['exit_start_root_world']],
                                           'root_gap_m': round(math.dist(R['sequence']['enter_end_root_world'], R['sequence']['exit_start_root_world']), 4)},
               'per_frame': [{'n': n, 'seg': f['seg'], 'i': f['i'], 'art': f['art'], **sils[n]} for n, f in enumerate(fr)]}
        json.dump(rep, open(os.path.join(out, 'metrics_v06.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print(npc, 'segments', {k: v['frames'] for k, v in R['segments'].items()}, 'knee', rep['knee'])
        for r in seam_rows: print('  seam', r['at'], r['from'], '->', r['to'], 'root', r['root_px'], 'head', r['head_rig_px'], 'hcx', r['head_center_x_px'], 'hw', r['head_width_change'], 'low', r['lowest_row_px'], 'feet', r['resting_feet_moved_mm'])
        print('  knee band', rep['knee_band']);print('  step ref enter', rep['walk_step_reference']['enter']); print('  slide', rep['resting_contact_slide']); print('  views', json.dumps(views))
        if a.no_sheets: continue
        boxes = [s['box'] for s in sils]; cu = crop_union(boxes)
        # sequence sheet: every 3rd frame on BG02 with the engine shadows
        tiles = []
        for n in range(0, len(fr), 3):
            c = comp(base, ims[n], fr[n]['shadows']).crop(cu); d = ImageDraw.Draw(c); d.text((4, 2), f"{n:03d} {fr[n]['seg']} {fr[n]['i']}", fill=(255, 255, 0, 255), font=small)
            tiles.append(c.resize((c.width // 2, c.height // 2), Image.LANCZOS))
        grid(tiles, 18).convert('RGB').save(os.path.join(out, 'sequence_sheet.jpg'), quality=82)
        # seams: n-1, n and an onion overlay (blue n-1, orange n) at full size
        tiles = []
        for r in seam_rows:
            n = r['at']; cu2 = crop_union([boxes[n - 1], boxes[n]], (40, 30, 40, 30)); on = base.copy()
            for k, tint in ((n - 1, (80, 200, 255)), (n, (255, 120, 80))):
                al = ims[k].getchannel('A').point(lambda v: v * 6 // 10); on.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), c) for c in tint] + [al]))
            row = [comp(base, ims[n - 1], fr[n - 1]['shadows']).crop(cu2), comp(base, ims[n], fr[n]['shadows']).crop(cu2), on.crop(cu2)]
            strip = Image.new('RGBA', (sum(t.width for t in row), row[0].height + 40), (0, 0, 0, 255)); x = 0
            for t in row: strip.paste(t, (x, 40)); x += t.width
            d = ImageDraw.Draw(strip); d.text((4, 2), f"{r['from']} -> {r['to']}", fill=(255, 255, 0, 255), font=fnt)
            d.text((4, 20), f"root {r['root_px']} px, head {r['head_rig_px']} px, head width {r['head_width_change']:+.1%}, lowest row {r['lowest_row_px']:+d} px, resting feet moved {r['resting_feet_moved_mm']} mm", fill=(255, 255, 255, 255), font=small)
            tiles.append(strip.resize((strip.width * 2 // 3, strip.height * 2 // 3), Image.LANCZOS))
        grid(tiles, 2).convert('RGB').save(os.path.join(out, 'seams_sheet.jpg'), quality=82)
        # turn: every frame, and the feet of every synthesised frame
        idx = [n for n, f in enumerate(fr) if f['seg'] in ('settle', 'turn', 'start')]; cu3 = crop_union([boxes[n] for n in idx])
        tiles = []
        for n in [n for n in idx if fr[n]['seg'] == 'turn'] + [n for n in idx if fr[n]['seg'] != 'turn']:
            c = comp(base, ims[n], fr[n]['shadows']).crop(cu3); ImageDraw.Draw(c).text((4, 2), f"{fr[n]['seg']} {fr[n]['i']} {fr[n]['art']}", fill=(255, 255, 0, 255), font=small)
            tiles.append(c.resize((c.width * 3 // 5, c.height * 3 // 5), Image.LANCZOS))
        grid(tiles, 14).convert('RGB').save(os.path.join(out, 'turn_settle_start_sheet.jpg'), quality=82)
        tiles = []
        for n in idx:
            f = fr[n]; pts = [f['feet_px'][s][k] for s in 'LR' for k in ('heel', 'toe')]
            x0 = int(min(p[0] for p in pts) - 40); x1 = int(max(p[0] for p in pts) + 40); y0 = int(min(p[1] for p in pts) - 70); y1 = int(max(p[1] for p in pts) + 18)
            c = comp(base, ims[n], f['shadows']).crop((x0, y0, x1, y1)); d = ImageDraw.Draw(c)
            for s, col in (('L', (90, 200, 255, 255)), ('R', (255, 170, 80, 255))):
                ct = contact(f, s)
                if ct: q = project(ct); d.ellipse([q[0] - x0 - 3, q[1] - y0 - 3, q[0] - x0 + 3, q[1] - y0 + 3], outline=col)
            d.text((2, 1), f"{f['seg'][:2]}{f['i']}", fill=(255, 255, 0, 255), font=small); tiles.append(c)
        grid(tiles, 16).convert('RGB').save(os.path.join(out, 'feet_synth_sheet.jpg'), quality=82)
        # before/after: v05 enter end + exit start, v06 enter end / stand / turn end / exit start
        v05 = lambda view, i: Image.open(os.path.join(V05, npc, 'sprites', view, f'{i:04d}.png'))
        seg = R['segments']; picks = [('v05 front 47', v05('front', 47), None), ('v05 rear 0', v05('rear', 0), None),
                                      ('v06 enter 47', ims[47], fr[47]['shadows']), ('v06 idle', ims[seg['idle']['offset'] + seg['idle']['frames'] - 1], fr[seg['idle']['offset'] + seg['idle']['frames'] - 1]['shadows']),
                                      ('v06 turn end', ims[seg['turn']['offset'] + seg['turn']['frames'] - 1], fr[seg['turn']['offset'] + seg['turn']['frames'] - 1]['shadows']), ('v06 exit 0', ims[seg['exit']['offset']], fr[seg['exit']['offset']]['shadows'])]
        cu4 = (140, 360, 580, 1200); tiles = []
        for label, im, sh in picks:
            c = comp(base, im, sh or []).crop(cu4); ImageDraw.Draw(c).text((4, 2), label, fill=(255, 255, 0, 255), font=fnt); tiles.append(c)
        grid(tiles, 6).convert('RGB').save(os.path.join(out, 'before_after.jpg'), quality=82)
        # walk views: enter (front), exit (rear), pass (side), every 4th frame + 47, like the v0.17 contact sheet
        rows = []
        for label, frames_, imgs_, shs in (('front', [n for n, f in enumerate(fr) if f['seg'] == 'enter'], ims, [f['shadows'] for f in fr]),
                                         ('rear', [n for n, f in enumerate(fr) if f['seg'] == 'exit'], ims, [f['shadows'] for f in fr]),
                                         ('side', list(range(48)), passims, [p['shadows'] for p in R['pass']])):
            picks = frames_[::4] + [frames_[-1]]; bx = [silhouette(imgs_[n])[2]['box'] for n in picks]; cu5 = crop_union(bx)
            tiles = []
            for n in picks:
                b5 = silhouette(imgs_[n])[2]['box']
                crop = cu5 if label != 'side' else ((b5[0] + b5[2]) // 2 - 95, cu5[1], (b5[0] + b5[2]) // 2 + 95, cu5[3])
                c = comp(base, imgs_[n], shs[n]).crop(crop); ImageDraw.Draw(c).text((4, 2), f"{label} {n if label == 'side' else fr[n]['i']:02d}", fill=(255, 255, 0, 255), font=fnt); tiles.append(c)
            rows.append(grid(tiles, 13))
        sheet = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), (0, 0, 0, 255)); y = 0
        for r in rows: sheet.paste(r, (0, y)); y += r.height
        if sheet.width > 1800: sheet = sheet.resize((1800, round(sheet.height * 1800 / sheet.width)), Image.LANCZOS)
        sheet.convert('RGB').save(os.path.join(out, 'walk_sheet.jpg'), quality=82)
        # legs, v05 delivered vs v06 at the same rig frame (front enter and rear exit), 1:1 pixels
        tiles = []
        for view, seg, ks in (('front', 'enter', (0, 12, 24, 36, 46)), ('rear', 'exit', (0, 12, 24, 36, 46))):
            off = R['segments'][seg]['offset']
            for k in ks:
                for tag, im, sh in (('v05', v05(view, k), []), ('v06', ims[off + k], fr[off + k]['shadows'])):
                    b6 = silhouette(im)[2]['box']; cy = b6[1] + int((b6[3] - b6[1]) * .45)
                    c = comp(base, im, sh).crop(((b6[0] + b6[2]) // 2 - 80, cy, (b6[0] + b6[2]) // 2 + 80, b6[3] + 12)); ImageDraw.Draw(c).text((3, 2), f'{tag} {view} {k}', fill=(255, 255, 0, 255), font=small); tiles.append(c)
        grid(tiles, 10).convert('RGB').save(os.path.join(out, 'legs_v05_v06.jpg'), quality=90)
        # side view upper body, every 2nd frame, x1.5 (far arm, carrying arm, arm length), v05 delivered row above v06 row
        tiles = []
        for tag, get in (('v05', lambda i: Image.open(os.path.join(V05, npc, 'sprites', 'side', f'{i:04d}.png'))), ('v06', lambda i: passims[i])):
            for i in range(0, 48, 2):
                im = get(i); b8 = silhouette(im)[2]['box']; cx = (b8[0] + b8[2]) // 2; top = b8[1]; h8 = int((b8[3] - b8[1]) * .62)
                c = comp(base, im, []).crop((cx - 85, top - 8, cx + 85, top + h8)); ImageDraw.Draw(c).text((3, 2), f'{tag} {i:02d}', fill=(255, 255, 0, 255), font=small)
                tiles.append(c.resize((int(c.width * 1.5), int(c.height * 1.5)), Image.LANCZOS))
        grid(tiles, 12).convert('RGB').save(os.path.join(out, 'arm_side_v05_v06.jpg'), quality=82)
        # shoulder line and hip line at both mid-stances (rig frames 12 and 36), v05 delivered vs v06, 1.5x
        import importlib.util
        spec = importlib.util.spec_from_file_location('binding', os.path.join(ROOT, 'scripts', 'build-walk-binding.py')); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
        cfg = json.load(open(os.path.join(V05, npc, 'config.json'))); rig = json.load(open(os.path.join(V05, npc, cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json')))
        tiles = []
        for view, seg in (('front', 'enter'), ('rear', 'exit')):
            for k in (12, 36):
                pv = {j: [c * S for c in v] for j, v in rig['frames'][k]['joints'].items()}; off = R['segments'][seg]['offset']
                for tag, im, pts in (('v05', v05(view, k), {j: B.project(view, pv[j]) for j in ('Lhip', 'Rhip', 'Lshoulder', 'Rshoulder')}),
                                     ('v06', ims[off + k], {'Lhip': fr[off + k]['legs_px']['L']['hip'], 'Rhip': fr[off + k]['legs_px']['R']['hip'], 'Lshoulder': fr[off + k]['shoulders_px']['L'], 'Rshoulder': fr[off + k]['shoulders_px']['R']})):
                    c = comp(base, im, []); d = ImageDraw.Draw(c)
                    for a1, a2, col in (('Lhip', 'Rhip', (90, 200, 255, 255)), ('Lshoulder', 'Rshoulder', (255, 170, 80, 255))):
                        p1, p2 = pts[a1], pts[a2]; mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2; dx, dy = p2[0] - p1[0], p2[1] - p1[1]; L = math.hypot(dx, dy) or 1
                        d.line([(mx - dx / L * 90, my - dy / L * 90), (mx + dx / L * 90, my + dy / L * 90)], fill=col, width=2)
                    b7 = silhouette(im)[2]['box']; cx = (b7[0] + b7[2]) // 2; t = c.crop((cx - 120, b7[1] + int((b7[3] - b7[1]) * .12), cx + 120, b7[1] + int((b7[3] - b7[1]) * .6)))
                    ImageDraw.Draw(t).text((3, 2), f'{tag} {view} {k}', fill=(255, 255, 0, 255), font=small); tiles.append(t.resize((t.width * 3 // 2, t.height * 3 // 2), Image.LANCZOS))
        grid(tiles, 8).convert('RGB').save(os.path.join(out, 'torso_lines_v05_v06.jpg'), quality=82)
        if a.ffmpeg: video(a.ffmpeg, npc, R, fr, ims, base, out, v05)

def video(ff, npc, R, fr, ims, base, out, v05):
    """Side by side at half size: v05 as the engine could play it (enter, hold frame 47 for the idle+turn+start time,
    then the v05 exit clip on its own path) and the v06 sequence. 24 fps and a slow 8 fps copy."""
    seg = R['segments']; hold = seg['settle']['frames'] + seg['idle']['frames'] + seg['turn']['frames'] + seg['start']['frames']
    left = [('front', i) for i in range(48)] + [('front', 47)] * hold + [('rear', i) for i in range(48)]
    fnt = font(18)
    with tempfile.TemporaryDirectory() as tmp:
        for n, f in enumerate(fr):
            view, i = left[n]; a = base.copy(); a.alpha_composite(v05(view, i)); b = comp(base, ims[n], f['shadows'])
            frame = Image.new('RGB', (W, H // 2 + 40), (0, 0, 0)); frame.paste(a.convert('RGB').resize((W // 2, H // 2)), (0, 40)); frame.paste(b.convert('RGB').resize((W // 2, H // 2)), (W // 2, 40))
            d = ImageDraw.Draw(frame); d.text((6, 8), f'v05 {view} {i}', fill=(255, 255, 0), font=fnt); d.text((W // 2 + 6, 8), f"v06 {f['seg']} {f['i']} ({f['art']})", fill=(255, 255, 0), font=fnt)
            frame.save(os.path.join(tmp, f'{n:04d}.png'))
        for fps, name in ((24, 'compare_v05_v06.mp4'), (8, 'compare_v05_v06_slow.mp4')):
            subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(tmp, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', os.path.join(out, name)], check=True)

if __name__ == '__main__':
    main()

