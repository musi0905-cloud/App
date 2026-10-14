#!/usr/bin/env python3
"""Turns the v05 frame review into per-NPC/per-view statuses, a criteria table and the art/motion production requests.

  python3 scripts/build-v05-review.py      (after scripts/analyze-v05-frames.py)

Inputs (../asset-source/v05_QA/frame_qa/): visual_review_v05.json (what was seen, written by the reviewer: issues per NPC
and view), frame_metrics_v05.json (measurements on the original frames). Frame ranges of the two rig-wide issues are not
typed in by hand but measured here from the rig the frames were rendered from:
  LEG_STRIP   front/rear frames where the projected near leg is > 1.15x the far leg (hip -> heel, image px)
  KNEE_CROUCH side frames where a flat foot (heel and toe <= 5 mm) has its knee bent > 25 deg
Status rule: PASS only when the view has no issue and every measured criterion passes; BLOCKED when the review marks
it so; otherwise REVISE. The package status (validation_all_v05.json: REVISE) is never raised by this script.
Outputs: review_summary_v05.json (statuses + criteria, read by build-walk-binding.py), production_requests_v05.json,
evidence_LEG_STRIP.jpg, evidence_KNEE_CROUCH.jpg.
"""
import importlib.util, json, math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QA = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_QA', 'frame_qa')
SRC = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_frames')
spec = importlib.util.spec_from_file_location('binding', os.path.join(ROOT, 'scripts', 'build-walk-binding.py'))
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
VIEWS = ['front', 'side', 'rear']

def angle(a, b, c):
    u = [a[i] - b[i] for i in range(3)]; v = [c[i] - b[i] for i in range(3)]
    return math.degrees(math.acos(max(-1, min(1, sum(x * y for x, y in zip(u, v)) / math.hypot(*u) / math.hypot(*v)))))

def ranges(frames):
    out, start = [], None
    for k, f in enumerate(frames):
        if start is None: start = f
        if k + 1 == len(frames) or frames[k + 1] != f + 1: out.append(f'{start}-{f}' if f != start else f'{f}'); start = None
    return ', '.join(out)

def rig_measures(npc):
    cfg = json.load(open(os.path.join(SRC, npc, 'config.json'))); rig = json.load(open(os.path.join(SRC, npc, cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json')))
    S = cfg['height_m'] / 1.725; leg = {'front': [], 'rear': []}; knee = []; worst_leg = {}; worst_knee = 0
    for i in range(48):
        p = {k: [c * S for c in v] for k, v in rig['frames'][i]['joints'].items()}
        for view in leg:
            L = [math.dist(B.project(view, p[s + 'hip'])[:2], B.project(view, p[s + 'heel'])[:2]) for s in 'LR']
            r = max(L) / min(L)
            if r > 1.15: leg[view].append(i)
            worst_leg[view] = max(worst_leg.get(view, 0), r)
        for s in 'LR':
            if p[s + 'heel'][1] <= .005 and p[s + 'toe'][1] <= .005:
                flex = 180 - angle(p[s + 'hip'], p[s + 'knee'], p[s + 'ankle']); worst_knee = max(worst_knee, flex)
                if flex > 25 and i not in knee: knee.append(i)
    return {'LEG_STRIP': {v: (leg[v], round(worst_leg[v], 2)) for v in leg}, 'KNEE_CROUCH': {'side': (sorted(knee), round(worst_knee, 1))}}

def criteria(npc, view, issues, m):
    """PASS/REVISE per criterion: measured ones from frame_metrics_v05.json, seen ones from the review's issues."""
    s = m['views'].get(view) if view != 'sequence' else None
    seen = lambda *ids: 'REVISE' if any(i in issues for i in ids) else 'PASS'
    if view == 'sequence':
        return {'sequence': 'BLOCKED' if 'PATH_GAP' in issues else seen('NO_TURN_IDLE')}
    sole = s['sole_vs_rig_px']; slide = s['planted_shoe_slide']
    return {
        'alternation': 'PASS' if s['alternates'] and len(s['heel_strikes']) >= 2 else 'REVISE',
        'planted_foot': 'PASS' if slide['max_px'] <= 1.5 else 'REVISE',
        'joints': seen('LEG_STRIP', 'FAR_ARM', 'ARM_LONG'),
        'rotation': seen('TORSO_STATIC'),
        'arms': seen('FAR_ARM', 'ARM_LONG', 'CARRY_STATIC', 'TORSO_STATIC'),
        'consistency': 'PASS' if s['head_width_ratio']['cv'] <= .02 and s['height_ratio']['cv'] <= .05 else 'REVISE',
        'perspective': 'PASS',  # frames are rendered with the BG02 camera of scene_layout.json (checked by build-walk-binding.py)
        'contact': 'PASS' if sole and -10 <= sole['min'] and sole['max'] <= 3 else 'REVISE',
    }

def evidence_legs():
    bg = Image.open(os.path.join(ROOT, 'dist', 'assets', 'bg', 'BG02.webp')).convert('RGBA').resize((720, 1280)); tiles = []
    for npc, view, i, box in (('NPC08', 'front', 44, (250, 700, 470, 1120)), ('NPC03', 'front', 46, (250, 700, 470, 1140)), ('NPC02', 'rear', 0, (230, 780, 450, 1220))):
        c = bg.copy(); c.alpha_composite(Image.open(os.path.join(SRC, npc, 'sprites', view, f'{i:04d}.png'))); t = c.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.LANCZOS)
        ImageDraw.Draw(t).text((6, 6), f'{npc} {view} {i:02d}', fill=(255, 255, 0, 255)); tiles.append(t)
    out = Image.new('RGB', (sum(t.width for t in tiles), max(t.height for t in tiles))); x = 0
    for t in tiles: out.paste(t, (x, 0)); x += t.width
    out.save(os.path.join(QA, 'evidence_LEG_STRIP.jpg'), quality=86)

def evidence_knee(meas):
    bg = Image.open(os.path.join(ROOT, 'dist', 'assets', 'bg', 'BG02.webp')).convert('RGBA').resize((720, 1280)); tiles = []
    for npc in ('NPC03', 'NPC06'):
        frames = meas[npc]['KNEE_CROUCH']['side'][0]
        for i in (frames[len(frames) // 4], frames[3 * len(frames) // 4]):
            c = bg.copy(); im = Image.open(os.path.join(SRC, npc, 'sprites', 'side', f'{i:04d}.png')); c.alpha_composite(im)
            x0, y0, x1, y1 = im.getchannel('A').getbbox(); cx = (x0 + x1) // 2; t = c.crop((cx - 120, y0 - 10, cx + 120, y1 + 10))
            ImageDraw.Draw(t).text((4, 4), f'{npc} side {i:02d}', fill=(255, 255, 0, 255)); tiles.append(t)
    out = Image.new('RGB', (sum(t.width for t in tiles), max(t.height for t in tiles))); x = 0
    for t in tiles: out.paste(t, (x, 0)); x += t.width
    out.save(os.path.join(QA, 'evidence_KNEE_CROUCH.jpg'), quality=86)

def main():
    review = json.load(open(os.path.join(QA, 'visual_review_v05.json'))); metrics = json.load(open(os.path.join(QA, 'frame_metrics_v05.json')))['npcs']
    meas = {npc: rig_measures(npc) for npc in review['npcs']}
    summary = {'reviewed': review['reviewed'], 'reviewer': review['reviewer'], 'rule': review['status_rule'], 'npcs': {}}
    requests = []
    for npc, views in review['npcs'].items():
        entry = {}
        for view in VIEWS + ['sequence']:
            issues = views.get(view, []); crit = criteria(npc, view, issues, metrics[npc])
            blocked = view in review.get('blocked', {}).get(npc, {})
            status = 'BLOCKED' if blocked else 'PASS' if not issues and all(v == 'PASS' for v in crit.values()) else 'REVISE'
            entry[view] = {'status': status, 'issues': issues, 'criteria': crit}
            for iss in issues:
                info = review['issues'][iss]
                if iss in meas[npc] and view in meas[npc][iss]:
                    fr, worst = meas[npc][iss][view]; frames = ranges(fr); note = f' (worst {worst}{" deg" if iss == "KNEE_CROUCH" else "x"})'
                else: frames, note = info['frames'], ''
                if iss in ('FAR_ARM', 'ARM_LONG'): frames = next((part.split(' ', 1)[1] for part in info['frames'].split(', ') if part.startswith(npc)), frames)
                ev = info['evidence'].replace('<NPC>', npc)
                requests.append({'id': f'{npc}-{view}-{iss}', 'npc': npc, 'view': view, 'issue': iss, 'frames': frames + note,
                                 'problem': info['problem'], 'evidence': ev, 'fix': info['fix'],
                                 'priority': 'P1' if iss in ('PATH_GAP', 'NO_TURN_IDLE', 'LEG_STRIP') else 'P2'})
        summary['npcs'][npc] = entry
    json.dump(summary, open(os.path.join(QA, 'review_summary_v05.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'source': 'scripts/build-v05-review.py from visual_review_v05.json + frame_metrics_v05.json', 'reviewed': review['reviewed'],
               'note': 'Art/motion rework requests. Frames are 0-based indices of sprites/<view>/NNNN.png. Every fix keeps the 720x1280 canvas, the BG02 camera and the root path of its clip unless the request itself is about the path.',
               'requests': requests}, open(os.path.join(QA, 'production_requests_v05.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    evidence_legs(); evidence_knee(meas)
    counts = {}
    for npc, e in summary['npcs'].items():
        for view, v in e.items(): counts[v['status']] = counts.get(v['status'], 0) + 1
        print(npc, ' '.join(f"{view}:{v['status']}" for view, v in e.items()))
    print('statuses', counts, 'requests', len(requests))

if __name__ == '__main__':
    main()
