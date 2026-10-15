#!/usr/bin/env python3
"""NPC06 v09: measurements on the real frames of fresh renders under the same v06 camera, rig and BG02.

  python3 -B -I tools/analyze_v09.py --run default=<dir> --run v09=<dir> [--run v09r=<dir>] [--ffmpeg <path>] [--no-media]

<dir> is what render_v06.js wrote for NPC06 (seq/, pass/, frames.json). The first --run is the baseline the others are
compared with (pixels, colour, torso shift). Nothing is read from earlier QA files: every number comes from these frames.

  same suite as v06   room404/scripts/analyze-v06-frames.py through asset-source/v07_NPC06/tools/analyze_v07.py (contact,
                      L/R alternation, planted slide, sole vs rig, height/head ratio, shadow under shoe, seams, knee band)
  leg profile         along each projected leg (hip -> knee -> ankle from frames.json, front and rear art only): the opaque
                      width across the leg and the mean luma across its middle, 1 px apart. At the knee: narrowest and
                      widest width against the line from the thigh width to the shin width (neck / bulge), the largest
                      width change over 6 px (step), the largest luma change over 4 px against the same measure on the
                      thigh and shin (seam ratio: a horizontal line across the trouser), the darkest row (fold) and where
                      it sits against the projected knee, and partly transparent samples just outside the edges (rim)
  holes               background enclosed by the figure (alpha < 128 not connected to the canvas border)
  hem / shoe          lowest alpha on the leg line from the ankle to 2 px inside the shoe top (a gap when < 128)
  trouser             CIELAB of the leg pixels knee -> ankle against the baseline frame, and weave (std of the luma
                      Laplacian inside the leg) against the baseline
  torso               between the shoulders, the horizontal shift (px) that best matches the baseline torso, per third
                      of the torso height, against the shoulder yaw the renderer used; mean pixel change
  view switches       turn front -> side -> rear: the A6 seam rows plus figure IoU at the switch
Output: asset-source/v09_QA/metrics_v09.json and, unless --no-media, comparison sheets and videos in v09_QA/evidence/.
"""
import argparse, importlib.util, json, math, os, subprocess, sys, tempfile
sys.dont_write_bytecode = True
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(PROJECT, 'asset-source', 'v09_QA')
def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
A7 = _load('a7', os.path.join(PROJECT, 'asset-source', 'v07_NPC06', 'tools', 'analyze_v07.py')); A6 = A7.A6
W, H = A6.W, A6.H

def load(d):
    R = json.load(open(os.path.join(d, 'frames.json'))); fr = R['frames']
    ims = [Image.open(os.path.join(d, 'seq', f'{n:04d}.png')).convert('RGBA') for n in range(len(fr))]
    return R, fr, ims, [A6.silhouette(im) for im in ims]

def luma(im):
    a = np.asarray(im, dtype=np.float32); return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114

def bil(a, xs, ys):
    xs = np.clip(xs, 0, W - 1.001); ys = np.clip(ys, 0, H - 1.001); x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)

OFF = np.arange(-45, 45.01, .5); C0 = int(np.argmin(np.abs(OFF)))

def leg_profile(al, lu, f, s):
    """Width / luma / rim along one projected leg, 1 px steps from 30 % of the thigh to 75 % of the shin. Width is twice the
    distance from the leg axis to the outer edge (the side away from the other leg), so legs touching each other do not merge."""
    L = f['legs_px'][s]; o = 'R' if s == 'L' else 'L'; other = np.array([(f['legs_px'][o]['hip'][0] + f['legs_px'][o]['knee'][0]) / 2, 0.0]); hip, knee, ank = (np.array(L[k][:2], float) for k in ('hip', 'knee', 'ankle'))
    T, Ls = np.linalg.norm(knee - hip), np.linalg.norm(ank - knee); dt, ds = (knee - hip) / T, (ank - knee) / Ls
    rows = []
    for sv in np.arange(.3 * T, T + .75 * Ls, 1.0):
        if sv <= T: p = hip + dt * sv
        else: p = knee + ds * (sv - T)
        w = min(1, max(0, (sv - T + 8) / 16)); d = dt * (1 - w) + ds * w; d /= np.linalg.norm(d); n = np.array([-d[1], d[0]])
        xs, ys = p[0] + OFF * n[0], p[1] + OFF * n[1]; A = bil(al, xs, ys); solid = A >= 128
        c = C0
        if not solid[c]:
            near = [k for k in range(C0 - 8, C0 + 9) if solid[k]]
            if not near: rows.append((sv, None, None, None)); continue
            c = min(near, key=lambda k: abs(k - C0))
        l = c
        while l > 0 and solid[l - 1]: l -= 1
        r = c
        while r < len(OFF) - 1 and solid[r + 1]: r += 1
        side = 1 if (other[0] - p[0]) * n[0] < 0 else -1  # +n points away from the other leg when side == 1
        width = 2 * (OFF[r] if side == 1 else -OFF[l])
        rim = int(((A[max(0, l - 6):l] > 16) & (A[max(0, l - 6):l] < 240)).sum() + ((A[r + 1:r + 7] > 16) & (A[r + 1:r + 7] < 240)).sum())
        m0, m1 = l + int((r - l) * .2), r - int((r - l) * .2); LU = bil(lu, xs[m0:m1 + 1], ys[m0:m1 + 1]); rows.append((sv, width, float(LU.mean()) if len(LU) else None, rim))
    return T, Ls, rows

def leg_metrics(T, Ls, rows):
    sv = np.array([r[0] for r in rows]); wd = np.array([r[1] if r[1] is not None else np.nan for r in rows]); lu = np.array([r[2] if r[2] is not None else np.nan for r in rows])
    rim = np.array([r[3] if r[3] is not None else np.nan for r in rows])
    band = (sv >= T - .15 * T) & (sv <= T + .15 * Ls); tref = (sv >= .55 * T) & (sv <= .80 * T); sref = (sv >= T + .25 * Ls) & (sv <= T + .55 * Ls)
    wt, ws = np.nanmedian(wd[tref]), np.nanmedian(wd[sref])
    if not np.isfinite(wt) or not np.isfinite(ws) or np.isnan(wd[band]).any(): return None
    if np.nanmax(wd[band | tref | sref]) > 1.35 * max(wt, ws) or np.nanmin(wd[band | tref | sref]) < .5 * min(wt, ws): return {'merged': True}
    a0, a1 = T - .15 * T, T + .15 * Ls; exp = wt + (ws - wt) * np.clip((sv - a0) / (a1 - a0), 0, 1); ratio = wd / exp
    step = max(abs(wd[i + 3] - wd[i - 3]) for i in np.nonzero(band)[0] if 3 <= i < len(wd) - 3)
    dl = np.full(len(lu), np.nan); dl[2:-2] = np.abs(lu[4:] - lu[:-4]); ref = dl[tref | sref]; ref = ref[np.isfinite(ref)]
    bi = np.nonzero(band)[0]; fold_i = bi[int(np.nanargmin(lu[bi]))]; refl = np.nanmedian(lu[tref | sref])
    return {'merged': False, 'thigh_w': round(float(wt), 2), 'shin_w': round(float(ws), 2), 'neck': round(float(np.nanmin(ratio[band])), 3), 'bulge': round(float(np.nanmax(ratio[band])), 3),
            'step_px': round(float(step), 2), 'seam_ratio': round(float(np.nanmax(dl[band]) / max(1e-3, np.percentile(ref, 95))), 2), 'seam_luma': round(float(np.nanmax(dl[band])), 2),
            'fold_offset_px': round(float(sv[fold_i] - T), 1), 'fold_depth_luma': round(float(refl - lu[fold_i]), 2),
            'rim_band': round(float(np.nanmean(rim[band])), 2), 'rim_ref': round(float(np.nanmean(rim[tref | sref])), 2)}

def holes(al):
    solid = al >= 128; ys, xs = np.nonzero(solid); x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2); bg = ~solid[y0:ys.max() + 3, x0:xs.max() + 3]
    reach = np.zeros_like(bg); reach[0], reach[-1], reach[:, 0], reach[:, -1] = bg[0], bg[-1], bg[:, 0], bg[:, -1]
    while True:
        prev = reach.sum()
        for _ in range(16):
            nr = reach.copy(); nr[1:] |= reach[:-1]; nr[:-1] |= reach[1:]; nr[:, 1:] |= reach[:, :-1]; nr[:, :-1] |= reach[:, 1:]; reach = nr & bg
        if reach.sum() == prev: break
    hole = bg & ~reach; n = int(hole.sum())
    if not n: return 0, None
    hy, hx = np.nonzero(hole); return n, [int(hx.min() + x0), int(hy.min() + y0), int(hx.max() + x0), int(hy.max() + y0)]

def hem_gap(al, f, s, S):
    an = f['legs_px'][s]['ankle']; ft = f['feet_px'][s]; sole = max(ft['heel'][1], ft['toe'][1]); k = A6.project(f['feet_world'][s]['ankle'])[2]
    top = [an[0], sole - .108 * S * k + 2]
    if top[1] <= an[1]: return None
    return A7.axis_min_alpha(al, an, top, n=40)

def trouser(rgb, al, f):
    px = []
    for s in 'LR':
        kn, an = f['legs_px'][s]['knee'], f['legs_px'][s]['ankle']
        for t in np.linspace(.1, .8, 30):
            x, y = kn[0] + (an[0] - kn[0]) * t, kn[1] + (an[1] - kn[1]) * t
            for ox in range(-8, 9, 2):
                xi, yi = int(round(x + ox)), int(round(y))
                if 0 <= xi < W and 0 <= yi < H and al[yi, xi] >= 250: px.append(rgb[yi, xi])
    return A7.lab(np.array(px, float)).mean(0) if len(px) > 60 else None

def weave(lu, al, f):
    vals = []
    for s in 'LR':
        kn, an = f['legs_px'][s]['knee'], f['legs_px'][s]['ankle']; x0, x1 = int(min(kn[0], an[0]) - 6), int(max(kn[0], an[0]) + 6); y0, y1 = int(kn[1] + 6), int(an[1] - 6)
        if y1 - y0 < 8: continue
        sub = lu[y0:y1, x0:x1]; m = al[y0:y1, x0:x1] >= 250; lap = np.abs(4 * sub[1:-1, 1:-1] - sub[:-2, 1:-1] - sub[2:, 1:-1] - sub[1:-1, :-2] - sub[1:-1, 2:]); mm = m[1:-1, 1:-1] & m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
        if mm.sum() > 40: vals.append(float(lap[mm].std()))
    return float(np.mean(vals)) if vals else None

def torso_shift(A, B, box):
    """Horizontal shift of B against A inside box (luma), per third of the height: argmin of mean |A - shift(B)|, 0.25 px."""
    x0, y0, x1, y1 = box; out = []
    for k in range(3):
        ya, yb = y0 + (y1 - y0) * k // 3, y0 + (y1 - y0) * (k + 1) // 3; a = A[ya:yb, x0:x1]
        best = (1e9, 0)
        for dx in np.arange(-4, 4.01, .25):
            fl = int(math.floor(dx)); t = dx - fl; b = B[ya:yb, x0 + fl:x1 + fl] * (1 - t) + B[ya:yb, x0 + fl + 1:x1 + fl + 1] * t; e = float(np.abs(a - b).mean())
            if e < best[0]: best = (e, dx)
        out.append(round(float(best[1]), 2))
    return out

def stat(v):
    v = [x for x in v if x is not None]
    return {'n': len(v), 'min': round(float(min(v)), 3), 'median': round(float(np.median(v)), 3), 'p95': round(float(np.percentile(v, 95)), 3), 'max': round(float(max(v)), 3)} if v else None

VIEW_OF = lambda f: f['art']

def analyse(label, d, base):
    R, fr, ims, imgs = load(d); S = R['S']; al = [x[0].astype(np.float32) for x in imgs]; lus = [luma(im) for im in ims]; rgbs = [np.asarray(im)[..., :3] for im in ims]
    out = {'label': label, 'dir': os.path.relpath(d, PROJECT), 'art': R.get('art', 'v06'), 'suite': A7.suite(R, fr, ims, imgs, d)}
    legs = {'front': [], 'rear': []}; per_frame = []
    for n, f in enumerate(fr):
        if f['art'] == 'side': continue
        for s in 'LR':
            m = leg_metrics(*leg_profile(al[n], lus[n], f, s))
            if m is None: continue
            m.update({'n': n, 'seg': f['seg'], 'i': f['i'], 'side': s, 'flex': f['knee_flex_deg'][s]}); legs[f['art']].append(m)
    out['legs'] = {}
    for v, rows in legs.items():
        ok = [r for r in rows if not r['merged']]
        out['legs'][v] = {'legs': len(rows), 'merged_skipped': len(rows) - len(ok), **{k: stat([r[k] for r in ok]) for k in ('neck', 'bulge', 'step_px', 'seam_ratio', 'seam_luma', 'fold_offset_px', 'fold_depth_luma', 'rim_band', 'rim_ref')},
                          'worst_step': sorted(ok, key=lambda r: -r['step_px'])[:5], 'worst_seam': sorted(ok, key=lambda r: -r['seam_ratio'])[:5], 'worst_neck': sorted(ok, key=lambda r: r['neck'])[:5]}
    hl = [(n, *holes(np.asarray(imgs[n][0]))) for n in range(len(fr))]; seg = {}
    for n, a_, _ in hl:
        k = f"{fr[n]['seg']}/{fr[n]['art']}"; q = seg.setdefault(k, {'frames': 0, 'with_holes': 0, 'px': 0, 'max_px': 0}); q['frames'] += 1; q['px'] += a_; q['max_px'] = max(q['max_px'], a_); q['with_holes'] += a_ >= 2
    out['holes'] = {'frames_with_holes': [[n, a, b] for n, a, b in hl if a >= 2], 'total_px': sum(a for _, a, _ in hl), 'by_segment': seg}
    hg = [(n, s, hem_gap(imgs[n][0], f, s, S)) for n, f in enumerate(fr) if f['art'] != 'side' for s in 'LR']; hg = [x for x in hg if x[2] is not None]
    out['hem_shoe'] = {'probes': len(hg), 'gaps': [[n, s, v] for n, s, v in hg if v < 128], 'min_alpha': min(v for _, _, v in hg) if hg else None}
    out['switches'] = [r for r in out['suite']['seams'] if r['from'].split('(')[1] != r['to'].split('(')[1]]
    for r in out['switches']:
        n = r['at']; box = A6.crop_union([imgs[n - 1][2]['box'], imgs[n][2]['box']], (0, 0, 0, 0)); r['figure_iou'] = A7.iou_box(imgs[n - 1][0], imgs[n][0], box)
    if base is not None:
        bfr, bims, blus, brgbs, bal = base; tr, wv, tor, chg = [], [], [], []
        for n, f in enumerate(fr):
            if f['art'] == 'side': continue
            a, b = trouser(rgbs[n], np.asarray(imgs[n][0]), f), trouser(brgbs[n], np.asarray(bal[n]), bfr[n])
            if a is not None and b is not None: tr.append(float(np.linalg.norm(a - b)))
            x, y = weave(lus[n], np.asarray(imgs[n][0]), f), weave(blus[n], np.asarray(bal[n]), bfr[n])
            if x and y: wv.append(x / y)
            box = A7.torso_box(f); hw = (box[2] - box[0]) / 2; cx = (box[0] + box[2]) / 2
            # the half away from the bag (figure's L: screen right in front, screen left in rear), so the strap does not count as torso motion
            box = (box[0], box[1], int(cx + .1 * hw), box[3]) if f['art'] == 'front' else (int(cx - .1 * hw), box[1], box[2], box[3])
            if f['seg'] in ('enter', 'exit', 'idle') or n in (112, 121, 142, 151):
                if f['seg'] in ('enter', 'exit') and f['i'] % 4: pass
                else: tor.append({'n': n, 'seg': f['seg'], 'yaw_deg': round((f.get('material09') or f.get('material09r') or {}).get('shoulder_yaw_deg', 0), 3), 'shift_px_top_mid_low': torso_shift(blus[n], lus[n], box)})
            x0, y0, x1, y1 = box; chg.append(float(np.abs(rgbs[n][y0:y1, x0:x1].astype(float) - brgbs[n][y0:y1, x0:x1]).mean()))
        out['vs_baseline'] = {'trouser_delta_e76': stat(tr), 'weave_ratio': stat(wv), 'torso_mean_abs_rgb': stat(chg),
                              'torso_shift': {'rows': tor, 'max_abs_px': max(abs(v) for r in tor for v in r['shift_px_top_mid_low']) if tor else None}}
    return out, (fr, ims, lus, rgbs, [x[0] for x in imgs])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--run', action='append', required=True); ap.add_argument('--ffmpeg'); ap.add_argument('--no-media', action='store_true'); ap.add_argument('--out', default=OUT)
    a = ap.parse_args(); runs = [r.split('=', 1) for r in a.run]; res, keep, base = [], {}, None
    for label, d in runs:
        m, k = analyse(label, os.path.abspath(d), base); res.append(m); keep[label] = (d, k)
        if base is None: base = k
        print(label, json.dumps({v: {kk: m['legs'][v][kk] for kk in ('neck', 'bulge', 'step_px', 'seam_ratio', 'fold_offset_px', 'rim_band')} for v in m['legs']}, ensure_ascii=False))
    os.makedirs(a.out, exist_ok=True); json.dump({'npc': 'NPC06', 'baseline': runs[0][0], 'runs': res}, open(os.path.join(a.out, 'metrics_v09.json'), 'w'), ensure_ascii=False, indent=1)
    if not a.no_media:
        _media = _load('media09', os.path.join(HERE, 'tools', 'media_v09.py')); _media.media(keep, a.ffmpeg, os.path.join(a.out, 'evidence'))

if __name__ == '__main__':
    main()
