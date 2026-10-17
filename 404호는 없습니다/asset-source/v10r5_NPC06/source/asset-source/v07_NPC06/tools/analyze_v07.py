#!/usr/bin/env python3
"""NPC06 v07 experiment: measurements on the real frames of two fresh renders under the same v06 conditions.

  python3 -I tools/analyze_v07.py --v06 <render dir> --v07 <render dir> [--ffmpeg <path>] [--no-media]

<render dir> is what render_v06.js wrote for NPC06 (seq/, pass/, frames.json): one run without --art and one with
--art=v07. Nothing is taken from earlier QA files: every number below comes from these frames.

  same suite as v06   room404/scripts/analyze-v06-frames.py on both renders (contact, planted slide, consistency, seams,
                      resting contact slide, knee band), so a v07 change that breaks a v06 PASS shows up
  cuff join           where the placed state picture ends against the v06 leg end on the shoe (renderer record), and on
                      the pixels: lowest alpha on the leg axis between the drawn cuff and the shoe (a hole when < 128),
                      and cuff below the sole line
  knee sideways       drawn knee (estimate from the picture) against the rig's projected knee, across the leg
  state switches      each leg's state change: jump of the cuff and of the drawn knee against the largest same-state
                      frame-to-frame movement in the same walk (natural travel), and the leg's silhouette overlap
  colour              CIELAB of the trouser pixels below the pelvis against the pelvis pixels in the same frame
  torso switches      each torso picture change: torso box width and colour before/after
Output: asset-source/v07_QA/NPC06/metrics_v07.json and, unless --no-media, comparison sheets, overlays, switch zooms and
v06|v07 videos (24 fps and 8 fps).
"""
import argparse, importlib.util, json, math, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(PROJECT, 'asset-source', 'v07_QA', 'NPC06')
spec = importlib.util.spec_from_file_location('a6', os.path.join(PROJECT, 'room404', 'scripts', 'analyze-v06-frames.py')); A6 = importlib.util.module_from_spec(spec); spec.loader.exec_module(A6)
W, H = A6.W, A6.H

def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = c @ M.T / np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116); return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def load(d):
    R = json.load(open(os.path.join(d, 'frames.json'))); fr = R['frames']
    ims = [Image.open(os.path.join(d, 'seq', f'{n:04d}.png')) for n in range(len(fr))]; ims = [im.convert('RGBA') for im in ims]
    return R, fr, ims, [A6.silhouette(im) for im in ims]

def suite(R, fr, ims, imgs, d):
    sils = [x[2] for x in imgs]; S = R['S']; views = {}
    for seg, view in (('enter', 'front'), ('exit', 'rear')):
        idx = [n for n, f in enumerate(fr) if f['seg'] == seg]; views[view] = A6.per_view([fr[n] for n in idx], [imgs[n] for n in idx], view, S)
    passims = [Image.open(os.path.join(d, 'pass', f'{i:04d}.png')) for i in range(48)]
    views['side'] = A6.per_view(R['pass'], [A6.silhouette(im) for im in passims], 'side', S)
    return {'views': views, 'seams': A6.seams(fr, sils), 'walk_step_reference': {'enter': A6.walk_steps(fr, sils, 'enter'), 'exit': A6.walk_steps(fr, sils, 'exit')},
            'resting_contact_slide': A6.slides(fr), 'knee_band': {'enter_exit': A6.knee_band_v06(fr, imgs, ('enter', 'exit')), 'all_segments': A6.knee_band_v06(fr, imgs, tuple(R['segments']))},
            'knee': {'stance_flex_max_deg': max([v for d_ in R['stance_knee_flex_deg'] for v in d_.values()] or [0]), 'flat_frames_over_25': sum(1 for d_ in R['stance_knee_flex_deg'] if any(v > 25 for v in d_.values()))},
            'enter_end_vs_exit_start': {'root_gap_m': round(math.dist(R['sequence']['enter_end_root_world'], R['sequence']['exit_start_root_world']), 4)}}

def axis_min_alpha(a, p0, p1, n=24):
    vals = []
    for t in np.linspace(0, 1, n):
        x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t; xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < W and 0 <= yi < H: vals.append(int(a[yi, xi]))
    return min(vals) if vals else None

def cuff_join(fr, imgs, S):
    rows = []
    for n, f in enumerate(fr):
        v = f.get('v07')
        if not v: continue
        a = imgs[n][0]
        for s in 'LR':
            q = v['legs'][s]; ft = f['feet_px'][s]; sole = max(ft['heel'][1], ft['toe'][1]); k = A6.project(f['feet_world'][s]['ankle'])[2]
            shoe_h = .108 * S * k; overlap = .031 * S * k
            # visible hole: the trouser ends above the shoe top. Probe the drawn image between the cuff landing point and a point
            # 2 px inside the shoe top on the same leg line (the shoe is drawn first, the leg over it).
            hole = None
            if q['cuff_gap_px'] > overlap:
                top_shoe = [q['end_px'][0], sole - shoe_h + 2]; hole = axis_min_alpha(a, q['cuff_px'], top_shoe)
            # cuff-anchored run: the top may stop short of the v06 leg top; a hole when the pelvis does not cover the shortfall
            top_hole = None
            if q.get('top_gap_px', 0) > 0: top_hole = axis_min_alpha(a, q['top_drawn_px'], q['top_px'])
            rows.append({'n': n, 'seg': f['seg'], 'i': f['i'], 'view': v['view'], 'side': s, 'state': q['state'], 'flex': q['flex'], 'gap_px': q['cuff_gap_px'],
                         'top_gap_px': q.get('top_gap_px'), 'top_hole_min_alpha': top_hole, 'top_hole': top_hole is not None and top_hole < 128,
                         'overlap_px': round(overlap, 2), 'shoe_h_px': round(shoe_h, 2), 'hole_min_alpha': hole, 'hole': hole is not None and hole < 128,
                         'below_sole_px': round(q['cuff_px'][1] - sole, 2), 'covers_shoe_frac': round(max(0.0, -q['cuff_gap_px'] + overlap) / shoe_h, 3) if q['cuff_gap_px'] < overlap else 0.0})
    return rows

def knee_side(fr):
    rows = []
    for n, f in enumerate(fr):
        v = f.get('v07')
        if not v: continue
        for s in 'LR':
            q = v['legs'][s]; rig = f['legs_px'][s]['knee']; L = math.dist(q['top_px'], q['end_px'])
            # sideways = across the hip-to-leg-end line on screen
            ux, uy = (q['end_px'][0] - q['top_px'][0]) / L, (q['end_px'][1] - q['top_px'][1]) / L
            d = (q['knee_px'][0] - rig[0]) * -uy + (q['knee_px'][1] - rig[1]) * ux; al = (q['knee_px'][0] - rig[0]) * ux + (q['knee_px'][1] - rig[1]) * uy
            rows.append({'n': n, 'seg': f['seg'], 'view': v['view'], 'side': s, 'state': q['state'], 'sideways_px': round(d, 2), 'sideways_rel_leg': round(d / L, 3),
                         'along_px': round(al, 2), 'along_rel_leg': round(al / L, 3),
                         'drawn_knee_px': q['knee_px'], 'rig_knee_px': rig})
    return rows

def leg_box(f, s):
    q = f['v07']['legs'][s]; xs = [q['top_px'][0], q['knee_px'][0], q['cuff_px'][0], q['end_px'][0]]; ys = [q['top_px'][1], q['cuff_px'][1], q['end_px'][1]]
    return (int(min(xs) - 45), int(min(ys) - 5), int(max(xs) + 45), int(max(ys) + 8))

def iou_box(a, b, box):
    x0, y0, x1, y1 = max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]); A = a[y0:y1, x0:x1] >= 128; B = b[y0:y1, x0:x1] >= 128
    u = (A | B).sum(); return round(float((A & B).sum() / u), 3) if u else None

def switches(fr, imgs):
    """Leg state changes and torso picture changes, against the same-state frame-to-frame movement of the same walk."""
    legs, torso, travel = [], [], {}
    for n in range(1, len(fr)):
        a, b = fr[n - 1], fr[n]
        if not (a.get('v07') and b.get('v07')) or a['v07']['view'] != b['v07']['view']: continue
        for s in 'LR':
            qa, qb = a['v07']['legs'][s], b['v07']['legs'][s]; dc = math.dist(qa['cuff_px'], qb['cuff_px']); dk = math.dist(qa['knee_px'], qb['knee_px'])
            box = leg_box(a, s); box = (min(box[0], leg_box(b, s)[0]), min(box[1], leg_box(b, s)[1]), max(box[2], leg_box(b, s)[2]), max(box[3], leg_box(b, s)[3]))
            row = {'at': n, 'seg': f"{a['seg']}{a['i']}->{b['seg']}{b['i']}", 'view': b['v07']['view'], 'side': s, 'from': qa['state'], 'to': qb['state'], 'flex': [qa['flex'], qb['flex']],
                   'cuff_jump_px': round(dc, 2), 'knee_jump_px': round(dk, 2), 'rig_ankle_move_px': round(math.dist(a['legs_px'][s]['ankle'], b['legs_px'][s]['ankle']), 2),
                   'rig_knee_move_px': round(math.dist(a['legs_px'][s]['knee'], b['legs_px'][s]['knee']), 2), 'leg_iou': iou_box(imgs[n - 1][0], imgs[n][0], box), 'pixel_change': region_change(comps_, n, box)}
            if qa['state'] != qb['state']: legs.append(row)
            elif a['seg'] == b['seg'] and a['seg'] in ('enter', 'exit'):
                t = travel.setdefault(a['seg'], {'cuff': 0, 'knee': 0, 'cuff_minus_ankle': 0, 'iou_min': 1})
                t['cuff'] = max(t['cuff'], dc); t['knee'] = max(t['knee'], dk); t['cuff_minus_ankle'] = max(t['cuff_minus_ankle'], abs(dc - row['rig_ankle_move_px'])); t['iou_min'] = min(t['iou_min'], row['leg_iou'] or 1)
                t['leg_pixel_change'] = max(t.get('leg_pixel_change', 0), row['pixel_change'])
        if a['seg'] == b['seg'] and a['seg'] in ('enter', 'exit') and a['v07']['torso']['cell'] == b['v07']['torso']['cell']:
            t = travel.setdefault(a['seg'], {}); t['torso_pixel_change'] = max(t.get('torso_pixel_change', 0), region_change(comps_, n, torso_box(b)))
        ta, tb = a['v07']['torso']['cell'], b['v07']['torso']['cell']
        if ta != tb:
            torso.append({'at': n, 'seg': f"{a['seg']}{a['i']}->{b['seg']}{b['i']}", 'view': b['v07']['view'], 'from': ta or 'neutral (atlas)', 'to': tb or 'neutral (atlas)',
                          'yaw_deg': [a['v07']['torso']['yaw_deg'], b['v07']['torso']['yaw_deg']], 'pixel_change': region_change(comps_, n, torso_box(b)), **torso_change(a, b, imgs[n - 1][0], imgs[n][0], ims_rgb[n - 1], ims_rgb[n])})
    return legs, torso, {k: {kk: round(vv, 2) for kk, vv in v.items()} for k, v in travel.items()}

def torso_rows(f):
    sh = f['shoulders_px']; y0 = int(min(sh['L'][1], sh['R'][1]) - 6); y1 = int((f['legs_px']['L']['hip'][1] + f['legs_px']['R']['hip'][1]) / 2 - 4); return y0, y1

def torso_box(f):
    y0, y1 = torso_rows(f); sh = f['shoulders_px']; cx = (sh['L'][0] + sh['R'][0]) / 2; hw = abs(sh['L'][0] - sh['R'][0]) * .55
    return (int(cx - hw), y0, int(cx + hw), y1)

def torso_change(a, b, A, B, RA, RB):
    """Inside the torso between the shoulders (arms excluded): opaque width at mid height, mean colour, before/after."""
    out = {}
    for tag, f, al, rgb in (('before', a, A, RA), ('after', b, B, RB)):
        x0, y0, x1, y1 = torso_box(f); m = al[y0:y1, x0:x1] >= 250; px = rgb[y0:y1, x0:x1][m]
        out[tag] = {'lab': [round(float(v), 1) for v in lab(px.astype(float)).mean(0)]}
    out['delta_e76'] = round(math.dist(out['before']['lab'], out['after']['lab']), 2); return out

def colour(fr, imgs, rgbs, which):
    """Trouser colour continuity: opaque pixels of the pelvis piece (a band 6-12 cm under the root, within 3.5 cm of the
    body centre line, below the cardigan hem and away from the bag) against pixels along each leg axis between knee and
    ankle (within 8 px of the rig axis)."""
    rows = []
    for n, f in enumerate(fr):
        if f['art'] == 'side' or f['seg'] not in ('enter', 'exit', 'idle'): continue
        a = imgs[n][0]; rgb = rgbs[n]; root = A6.project(f['root_world']); k = root[2]; cx = int(root[0]); dx = max(4, int(.035 * k))
        py0, py1 = int(root[1] + .06 * k), int(root[1] + .12 * k); sub = a[py0:py1, cx - dx:cx + dx] >= 250; P = rgb[py0:py1, cx - dx:cx + dx][sub]
        legpx = []
        for s in 'LR':
            kn, an = f['legs_px'][s]['knee'], f['legs_px'][s]['ankle']
            for t in np.linspace(.1, .8, 30):
                x, y = kn[0] + (an[0] - kn[0]) * t, kn[1] + (an[1] - kn[1]) * t
                for ox in range(-8, 9, 2):
                    xi, yi = int(round(x + ox)), int(round(y))
                    if 0 <= xi < W and 0 <= yi < H and a[yi, xi] >= 250: legpx.append(rgb[yi, xi])
        if len(P) < 30 or len(legpx) < 60: continue
        Pl = lab(P.astype(float)).mean(0); Ll = lab(np.array(legpx, float)).mean(0)
        rows.append({'n': n, 'seg': f['seg'], 'pelvis_lab': [round(float(v), 1) for v in Pl], 'legs_lab': [round(float(v), 1) for v in Ll], 'delta_e76': round(float(np.linalg.norm(Pl - Ll)), 2)})
    return rows

def region_change(ims, n, box):
    """Mean absolute RGB change (0-255) inside box between frame n-1 and n, both composited on BG02."""
    x0, y0, x1, y1 = max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3])
    A = np.asarray(ims[n - 1])[y0:y1, x0:x1].astype(float); B = np.asarray(ims[n])[y0:y1, x0:x1].astype(float)
    return round(float(np.abs(A - B).mean()), 2)

def stat(v):
    v = [x for x in v if x is not None]
    return {'n': len(v), 'min': round(float(min(v)), 2), 'median': round(float(np.median(v)), 2), 'max': round(float(max(v)), 2)} if v else None

ims_rgb = None
comps_ = None
OUT_ = OUT

def main():
    global ims_rgb, comps_
    ap = argparse.ArgumentParser(); ap.add_argument('--v06', required=True); ap.add_argument('--v07', required=True); ap.add_argument('--ffmpeg'); ap.add_argument('--no-media', action='store_true'); ap.add_argument('--out', default=OUT); a = ap.parse_args()
    global OUT_; OUT_ = a.out; os.makedirs(OUT_, exist_ok=True)
    R6, fr6, ims6, imgs6 = load(a.v06); R7, fr7, ims7, imgs7 = load(a.v07); S = R7['S']
    assert R7.get('art') == 'v07' and R6.get('art') is None and len(fr6) == len(fr7)
    rgb6 = [np.asarray(im)[..., :3] for im in ims6]; rgb7 = [np.asarray(im)[..., :3] for im in ims7]; ims_rgb = rgb7
    base = A6.bg02(); comps_ = [A6.comp(base, im, f['shadows']).convert('RGB') for im, f in zip(ims7, fr7)]
    # identical inputs apart from the art: same rig joints, feet and shadows in every frame
    same_geometry = all(f6['root_world'] == f7['root_world'] and f6['feet_world'] == f7['feet_world'] and f6['shadows'] == f7['shadows'] and f6['legs_px'] == f7['legs_px'] for f6, f7 in zip(fr6, fr7))
    pass_identical = all(open(os.path.join(a.v06, 'pass', f'{i:04d}.png'), 'rb').read() == open(os.path.join(a.v07, 'pass', f'{i:04d}.png'), 'rb').read() for i in range(48))
    m6 = suite(R6, fr6, ims6, imgs6, a.v06); m7 = suite(R7, fr7, ims7, imgs7, a.v07)
    cj = cuff_join(fr7, imgs7, S); ks = knee_side(fr7); legsw, torsw, travel = switches(fr7, imgs7); col7 = colour(fr7, imgs7, rgb7, 'v07'); col6 = colour(fr6, imgs6, rgb6, 'v06')
    by = lambda rows, key, f=lambda r: True: {k: [r for r in rows if r[key] == k and f(r)] for k in sorted({r[key] for r in rows})}
    walk = lambda r: r['seg'] in ('enter', 'exit')
    summ = {'cuff_join': {}, 'knee_sideways': {}, 'colour': {}, 'state_use': {}}
    for view, seg in (('front', 'enter'), ('rear', 'exit')):
        rows = [r for r in cj if r['view'] == view and r['seg'] == seg]; allv = [r for r in cj if r['view'] == view]
        summ['cuff_join'][view] = {'walk_legs': len(rows), 'gap_px': stat([r['gap_px'] for r in rows]), 'holes': sum(r['hole'] for r in rows), 'below_sole': sum(r['below_sole_px'] > 0 for r in rows),
                                   'top_gap_px': stat([r['top_gap_px'] for r in rows]) if rows and rows[0]['top_gap_px'] is not None else None, 'top_holes': sum(r['top_hole'] for r in rows),
                                   'covers_over_half_shoe': sum(r['covers_shoe_frac'] > .5 for r in rows),
                                   'by_state': {k: stat([r['gap_px'] for r in v]) for k, v in by(rows, 'state').items()},
                                   'all_segments': {'legs': len(allv), 'holes': sum(r['hole'] for r in allv), 'top_holes': sum(r['top_hole'] for r in allv), 'below_sole': sum(r['below_sole_px'] > 0 for r in allv), 'covers_over_half_shoe': sum(r['covers_shoe_frac'] > .5 for r in allv)}}
        kr = [r for r in ks if r['view'] == view and r['seg'] == seg]
        summ['knee_sideways'][view] = {k: {'abs_px': stat([abs(r['sideways_px']) for r in v]), 'abs_rel_leg': stat([abs(r['sideways_rel_leg']) for r in v]),
                                           'along_px': stat([r['along_px'] for r in v]), 'along_rel_leg': stat([r['along_rel_leg'] for r in v])} for k, v in by(kr, 'state').items()}
        summ['state_use'][view] = {k: len(v) for k, v in by(rows, 'state').items()}
        c7 = [r for r in col7 if r['seg'] == seg]; c6 = [r for r in col6 if r['seg'] == seg]
        summ['colour'][view] = {'v07_pelvis_vs_legs_dE76': stat([r['delta_e76'] for r in c7]), 'v06_pelvis_vs_legs_dE76': stat([r['delta_e76'] for r in c6]),
                                'v07_legs_lab_mean': [round(float(np.mean([r['legs_lab'][i] for r in c7])), 1) for i in range(3)], 'v06_legs_lab_mean': [round(float(np.mean([r['legs_lab'][i] for r in c6])), 1) for i in range(3)]}
    rep = {'npc': 'NPC06', 'generated_by': 'asset-source/v07_NPC06/tools/analyze_v07.py', 'renders': {'v06': R6.get('art', 'v06'), 'v07': R7['art'], 'binding': R7['binding'], 'v07_anchor': R7.get('v07_anchor', 'top'), 'v07_calibration': R7.get('v07_calibration')},
           'same_rig_geometry_every_frame': same_geometry, 'side_pass_frames_identical_to_v06': pass_identical,
           'v06': m6, 'v07': m7, 'v07_checks': {'summary': summ, 'leg_switches': legsw, 'same_state_travel_max': travel, 'torso_switches': torsw,
                                                'cuff_join_rows': cj, 'knee_sideways_rows': ks, 'colour_rows': col7},
           'per_frame_v07': [{'n': n, 'seg': f['seg'], 'i': f['i'], 'art': f['art'], **imgs7[n][2], 'v07': f.get('v07')} for n, f in enumerate(fr7)]}
    json.dump(rep, open(os.path.join(OUT_, 'metrics_v07.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('same geometry', same_geometry, 'pass identical', pass_identical)
    for v in ('front', 'rear', 'side'): print(v, 'v06', json.dumps({k: m6['views'][v][k] for k in ('sole_vs_rig_px', 'planted_shoe_slide_px', 'height_ratio', 'head_width_ratio', 'alternates')}), '\n     v07', json.dumps({k: m7['views'][v][k] for k in ('sole_vs_rig_px', 'planted_shoe_slide_px', 'height_ratio', 'head_width_ratio', 'alternates')}))
    print('knee band v06', m6['knee_band'], 'v07', m7['knee_band'])
    print(json.dumps(summ, indent=1)); print('travel', travel)
    print('leg switches', len(legsw)); [print('  ', r) for r in legsw[:40]]
    print('torso switches', len(torsw)); [print('  ', {k: r[k] for k in ('at', 'seg', 'from', 'to', 'yaw_deg', 'pixel_change', 'delta_e76')}) for r in torsw]
    if not a.no_media: media(R6, fr6, ims6, imgs6, R7, fr7, ims7, imgs7, legsw, torsw, a.ffmpeg)

# ---- images and videos -----------------------------------------------------------------------------------------------------
def media(R6, fr6, ims6, imgs6, R7, fr7, ims7, imgs7, legsw, torsw, ff):
    base = A6.bg02(); fnt = A6.font(15); small = A6.font(12)
    comp = lambda im, sh: A6.comp(base, im, sh)
    boxes = [s[2]['box'] for s in imgs6] + [s[2]['box'] for s in imgs7]
    # 1. same frame v06 | v07: every 4th frame of each segment plus the frames next to every art change (side link)
    picks = sorted({n for seg, v in R7['segments'].items() for n in range(v['offset'], v['offset'] + v['frames'], 4)} |
                   {n for n in range(1, len(fr7)) for n in (n - 1, n) if fr7[n]['art'] != fr7[n - 1]['art'] or fr7[n]['seg'] != fr7[n - 1]['seg']})
    tiles = []
    for n in picks:
        u = A6.crop_union([imgs6[n][2]['box'], imgs7[n][2]['box']], (40, 18, 40, 22)); pair = []
        for tag, im, f in (('v06', ims6[n], fr6[n]), ('v07', ims7[n], fr7[n])):
            c = comp(im, f['shadows']).crop(u); d = ImageDraw.Draw(c); d.text((3, 2), f"{tag} {n} {f['seg']}{f['i']}", fill=(255, 255, 0, 255), font=small)
            v = f.get('v07')
            if v: d.text((3, 16), f"L {v['legs']['L']['state']} R {v['legs']['R']['state']} T {v['torso']['cell'] or 'n'}", fill=(120, 230, 255, 255), font=small)
            pair.append(c)
        t = Image.new('RGBA', (pair[0].width * 2, pair[0].height), (0, 0, 0, 255)); t.paste(pair[0], (0, 0)); t.paste(pair[1], (pair[0].width, 0))
        tiles.append(t.resize((t.width * 3 // 5, t.height * 3 // 5), Image.LANCZOS))
    A6.grid(tiles, 8).convert('RGB').save(os.path.join(OUT_, 'compare_v06_v07_sheet.jpg'), quality=84)
    # 2. overlays on v07 enter/exit frames: rig joints, drawn knee and cuff, leg end, both feet contact, floor line, shadows
    def overlay(n, scale=1):
        f = fr7[n]; c = comp(ims7[n], f['shadows']); d = ImageDraw.Draw(c)
        for x, y, rx, ry, al in f['shadows']: d.ellipse([x - rx, y - ry, x + rx, y + ry], outline=(255, 255, 255, 200))
        floor = [A6.project([f['feet_world'][s][k][0], 0, f['feet_world'][s][k][2]]) for s in 'LR' for k in ('heel', 'toe')]
        fy = max(p[1] for p in floor); d.line([(0, fy), (W, fy)], fill=(255, 60, 200, 160), width=1)
        for s, col in (('L', (90, 200, 255, 255)), ('R', (255, 170, 80, 255))):
            lp = f['legs_px'][s]; d.line([tuple(lp['hip']), tuple(lp['knee']), tuple(lp['ankle'])], fill=col, width=2)
            for j in ('hip', 'knee', 'ankle'): x, y = lp[j]; d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
            for k in ('heel', 'toe'):
                x, y = f['feet_px'][s][k]; ct = A6.contact(f, s); on = ct is not None and f['feet_world'][s][k][1] <= A6.PLANT
                d.rectangle([x - 3, y - 3, x + 3, y + 3], outline=col, fill=col if on else None)
            v = f.get('v07')
            if v:
                q = v['legs'][s]; x, y = q['knee_px']; d.line([(x - 6, y - 6), (x + 6, y + 6)], fill=(255, 255, 255, 255), width=2); d.line([(x - 6, y + 6), (x + 6, y - 6)], fill=(255, 255, 255, 255), width=2)
                x, y = q['cuff_px']; d.line([(x - 8, y), (x + 8, y)], fill=(255, 40, 40, 255), width=2); x, y = q['end_px']; d.line([(x - 8, y), (x + 8, y)], fill=(40, 255, 80, 255), width=2)
        sh = f['shoulders_px']; d.line([tuple(sh['L']), tuple(sh['R'])], fill=(255, 255, 0, 255), width=2)
        return c
    for seg, name in (('enter', 'overlay_front_enter.jpg'), ('exit', 'overlay_rear_exit.jpg'), ('settle', 'overlay_settle_start.jpg')):
        idx = [n for n, f in enumerate(fr7) if f['seg'] == seg] + ([n for n, f in enumerate(fr7) if f['seg'] == 'start'] if seg == 'settle' else [])
        step = 3 if seg != 'settle' else 2; tiles = []
        for n in idx[::step]:
            b = imgs7[n][2]['box']; u = (b[0] - 50, b[1] + int((b[3] - b[1]) * .2), b[2] + 50, b[3] + 25)
            c = overlay(n).crop(u); ImageDraw.Draw(c).text((3, 2), f"{fr7[n]['seg']}{fr7[n]['i']}", fill=(255, 255, 0, 255), font=small); tiles.append(c)
        A6.grid(tiles, 9).convert('RGB').save(os.path.join(OUT_, name), quality=86)
    leg = Image.new('RGB', (900, 70), (0, 0, 0)); d = ImageDraw.Draw(leg)
    d.text((6, 4), 'lines/dots: rig hip-knee-ankle (blue L, orange R); squares: heel/toe (filled = on the floor); white X: knee drawn in the v07 picture (estimate)', fill=(255, 255, 255), font=small)
    d.text((6, 22), 'red bar: where the v07 cuff ends; green bar: v06 leg end on the shoe; magenta: floor line under the nearest contact; white ellipses: engine shadows', fill=(255, 255, 255), font=small)
    d.text((6, 40), 'yellow: rig shoulder line', fill=(255, 255, 255), font=small); leg.save(os.path.join(OUT_, 'overlay_legend.png'))
    # 3. zooms just before and after every leg state change and every torso picture change (x2, onion third panel)
    def zoom(n, box, scale=2):
        out = []
        for k in (n - 1, n):
            c = comp(ims7[k], fr7[k]['shadows']).crop(box); out.append(c.resize((c.width * scale, c.height * scale), Image.LANCZOS))
        on = base.copy()
        for k, tint in ((n - 1, (80, 200, 255)), (n, (255, 120, 80))):
            al = ims7[k].getchannel('A').point(lambda v: v * 6 // 10); on.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), c) for c in tint] + [al]))
        on = on.crop(box); out.append(on.resize((on.width * scale, on.height * scale), Image.LANCZOS)); return out
    tiles = []
    for r in legsw:
        f = fr7[r['at']]; b = leg_box(f, r['side']); b0 = leg_box(fr7[r['at'] - 1], r['side']); box = (min(b[0], b0[0]) - 10, min(b[1], b0[1]) - 10, max(b[2], b0[2]) + 10, max(b[3], b0[3]) + 30)
        row = zoom(r['at'], box); strip = Image.new('RGBA', (sum(t.width for t in row), row[0].height + 34), (0, 0, 0, 255)); x = 0
        for t in row: strip.paste(t, (x, 34)); x += t.width
        ImageDraw.Draw(strip).text((4, 2), f"{r['seg']} {r['side']} {r['from']}->{r['to']} flex {r['flex']} cuff jump {r['cuff_jump_px']} px knee jump {r['knee_jump_px']} px (est.) pixel change {r['pixel_change']}", fill=(255, 255, 0, 255), font=small)
        tiles.append(strip)
    if tiles:
        for k in range(0, len(tiles), 12): A6.grid(tiles[k:k + 12], 3).convert('RGB').save(os.path.join(OUT_, f'switch_zoom_legs_{k // 12 + 1}.jpg'), quality=84)
    tiles = []
    for r in torsw:
        f = fr7[r['at']]; y0, y1 = torso_rows(f); cx = int((f['shoulders_px']['L'][0] + f['shoulders_px']['R'][0]) / 2); box = (cx - 95, y0 - 60, cx + 95, y1 + 20)
        row = zoom(r['at'], box); strip = Image.new('RGBA', (sum(t.width for t in row), row[0].height + 34), (0, 0, 0, 255)); x = 0
        for t in row: strip.paste(t, (x, 34)); x += t.width
        ImageDraw.Draw(strip).text((4, 2), f"{r['seg']} torso {r['from']} -> {r['to']} yaw {r['yaw_deg']} pixel change {r['pixel_change']} dE {r['delta_e76']}", fill=(255, 255, 0, 255), font=small)
        tiles.append(strip)
    if tiles:
        for k in range(0, len(tiles), 12): A6.grid(tiles[k:k + 12], 3).convert('RGB').save(os.path.join(OUT_, f'switch_zoom_torso_{k // 12 + 1}.jpg'), quality=84)
    # 4. videos: v06 | v07 at half size, and v07 with the overlays, 24 fps and 8 fps
    if ff:
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as tmp2:
            for n in range(len(fr7)):
                frame = Image.new('RGB', (W, H // 2 + 40), (0, 0, 0))
                frame.paste(comp(ims6[n], fr6[n]['shadows']).convert('RGB').resize((W // 2, H // 2)), (0, 40)); frame.paste(comp(ims7[n], fr7[n]['shadows']).convert('RGB').resize((W // 2, H // 2)), (W // 2, 40))
                d = ImageDraw.Draw(frame); d.text((6, 8), f"v06 {fr6[n]['seg']} {fr6[n]['i']} ({fr6[n]['art']})", fill=(255, 255, 0), font=fnt)
                v = fr7[n].get('v07'); d.text((W // 2 + 6, 4), f"v07 {fr7[n]['seg']} {fr7[n]['i']} ({fr7[n]['art']})", fill=(255, 255, 0), font=fnt)
                if v: d.text((W // 2 + 6, 22), f"L {v['legs']['L']['state']} R {v['legs']['R']['state']} torso {v['torso']['cell'] or 'neutral'}", fill=(120, 230, 255), font=small)
                frame.save(os.path.join(tmp, f'{n:04d}.png'))
                b = imgs7[n][2]['box']; cx = (b[0] + b[2]) // 2; ov = overlay(n).crop((cx - 180, 300, cx + 180, 1220)).convert('RGB'); ov.save(os.path.join(tmp2, f'{n:04d}.png'))
            for src, fps, name in ((tmp, 24, 'compare_v06_v07.mp4'), (tmp, 8, 'compare_v06_v07_slow.mp4'), (tmp2, 8, 'overlay_v07_slow.mp4')):
                subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(src, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', os.path.join(OUT_, name)], check=True)

if __name__ == '__main__':
    main()

