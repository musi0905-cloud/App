"""Evidence media for analyze_v09.py (imported by it, not run alone): BG02 composites with the renderer's own contact
shadows, every run side by side in the order given (baseline first). Nothing here feeds a verdict number.

  compare_seq_24fps.mp4 / compare_seq_12fps.mp4   enter -> settle -> idle -> turn -> start -> exit, real speed and 0.5x
  side_pass_24fps.mp4 / side_pass_12fps.mp4       the 48-frame side walk (identical in every run: one panel)
  legs_seq_12fps.mp4                              the legs only, 2x, 0.5x speed (knee line / notch in motion)
  legs_front.jpg / legs_rear.jpg                  knee close-ups, magenta tick = projected knee, cyan = rig leg line
  shoulders_front.jpg / shoulders_rear.jpg        sleeve top and bag strap, background enclosed by the figure in magenta
  switch_turn.jpg                                 the two picture switches of the turn (front -> side -> rear)
"""
import os, subprocess, tempfile, json
import numpy as np
from PIL import Image, ImageDraw

def _a6():
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__)); project = os.path.dirname(os.path.dirname(os.path.dirname(here)))
    spec = importlib.util.spec_from_file_location('a6m', os.path.join(project, 'room404', 'scripts', 'analyze-v06-frames.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def holemask(al):
    solid = al >= 128; ys, xs = np.nonzero(solid); x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2); bg = ~solid[y0:ys.max() + 3, x0:xs.max() + 3]
    reach = np.zeros_like(bg); reach[0], reach[-1], reach[:, 0], reach[:, -1] = bg[0], bg[-1], bg[:, 0], bg[:, -1]
    while True:
        p = reach.sum()
        for _ in range(16):
            nr = reach.copy(); nr[1:] |= reach[:-1]; nr[:-1] |= reach[1:]; nr[:, 1:] |= reach[:, :-1]; nr[:, :-1] |= reach[:, 1:]; reach = nr & bg
        if reach.sum() == p: break
    h = np.zeros_like(solid); h[y0:ys.max() + 3, x0:xs.max() + 3] = bg & ~reach; return h

def encode(ff, frames, fps, path):
    with tempfile.TemporaryDirectory() as td:
        for i, im in enumerate(frames): im.convert('RGB').save(os.path.join(td, f'{i:04d}.png'))
        subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(td, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path], check=True)

def media(keep, ff, out):
    A6 = _a6(); os.makedirs(out, exist_ok=True); base = A6.bg02(); fnt = A6.font(15); small = A6.font(12)
    labels = list(keep); runs = {k: v[1] for k, v in keep.items()}; fr = runs[labels[0]][0]; n = len(fr)
    comp = lambda k, i: A6.comp(base, runs[k][1][i], fr[i]['shadows'])  # composed on demand: 3 runs x 215 frames do not fit in memory
    boxes = [A6.silhouette(runs[labels[0]][1][i])[2]['box'] for i in range(n)]; box = A6.crop_union(boxes, (40, 30, 40, 30))
    def panel_row(i, crop, scale, title=True):
        tiles = []
        for k in labels:
            t = comp(k, i).crop(crop); t = t.resize((round(t.width * scale), round(t.height * scale)), Image.LANCZOS)
            if title: d = ImageDraw.Draw(t); d.rectangle([0, 0, t.width, 20], fill=(0, 0, 0, 160)); d.text((4, 2), f"{k} · {fr[i]['seg']} {fr[i]['i']} · {fr[i]['art']} · #{i}", fill=(255, 255, 0), font=small)
            tiles.append(t)
        row = Image.new('RGB', (sum(t.width for t in tiles), tiles[0].height)); x = 0
        for t in tiles: row.paste(t.convert('RGB'), (x, 0)); x += t.width
        if row.width % 2 or row.height % 2: row = row.crop((0, 0, row.width - row.width % 2, row.height - row.height % 2))
        return row
    if ff:
        sc = min(1.0, 1800 / ((box[2] - box[0]) * len(labels)))
        seq = [panel_row(i, box, sc) for i in range(n)]
        for fps in (24, 12): encode(ff, seq, fps, os.path.join(out, f'compare_seq_{fps}fps.mp4'))
        R0 = json.load(open(os.path.join(keep[labels[0]][0], 'frames.json'))); passims = [Image.open(os.path.join(keep[labels[0]][0], 'pass', f'{i:04d}.png')).convert('RGBA') for i in range(len(R0['pass']))]
        pb = A6.crop_union([A6.silhouette(im)[2]['box'] for im in passims], (40, 30, 40, 30)); side = []
        for i, im in enumerate(passims):
            t = A6.comp(base, im, R0['pass'][i]['shadows']).crop(pb).convert('RGB'); ImageDraw.Draw(t).text((4, 2), f'side pass {i} (same pixels in every run)', fill=(255, 255, 0), font=small)
            side.append(t.crop((0, 0, t.width - t.width % 2, t.height - t.height % 2)))
        for fps in (24, 12): encode(ff, side, fps, os.path.join(out, f'side_pass_{fps}fps.mp4'))
        legs = []
        for i in range(n):
            if fr[i]['art'] == 'side': continue
            L = fr[i]['legs_px']; xs = [L[s][k][0] for s in 'LR' for k in ('hip', 'knee', 'ankle')]; ys = [L[s][k][1] for s in 'LR' for k in ('hip', 'knee', 'ankle')]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; legs.append(panel_row(i, (int(cx - 70), int(cy - 130), int(cx + 70), int(cy + 150)), 2))
        encode(ff, legs, 12, os.path.join(out, 'legs_seq_12fps.mp4'))
    def knee_sheet(items, path):
        tiles = []
        for i, s in items:
            L = fr[i]['legs_px'][s]; kx, ky = L['knee']; crop = (int(kx - 38), int(ky - 45), int(kx + 38), int(ky + 45))
            for k in labels:
                t = comp(k, i).crop(crop).resize((304, 360), Image.LANCZOS); d = ImageDraw.Draw(t); P = lambda q: ((q[0] - crop[0]) * 4, (q[1] - crop[1]) * 4)
                d.line([P(L['hip']), P(L['knee']), P(L['ankle'])], fill=(0, 255, 255, 140), width=1); x, y = P(L['knee']); d.line([x - 10, y, x + 10, y], fill=(255, 0, 255), width=2)
                d.text((3, 2), f"{k} #{i} {s} flex {fr[i]['knee_flex_deg'][s]}", fill=(255, 255, 0), font=small); tiles.append(t)
        A6.grid(tiles, len(labels) * 2).convert('RGB').save(path, quality=90)
    knee_sheet([(12, 'L'), (13, 'R'), (24, 'R'), (32, 'L'), (35, 'L'), (40, 'R'), (0, 'L'), (80, 'R')], os.path.join(out, 'legs_front.jpg'))
    knee_sheet([(173, 'R'), (179, 'L'), (180, 'R'), (190, 'L'), (201, 'L'), (209, 'R'), (167, 'L'), (160, 'R')], os.path.join(out, 'legs_rear.jpg'))
    def shoulder_sheet(frames, path):
        tiles = []
        for i in frames:
            sh = fr[i]['shoulders_px']; cx = (sh['L'][0] + sh['R'][0]) / 2; cy = sh['L'][1]; hw = abs(sh['L'][0] - sh['R'][0]) * .85 + 20; crop = (int(cx - hw), int(cy - .4 * hw), int(cx + hw), int(cy + 2 * hw))
            for k in labels:
                a = np.asarray(comp(k, i)).copy(); a[holemask(np.asarray(runs[k][1][i].getchannel('A')))] = [255, 0, 255, 255]
                t = Image.fromarray(a).crop(crop).resize((450, 540), Image.LANCZOS); ImageDraw.Draw(t).text((3, 2), f"{k} #{i} {fr[i]['seg']} {fr[i]['i']}", fill=(255, 255, 0), font=small); tiles.append(t)
        A6.grid(tiles, len(labels) * 2).convert('RGB').save(path, quality=90)
    shoulder_sheet([0, 24, 64, 100], os.path.join(out, 'shoulders_front.jpg')); shoulder_sheet([152, 170, 190, 205], os.path.join(out, 'shoulders_rear.jpg'))
    tiles = []
    for i in (121, 122, 141, 142):
        b = A6.crop_union([boxes[i]], (30, 20, 30, 20))
        for k in labels:
            t = comp(k, i).crop(b); t = t.resize((round(t.width * 1.4), round(t.height * 1.4)), Image.LANCZOS); ImageDraw.Draw(t).text((3, 2), f"{k} #{i} {fr[i]['art']}", fill=(255, 255, 0), font=small); tiles.append(t)
    A6.grid(tiles, len(labels) * 2).convert('RGB').save(os.path.join(out, 'switch_turn.jpg'), quality=90)
