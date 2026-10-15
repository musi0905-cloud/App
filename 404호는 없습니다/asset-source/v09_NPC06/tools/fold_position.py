#!/usr/bin/env python3
"""Where the added knee fold shading sits against the projected knee (real pixels, not the code's intent).

  python3 -B -I tools/fold_position.py <render with folds> <same render with fold strength 0>

The second render is the same code with the fold lobes' strength set to 0 (made in a temporary copy of v09_NPC06 outside
the repository; nothing else differs, so the luma difference between the two is the fold alone). For every front/rear leg
bent >= 35 deg: along the leg line (hip -> knee -> ankle from frames.json), 30 % of the thigh above the knee to 30 % of
the shin below it, the mean luma difference across the middle 12 px; the darkest point is the fold, reported as px from
the projected knee (negative = above), with its depth and the lightest point.
"""
import sys, json, importlib.util, os
sys.dont_write_bytecode = True
import numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('a9', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'analyze_v09.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
A, B = sys.argv[1:3]; R = json.load(open(os.path.join(A, 'frames.json'))); out = {'front': [], 'rear': []}
for n, f in enumerate(R['frames']):
    if f['art'] == 'side': continue
    for s in 'LR':
        if f['knee_flex_deg'][s] < 35: continue
        la = m.luma(Image.open(f'{A}/seq/{n:04d}.png').convert('RGB')); lb = m.luma(Image.open(f'{B}/seq/{n:04d}.png').convert('RGB'))
        L = f['legs_px'][s]; hip, knee, ank = (np.array(L[k][:2]) for k in ('hip', 'knee', 'ankle')); T = np.linalg.norm(knee - hip); Ls = np.linalg.norm(ank - knee); prof = []
        for sv in np.arange(T - .3 * T, T + .3 * Ls, .5):
            p = hip + (knee - hip) * sv / T if sv <= T else knee + (ank - knee) * (sv - T) / Ls; d = (knee - hip) / T if sv <= T else (ank - knee) / Ls; nn = np.array([-d[1], d[0]])
            off = np.arange(-6, 6.1, 1.0); xs, ys = p[0] + off * nn[0], p[1] + off * nn[1]; prof.append((sv - T, float((m.bil(la, xs, ys) - m.bil(lb, xs, ys)).mean())))
        prof = np.array(prof); i = int(np.argmin(prof[:, 1])); j = int(np.argmax(prof[:, 1]))
        out[f['art']].append({'n': n, 'side': s, 'flex': f['knee_flex_deg'][s], 'dark_px': round(prof[i, 0], 1), 'dark_luma': round(prof[i, 1], 2), 'light_px': round(prof[j, 0], 1), 'light_luma': round(prof[j, 1], 2)})
res = {}
for v, rows in out.items():
    o = [r['dark_px'] for r in rows]; a = [r['dark_luma'] for r in rows]
    res[v] = {'legs': len(rows), 'dark_fold_px_from_knee': {'median': float(np.median(o)), 'min': min(o), 'max': max(o)}, 'darkening_luma': {'median': float(np.median(a)), 'strongest': min(a)}, 'light_px_median': float(np.median([r['light_px'] for r in rows]))}
print(json.dumps(res, ensure_ascii=False))
