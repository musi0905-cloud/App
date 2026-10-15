#!/usr/bin/env python3
"""NPC06 v07 experimental binding (2026-10-14): import check of the producer's sheets and the binding data that
render_v06.js reads with --art=v07. Only NPC06; v06 and its inputs are not touched.

  python3 -I tools/build_binding_v07.py        (from asset-source/v07_NPC06)

Writes IMPORT_v07.json (hash/format check of the six delivered PNGs against the producer manifest) and binding_v07.json.
Only the three v07b sheets are bound; the v07a drafts are checked and kept for comparison, never read by the renderer.

Every value in binding_v07.json says how it was obtained:
  measured   from the sheet pixels (alpha > 128 silhouettes; alpha itself is never changed, binarised or rescaled)
  rig        from the NPC06 rig and config (walk_rig_elder_v04.json, height 1.55 m)
  v06        a convention of render_v06.js reused unchanged (leg top 7.5 % of the thigh above the hip, leg end 0.077*S above
             the sole, torso width .425*S, height .57*S, pivot at 85 % of the torso height)
  estimated  inferred from the picture; not a joint the art marks (knee positions, the torso turn, the leg sides)
  nominal    the producer's prompt targets (knee 30 / 60 deg, torso +-8 deg): not measured, used only to name the states
The manifest bboxes are detection boxes, not pivots: they are compared with our own detection and not used as joints.
"""
import hashlib, json, math, os, sys
import numpy as np
from PIL import Image
sys.dont_write_bytecode = True; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'source')
V05 = os.path.join(PROJECT, 'asset-source', 'v05_QA', 'code', 'NPC06')
J = lambda p: json.load(open(p, encoding='utf-8'))
SHEETS = {'front_leg': 'NPC06_정면다리_깊이수정_v07b.png', 'rear_leg': 'NPC06_후면다리_경계검토_v07b.png', 'torso': 'NPC06_몸통회전_단추수정_v07b.png'}
DRIVE = {'NPC06_v07_asset_manifest.json': '1cWzGigiGQPAFX_rfEEk2DpSGR7gcf224', 'NPC06_v07_검수와후속작업.md': '12_hnTdh2BdzRvpkKBj9OdUh68zKmW76N',
         'NPC06_v07_prompts.json': '1KqZkh3LRKw2d_UBVy80kCwdbn5lnIrai', 'NPC06_정면다리_깊이수정_v07b.png': '1I9YdkEy0PgPxxsqp_a6JpBN9bC1COQ1d',
         'NPC06_후면다리_경계검토_v07b.png': '1pzVGMOFOWj0aVOC10Hm2zlM_HlwRU3y6', 'NPC06_몸통회전_단추수정_v07b.png': '1K3vETUxbuwM4LcqIgdCOVmUDF-CgpIYD',
         'NPC06_정면다리_초안_v07a.png': '1SS2d1qFdPwxsLBFB0KZu00z5jKx9t9GO', 'NPC06_후면다리_초안_v07a.png': '17pr12Wp5gbDK6zuyRJq2A5k06ykUgA0-',
         'NPC06_몸통회전_초안_v07a.png': '1fKI1PorroD7MwUAgaT6w4YChv09AIy7N'}

PAD = 8  # transparent margin kept around each part (sheet gaps are >= 40 px, so no neighbour is cut in)

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def import_check(man):
    rows = []
    for r in man['records']:
        p = os.path.join(SRC, r['file']) if 'v07b' in r['file'] else os.path.join(SRC, 'draft_v07a', r['file'])
        im = Image.open(p); im.load(); a = np.asarray(im.convert('RGBA')); al = a[..., 3]
        comps = sorted([c for c in cc.label(al > 128) if c['px'] >= 1000], key=lambda c: c['bbox_xywh'])
        rows.append({'file': os.path.relpath(p, HERE), 'drive_id': DRIVE[r['file']], 'role': 'candidate (bound)' if 'v07b' in r['file'] else 'draft, comparison only (not bound)',
                     'bytes': os.path.getsize(p), 'sha256': sha(p), 'sha256_manifest': r['sha256'], 'sha256_ok': sha(p) == r['sha256'], 'bytes_ok': os.path.getsize(p) == r['bytes'],
                     'decoded': True, 'size': list(im.size), 'mode': im.mode, 'alpha_max': int(al.max()), 'alpha_255_px': int((al == 255).sum()),
                     'alpha_zero_percent': round(100 * float((al == 0).mean()), 3), 'alpha_zero_percent_manifest': r['alpha_zero_percent'],
                     'transparent_px_with_rgb': int((a[..., :3][al == 0].max(axis=1) > 0).sum()),
                     'components_alpha_gt128': len(comps), 'components_manifest': len(r['parts']),
                     'bbox_equal_to_manifest': sorted(c['bbox_xywh'] for c in comps) == sorted(q['bbox_px'] for q in r['parts'])})
    docs = [{'file': f'source/{f}', 'drive_id': DRIVE[f], 'bytes': os.path.getsize(os.path.join(SRC, f)), 'sha256': sha(os.path.join(SRC, f))}
            for f in ('NPC06_v07_asset_manifest.json', 'NPC06_v07_prompts.json', 'NPC06_v07_검수와후속작업.md')]
    return rows, docs

def parts_of(man, fn):
    r = [q for q in man['records'] if q['file'] == fn][0]
    return sorted(r['parts'], key=lambda q: (q['row'], q['column']))

def silhouette(a):
    m = a[..., 3] > 128; ys = np.where(m.any(1))[0]; y0, y1 = int(ys[0]), int(ys[-1])
    rows = {y: np.where(m[y])[0] for y in range(y0, y1 + 1)}
    return m, y0, y1, rows

def edge_centre(rows, ys):
    xs = np.concatenate([rows[y] for y in ys if len(rows[y])]); return float(xs.mean())

def leg_part(sheet, q, row_side, col_state):
    x, y, w, h = q['bbox_px']; H, W = sheet.shape[:2]
    crop = [max(0, x - PAD), max(0, y - PAD), min(W, x + w + PAD) - max(0, x - PAD), min(H, y + h + PAD) - max(0, y - PAD)]
    a = sheet[y:y + h, x:x + w]; m, y0, y1, rows = silhouette(a); band = max(3, int((y1 - y0) * .03))
    top = (x + edge_centre(rows, range(y0, y0 + band)), y + y0); bot = (x + edge_centre(rows, range(y1 - band + 1, y1 + 1)), y + y1 + 1)
    # centreline: middle of the silhouette per row; knee estimate = its largest sideways departure from the top-cuff line
    ys = np.arange(y0, y1 + 1); mid = np.array([(rows[v][0] + rows[v][-1]) / 2 for v in ys]) + x
    t = (ys - y0) / max(1, y1 - y0); line = top[0] + (bot[0] - top[0]) * t; dev = mid - line; k = int(np.argmax(np.abs(dev)))
    widths = np.array([rows[v][-1] - rows[v][0] + 1 for v in ys])
    return {'sheet_row': q['row'], 'sheet_col': q['column'], 'side': row_side, 'state': col_state, 'manifest_bbox_xywh': q['bbox_px'],
            'crop_xywh': crop, 'crop_note': f'alpha>128 box + {PAD} px transparent margin, sheet coordinates (trim offset = crop x,y); pixels drawn as delivered',
            'top_attach': {'xy': [round(top[0], 1), top[1]], 'how': 'measured: centre of the top 3% of the silhouette rows'},
            'cuff_attach': {'xy': [round(bot[0], 1), bot[1]], 'how': 'measured: centre of the bottom 3% of the silhouette rows (cuff hem)'},
            'length_px': y1 - y0 + 1, 'top_to_cuff_px': round(math.hypot(bot[0] - top[0], bot[1] - top[1]), 1),
            'cuff_sideways_px': round(bot[0] - top[0], 1), 'cuff_sideways_rel': round((bot[0] - top[0]) / (y1 - y0 + 1), 3),
            'centreline_max_sideways_px': round(float(dev[k]), 1), 'centreline_max_sideways_rel': round(float(dev[k]) / (y1 - y0 + 1), 3),
            'knee': {'xy': [round(float(mid[k]), 1), int(y + ys[k])], 'how': 'estimated: largest sideways departure of the silhouette centreline' if abs(dev[k]) > 6 else 'estimated: no visible bend, placed at the thigh fraction of the length'},
            'width_px': {'top': int(np.median(widths[:5])), 'thigh_max': int(widths[:len(widths) // 2].max()), 'mid': int(np.median(widths[len(widths) // 2 - 2:len(widths) // 2 + 3])), 'cuff': int(np.median(widths[-5:]))}}

def torso_part(sheet, q, view, cell):
    x, y, w, h = q['bbox_px']; H, W = sheet.shape[:2]
    crop = [max(0, x - PAD), max(0, y - PAD), min(W, x + w + PAD) - max(0, x - PAD), min(H, y + h + PAD) - max(0, y - PAD)]
    a = sheet[y:y + h, x:x + w].astype(float); m, y0, y1, rows = silhouette(a); hh = y1 - y0 + 1
    yp = y0 + int(.85 * hh); sil = (rows[yp][0] + rows[yp][-1]) / 2
    xa, xb = int(w * .2), int(w * .8); top = lambda c: int(np.where(m[:, c])[0][0]); tilt = math.degrees(math.atan2(top(xb) - top(xa), xb - xa))
    # garment centre (front: the light shirt band between the cardigan fronts at 35-80 % height; rear: the collar at 2-8 %)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; light = m & (np.maximum(np.maximum(r, g), b) > 200) & ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 35)
    offs = []
    for f in ((.35, .5, .65, .8) if view == 'front' else (.02, .05, .08)):
        yy = y0 + int(f * hh); xs = rows[yy]; lx = np.where(light[max(0, yy - 3):yy + 4].any(0))[0]
        if not len(lx): continue
        runs = np.split(lx, np.where(np.diff(lx) > 3)[0] + 1); band = max(runs, key=len)
        offs.append(((band[0] + band[-1]) / 2 - (xs[0] + xs[-1]) / 2) / ((xs[-1] - xs[0]) / 2))
    off = float(np.mean(offs))
    # Which shoulder is nearer, from the garment centre: front (facing the camera) a centre moved to screen right means the
    # person's right shoulder came forward; rear (facing away) a centre moved to screen left means the left shoulder came forward.
    fwd = ('R' if off > 0 else 'L') if view == 'front' else ('L' if off < 0 else 'R')
    # implied turn for an elliptic chest of half-depth/half-width ratio q: offset = q sin / sqrt(cos^2 + q^2 sin^2)
    implied = {str(qr): round(math.degrees(math.atan(abs(off) / qr / math.sqrt(max(1e-9, 1 - off * off)))), 1) for qr in (.7, 1.0)}
    return {'sheet_row': q['row'], 'sheet_col': q['column'], 'view': view, 'cell': cell, 'manifest_bbox_xywh': q['bbox_px'], 'crop_xywh': crop,
            'prompt_label': ('left' if q['column'] == 0 else 'right') + '-shoulder-forward (nominal 8 deg)',
            'neck_top': {'xy': [round(x + edge_centre(rows, range(y0, y0 + 4)), 1), y + y0], 'how': 'measured: top edge centre (collar)'},
            'hem_bottom_y': y + y1 + 1, 'height_px': hh,
            'anchor': {'xy': [round(x + sil, 1), y + yp], 'how': 'v06 pivot height (85 % of the torso height from the top); x = silhouette centre at that height, measured'},
            'width_px': {'max': int(max(len(rows[v]) and rows[v][-1] - rows[v][0] + 1 for v in rows)), 'at_anchor': int(rows[yp][-1] - rows[yp][0] + 1)},
            'baked_shoulder_tilt_deg': {'value': round(tilt, 2), 'how': 'measured: top silhouette row at 20 % and 80 % of the cell width (shoulders are rounded: approximate)'},
            'garment_centre_offset_halfwidth': {'value': round(off, 3), 'how': 'measured: ' + ('shirt band between the cardigan fronts' if view == 'front' else 'collar') + ' centre minus silhouette centre, over the half width'},
            'shoulder_forward': {'value': fwd, 'how': 'estimated from the garment centre offset (geometry of a turned body seen ' + view + ')'},
            'implied_turn_deg': {'value': implied, 'how': 'estimated: elliptic chest, half-depth/half-width 0.7 or 1.0; not a measurement of the drawn 3D turn'}}

def mask_iou(a, b):
    H = max(a.shape[0], b.shape[0]); W = max(a.shape[1], b.shape[1]); A = np.zeros((H, W), bool); B = A.copy(); A[:a.shape[0], :a.shape[1]] = a; B[:b.shape[0], :b.shape[1]] = b
    return round(float((A & B).sum() / (A | B).sum()), 3)

def main():
    man = J(os.path.join(SRC, 'NPC06_v07_asset_manifest.json')); rows, docs = import_check(man)
    ok = all(r['sha256_ok'] and r['bytes_ok'] and r['size'] == [1536, 1024] and r['mode'] == 'RGBA' and r['components_alpha_gt128'] == r['components_manifest'] and r['bbox_equal_to_manifest'] for r in rows)
    json.dump({'generated_by': 'asset-source/v07_NPC06/tools/build_binding_v07.py', 'date': '2026-10-14', 'drive_folder': '1gMILNQsB8yY7VBo2oFHRml7BYYDca8cA',
               'result': 'ALL_MATCH' if ok else 'MISMATCH', 'files': rows, 'docs': docs,
               'note': 'Format check only (hash, decode, size, mode, alpha>128 components). It is not a visual or motion pass. Alpha is kept as delivered (max 254, no 255 px); '
                       'colour left in alpha=0 pixels is invisible after correct compositing and is not treated as background.'},
              open(os.path.join(HERE, 'IMPORT_v07.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not ok: raise SystemExit('import check failed')
    cfg = J(os.path.join(V05, 'config.json')); rig = J(os.path.join(V05, cfg['rig_path'])); S = cfg['height_m'] / 1.725
    j0 = rig['frames'][0]['joints']; T = math.dist(j0['Lhip'], j0['Lknee']) * S; L = math.dist(j0['Lknee'], j0['Lankle']) * S
    flat = next(f['joints'] for f in rig['frames'] if f['joints']['Lheel'][1] <= .002 and f['joints']['Ltoe'][1] <= .002); ankleY = flat['Lankle'][1] * S
    yaw = [math.degrees(math.atan2(f['joints']['Lshoulder'][0] - f['joints']['Rshoulder'][0], f['joints']['Rshoulder'][2] - f['joints']['Lshoulder'][2])) for f in rig['frames']]
    # straight leg drawn from 7.5 % of the thigh above the hip (v06 overlap under the pelvis) to 0.077*S above the sole (v06 leg end on the shoe)
    straight_world = 1.075 * T + L + ankleY - .077 * S
    out = {'generated_by': 'asset-source/v07_NPC06/tools/build_binding_v07.py', 'date': '2026-10-14', 'npc': 'NPC06', 'status': 'EXPERIMENT (not game data)',
           'renderer': 'asset-source/v06_render/render_v06.js --art=v07', 'sheets': {k: f'asset-source/v07_NPC06/source/{v}' for k, v in SHEETS.items()},
           'not_bound': ['source/draft_v07a/* (v07a drafts: comparison only)'],
           'kept_from_v06': ['head', 'pelvis', 'arms (continuous_arms_v03)', 'hands', 'shoes', 'shoulder bag', 'side view (no v07 side art)', 'torso in neutral frames (atlas torso)'],
           'rig': {'file': f"asset-source/v05_QA/code/NPC06/{cfg['rig_path']}", 'S': S, 'thigh_m': round(T, 4), 'shin_m': round(L, 4), 'ankle_height_flat_m': round(ankleY, 4),
                   'shoulder_yaw_deg_range': [round(min(yaw), 2), round(max(yaw), 2)], 'shoulder_yaw_note': 'rig: angle of the shoulder line in the floor plane, + = left shoulder forward'}}
    sheet = {k: np.asarray(Image.open(os.path.join(SRC, v)).convert('RGBA')) for k, v in SHEETS.items()}
    legs = {}
    for view in ('front', 'rear'):
        key = view + '_leg'; ps = [leg_part(sheet[key], q, ['L', 'R'][q['row']], ['straight', 'knee30', 'knee60'][q['column']]) for q in parts_of(man, SHEETS[key])]
        st = [p for p in ps if p['state'] == 'straight']; Lpx = float(np.mean([p['top_to_cuff_px'] for p in st]))
        thigh_w = float(np.mean([p['width_px']['thigh_max'] for p in st]))
        sy = straight_world / Lpx; sx = .185 * S / thigh_w
        for p in ps:
            k = p['knee']
            if 'no visible bend' in k['how']:
                f = 1.075 * T / straight_world; k['xy'] = [round(p['top_attach']['xy'][0] + f * (p['cuff_attach']['xy'][0] - p['top_attach']['xy'][0]), 1), int(p['top_attach']['xy'][1] + f * p['length_px'])]
            p['straight_length_error_rel'] = round(p['top_to_cuff_px'] / Lpx - 1, 4) if p['state'] == 'straight' else None
            p['projected_length_ratio_to_straight'] = round(p['top_to_cuff_px'] / Lpx, 3)
        legs[view] = {'sheet': out['sheets'][key], 'parts': ps,
                      'scale': {'m_per_px_y': round(sy, 7), 'm_per_px_x': round(sx, 7), 'x_over_y_world_estimate': round(sx / sy, 3),
                                'y_rule': 'render_v06.js v07Calibrate: one y scale per sheet, set before drawing from standing frames (front: the 48 idle frames; rear: '
                                          'the last turn frame), so that the straight state\'s mean top-to-cuff length equals the mean v06 leg-top-to-leg-end screen distance there. '
                                          'The value used is written to frames.json v07_calibration.',
                                'm_per_px_y_is': 'world estimate, superseded (kept for the record, see method_change)',
                                'x_rule': f'v06 thigh width .185*S over the straight states\' widest thigh row ({thigh_w:.1f} px), the same for all six states. The art is drawn about '
                                          f'{sy / sx:.2f}x wider (world estimate) than the v06 trouser legs at one uniform scale; v05/v06 also drew the atlas legs non-uniformly, '
                                          'and a uniform scale would put the thighs outside the pelvis art.',
                                'method_change': {'before': f'y from world bone lengths (straight top-to-cuff {Lpx:.1f} px = {straight_world:.4f} m: 1.075*T + shin + ankle height '
                                                            '- 0.077*S), as if the v06 leg end were straight under the ankle',
                                                  'why': 'the v06 leg end is on the projected toe line 0.077*S above the sole (render_v06.js leg(): end = ankle x, lowest of heel/toe '
                                                         'y - .077*S*scale); in the front view the toe is nearer the camera, so the screen leg is longer than the world bones say',
                                                  'after': 'calibrated per sheet on standing frames (y_rule)',
                                                  'result': 'idle cuff gap with the top anchor: before L 34.31 / R 26.66 px, after L 4.29 / R -4.25 px (fresh renders r1 and r2)'}},
                      'side_mapping': {'top_row': 'L', 'bottom_row': 'R', 'how': 'nominal (prompt: top row anatomical left). The art carries no side marker (no fly, '
                                       'pocket or seam that fixes the side); see side_evidence'}}
    # side evidence: on which side of the body midline each bent knee goes when the rows are mapped as intended
    for view in ('front', 'rear'):
        ev = {}
        for p in legs[view]['parts']:
            if p['state'] == 'straight': continue
            dx = p['centreline_max_sideways_px']; screen = 'screen-right' if dx > 0 else 'screen-left'
            # front: the person's left leg is on screen right, so its midline is screen-left; rear: the left leg is on screen left
            mid = ('screen-left' if p['side'] == 'L' else 'screen-right') if view == 'front' else ('screen-right' if p['side'] == 'L' else 'screen-left')
            ev[f"{p['side']}.{p['state']}"] = {'knee_departs_px': dx, 'toward': screen, 'relative_to_midline_with_nominal_rows': 'inward' if screen == mid else 'outward'}
        legs[view]['side_evidence'] = {'knee_sideways': ev, 'reading': 'With the nominal rows both bent states of both legs move the knee sideways in the picture plane toward the '
                                       'body midline; with the rows swapped they would move outward. Either way the bend is sideways on screen, not in depth, so the side mapping '
                                       'does not change the verdict. Nominal mapping kept.'}
    out['legs'] = legs
    out['leg_state_rule'] = {'how': 'rig knee flexion of that leg in that frame (render_v06.js flexDeg on the world pose): straight below 15 deg, knee30 from 15 to below 45, '
                                    'knee60 from 45. Thresholds are halfway between the nominal state names; the art angles themselves are not measured.',
                             'straight_below_deg': 15, 'knee60_from_deg': 45,
                             'no_double_bend': 'the state picture is placed rigidly (fixed scale, turned so its top-to-cuff line lies on the line from the v06 leg top to the v06 '
                                               'leg end): the rig knee is not bent again on top of the drawn bend, and no picture is stretched to fit a frame.',
                             'anchor': {'used': 'cuff', 'how': 'cuff attach on the v06 leg end on the shoe; the top slides along the leg line under the pelvis piece; the shortfall '
                                                               '(+) or overrun (-) at the top is recorded per frame (frames.json v07.legs.*.top_gap_px)',
                                        'first_attempt': {'anchor': 'top', 'result': 'top attach pinned on the v06 leg top: the cuff missed the shoe. Walk legs with a visible hole between '
                                                          'cuff and shoe: front 52/96, rear 30/96; rear cuff below the sole (v06 contact criterion fails, sole row max +10.2 px). '
                                                          'Kept as --v07-anchor=top and v07_QA/NPC06/attempt_top_anchor/.'},
                                        'why_cuff': 'it keeps the v06 ground contact that already passed (cuff on the shoe in every frame) and puts the length mismatch under the '
                                                    'pelvis, where it is covered (0 holes at the top in 390 legs)'}}
    tp = [torso_part(sheet['torso'], q, ['front', 'rear'][q['row']], ['left_cell', 'right_cell'][q['column']]) for q in parts_of(man, SHEETS['torso'])]
    front = [p for p in tp if p['view'] == 'front']; Hpx = float(np.mean([p['height_px'] for p in front]))
    sy = .57 * S / Hpx; sx = sy * (.425 / 162) / (.57 / 204)
    m = {v: {c: (np.asarray(Image.open(os.path.join(SRC, SHEETS['torso'])).convert('RGBA'))[..., 3] > 128)[p['manifest_bbox_xywh'][1]:p['manifest_bbox_xywh'][1] + p['manifest_bbox_xywh'][3],
                                                                                                       p['manifest_bbox_xywh'][0]:p['manifest_bbox_xywh'][0] + p['manifest_bbox_xywh'][2]]
              for c, p in ((p['cell'], p) for p in tp if p['view'] == v)} for v in ('front', 'rear')}
    out['torso'] = {'sheet': out['sheets']['torso'], 'cells': tp,
                    'scale': {'m_per_px_y': round(sy, 7), 'm_per_px_x': round(sx, 7), 'how': 'v06: front cells\' mean height (neck to hem, %.1f px) = the v06 torso height .57*S; x/y as v06 draws the atlas torso (.425*S over 162 px, .57*S over 204 px); one pair for all four cells' % Hpx},
                    'mirror_check': {v: {'iou_same': mask_iou(m[v]['left_cell'], m[v]['right_cell']), 'iou_mirrored': mask_iou(m[v]['left_cell'], m[v]['right_cell'][:, ::-1])} for v in ('front', 'rear')},
                    'neutral': 'the v06 atlas torso (unchanged) in frames whose shoulder turn is under the threshold',
                    'tilt': 'each cell is drawn at (v06 shoulder-line angle - its baked shoulder tilt), so the counter-roll is not applied twice'}
    sel = {c['view'] + '.' + c['shoulder_forward']['value']: c['cell'] for c in tp}
    ymax = max(abs(v) for v in yaw)
    out['torso_state_rule'] = {'cell_for_forward_shoulder': sel,
                               'how': 'by the rig shoulder turn of the frame (+ = left shoulder forward), on front/rear walk frames (enter, exit; not settle/idle/turn/start, whose turn is 0 by construction)',
                               'nearest_nominal': {'threshold_deg': 4.0, 'frames_selected': 0, 'note': f'nearest of -8/0/+8 deg: the rig turns at most {ymax:.2f} deg, so the variants are never chosen'},
                               'stride_rule_rendered': {'threshold_deg': round(ymax / 2, 3), 'note': 'the v06 request asks for variants "the renderer can blend over the stride": a variant while the rig turn is past half its range, '
                                                        'neutral otherwise. This shows the art in motion; it exaggerates the rig turn (the art\'s implied turn is several times the rig\'s).'}}
    json.dump(out, open(os.path.join(HERE, 'binding_v07.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for v in ('front', 'rear'):
        print(v, 'scale', legs[v]['scale']['m_per_px_y'], legs[v]['scale']['m_per_px_x'], 'x/y', legs[v]['scale']['x_over_y_world_estimate'])
        for p in legs[v]['parts']: print('  ', p['side'], p['state'], 'len', p['top_to_cuff_px'], 'ratio', p['projected_length_ratio_to_straight'], 'cuff side', p['cuff_sideways_px'], 'knee dev', p['centreline_max_sideways_px'], p['knee'])
        print('  ', legs[v]['side_evidence']['knee_sideways'])
    for c in tp: print(c['view'], c['cell'], c['prompt_label'], '->', c['shoulder_forward']['value'], 'fwd', c['garment_centre_offset_halfwidth']['value'], c['implied_turn_deg']['value'], 'tilt', c['baked_shoulder_tilt_deg']['value'], 'anchor', c['anchor']['xy'], 'h', c['height_px'])
    print(out['torso']['scale'], out['torso']['mirror_check'], out['torso_state_rule']['cell_for_forward_shoulder'])

if __name__ == '__main__':
    main()
