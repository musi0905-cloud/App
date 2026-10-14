#!/usr/bin/env python3
"""Walk-clip binding data for the v05 NPC walk package (NPC02-NPC10), written to dist/data/walk_clips.json.

  python3 scripts/build-walk-binding.py

Input: ../asset-source/v05_QA/code/<NPC>/ — the reproduction-code part of 'NPC02-NPC10_재현코드_QA_v05.zip' (config.json,
binding.json, the walk rig, carrying_binding_v05.json for NPC03/NPC09, checksums_v05.json) and validation_all_v05.json.
The rendered sprites (sprites/<view>/0000-0047.png, 720x1280 RGBA) are kept as originals in ../asset-source/v05_frames/
(scripts/verify-v05-frames.py); scripts/import-v05-frames.py packs the QA-viewer atlases. When the frame review exists
(../asset-source/v05_QA/frame_qa/review_summary_v05.json, scripts/build-v05-review.py), each NPC gets its per-view and
enter->idle->exit statuses plus the seam measured on the images; the package qa_status itself is copied, never raised.

What is computed here is exactly what the package renderer (render.js) does, ported line for line, so the engine can
draw the parts render.js leaves to it: per frame, the two contact-shadow ellipses from world-space heel/toe positions,
the ground point under the root (foot pivot of the frame) and a body box for the click area. All values are in the
720x1280 clip canvas; the clip canvas is the whole BG02 frame at 2/3 scale (design_scale 1.5 -> 1080x1920).
The rig and config decide everything: config.rig_path is honoured (NPC06 uses walk_rig_elder_v04.json); NPC03/NPC09 use
their carrying_binding_v05.json (a static bent arm hung on the moving left shoulder, never a mirrored whole figure).
"""
import json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_QA', 'code')
OUT = os.path.join(ROOT, 'dist', 'data', 'walk_clips.json')
W, H = 720, 1280
F = 1100 * W / 1080; HY = 675 * W / 1080
VIEWS = {'front': 'enter', 'rear': 'exit', 'side': 'pass'}

def world(view, p):
    if view == 'front': return [-p[2], p[1], 2.92 - p[0]]
    if view == 'rear': return [p[2], p[1], 1.8 + p[0]]
    return [.52 - p[0], p[1], 2.35]

def project(view, p):
    x, y, z = world(view, p)
    return [W / 2 + F * x / z, HY + F * (1.6 - y) / z, F / z]

def r1(v): return round(v, 1)

def clip(npc, cfg, rig, view):
    S = cfg['height_m'] / 1.725; feet, boxes, shadows, zs = [], [], [], []
    for frame in range(48):
        pose = rig['frames'][frame]; p = {k: [c * S for c in v] for k, v in pose['joints'].items()}
        root = pose.get('root') or pose['joints'].get('root')
        rootp = [c * S for c in root]
        g = project(view, [rootp[0], 0, rootp[2]]); feet.append([r1(g[0]), r1(g[1])]); zs.append(world(view, [rootp[0], 0, rootp[2]])[2])
        pair = []
        for s in 'LR':
            he, to = p[s + 'heel'], p[s + 'toe']; floor = [(he[0] + to[0]) / 2, 0, (he[2] + to[2]) / 2]; q = project(view, floor)
            lift = max(0, min(he[1], to[1])); a = .32 * math.exp(-lift * 20)
            rx = (.145 if view == 'side' else .095) * S * q[2] * (1 + lift * 1.6); ry = .028 * S * q[2] * (1 + lift * 3)
            pair.append([r1(q[0]), r1(q[1]), r1(rx), r1(ry), round(a, 3)])
        shadows.append(pair)
        pts = [project(view, v) for k, v in p.items() if k != 'root']
        top = project(view, [p['head'][0], p['head'][1] + .06, p['head'][2]])
        half = .16 * S * top[2]
        x0 = min(q[0] for q in pts) - half; x1 = max(q[0] for q in pts) + half
        y1 = max(project(view, p[s + k])[1] for s in 'LR' for k in ('heel', 'toe'))
        boxes.append([r1(x0), r1(top[1]), r1(x1), r1(y1)])
    # Foot slide: a heel resting on the floor (y <= 5 mm) in two consecutive frames must not move in world space.
    slide = 0.0
    for frame in range(47):
        a, b = rig['frames'][frame]['joints'], rig['frames'][frame + 1]['joints']
        for s in 'LR':
            ha, hb = [c * S for c in a[s + 'heel']], [c * S for c in b[s + 'heel']]
            if ha[1] <= .005 and hb[1] <= .005:
                wa, wb = world(view, ha), world(view, hb); slide = max(slide, math.hypot(wa[0] - wb[0], wa[2] - wb[2]))
    return {'role': VIEWS[view], 'start_z': round(zs[0], 3), 'end_z': round(zs[-1], 3), 'foot_slide_mm': round(slide * 1000, 1), 'feet': feet, 'bbox': boxes, 'shadows': shadows}

def main():
    validation = {x['id']: x for x in json.load(open(os.path.join(PKG, 'validation_all_v05.json')))}
    qa_dir = os.path.join(os.path.dirname(PKG), 'frame_qa'); review_path = os.path.join(qa_dir, 'review_summary_v05.json')
    review = json.load(open(review_path)) if os.path.exists(review_path) else None
    metrics_path = os.path.join(qa_dir, 'frame_metrics_v05.json'); metrics = json.load(open(metrics_path))['npcs'] if os.path.exists(metrics_path) else {}
    out = {'source': 'asset-source/v05_QA/code (NPC02-NPC10_재현코드_QA_v05.zip, 재현 코드·QA 부분) + validation_all_v05.json',
           'rule': 'qa_status가 PASS가 아닌 클립은 게임 화면에 쓰지 않는다(README_CLAUDE_CODE_v02 3항: REVISE/BLOCKED는 완성 화면으로 표시 금지). QA 뷰어에서만 재생. MP4는 불투명 합성 검토 영상이라 투명 에셋으로 쓰지 않는다.',
           'canvas': {'width': W, 'height': H, 'design_scale': 1.5, 'background': 'BG02', 'note': '프레임은 BG02 전체 화면(2/3 축척)에 루트 이동이 구워진 고정 캔버스. 프레임마다 다시 가운데 맞추지 않는다.'},
           'camera': None, 'npcs': {}}
    for npc in sorted(d for d in os.listdir(PKG) if d.startswith('NPC')):
        base = os.path.join(PKG, npc); cfg = json.load(open(os.path.join(base, 'config.json')))
        rig_name = cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json'; rig = json.load(open(os.path.join(base, rig_name)))
        binding = json.load(open(os.path.join(base, 'binding.json'))); checks = json.load(open(os.path.join(base, 'checksums_v05.json')))
        if out['camera'] is None: out['camera'] = binding['camera']
        elif binding['camera'] != out['camera']: raise SystemExit(f'{npc}: camera differs from the other clips')
        if binding['fps'] != rig['fps'] or binding['frames'] != 48: raise SystemExit(f'{npc}: fps/frames mismatch')
        v = validation[npc]; views = {view: clip(npc, cfg, rig, view) for view in VIEWS}
        atlas_path = os.path.join(os.path.dirname(PKG), 'frames', npc, 'atlas.json'); atlas = json.load(open(atlas_path)) if os.path.exists(atlas_path) else None
        entry = {'revision': v['revision'], 'qa_status': v['status'], 'technical_export': v['technical_export'], 'engine_applied': False,
                 'height_m': cfg['height_m'], 'prop': cfg.get('prop'), 'rig': rig_name, 'speed_m_s': round(rig['speed_m_s'], 4),
                 'fps': rig['fps'], 'frames': 48, 'frames_expected': sum(1 for k in checks if k.startswith('sprites/')),
                 'frames_in_hand': atlas['frames'] if atlas else 0, 'atlas': f'asset-source/v05_QA/frames/{npc}/atlas.json' if atlas else None, 'remaining': v.get('remaining', []), 'views': views,
                 'checks': {'enter_end_z': views['front']['end_z'], 'exit_start_z': views['rear']['start_z'],
                            'enter_exit_gap_m': round(abs(views['front']['end_z'] - views['rear']['start_z']), 3),
                            'foot_slide_mm': {v: views[v]['foot_slide_mm'] for v in VIEWS}}}
        if os.path.exists(os.path.join(base, 'carrying_binding_v05.json')):
            cb = json.load(open(os.path.join(base, 'carrying_binding_v05.json')))
            entry['carrying'] = {'file': cb['file'], 'driver': v['carrying_arm']['driver'], 'pose': v['carrying_arm']['pose'],
                                 'rear_mapping': v['carrying_arm']['rear_mapping'], 'status': v['carrying_arm']['status'], 'views': cb['views']}
        if review and npc in review['npcs']:
            r = review['npcs'][npc]
            entry['review'] = {'reviewed': review['reviewed'], 'source': 'asset-source/v05_QA/frame_qa/review_summary_v05.json',
                               'views': {v: r[v]['status'] for v in ('front', 'side', 'rear')}, 'sequence': r['sequence']['status'],
                               'issues': {v: r[v]['issues'] for v in r}}
        if npc in metrics:
            g = metrics[npc]['seam']['gap']
            entry['checks']['seam_measured'] = {'lowest_row_px': g['lowest_row_px'], 'depth_from_lowest_row_m': g['depth_from_lowest_row_m'],
                                                'head_width_change': g['head_width_change'], 'body_scale_rig': g['body_scale_rig']}
        out['npcs'][npc] = entry
        print(npc, entry['qa_status'], rig_name, 'enter z', views['front']['start_z'], '->', views['front']['end_z'],
              'exit z', views['rear']['start_z'], '->', views['rear']['end_z'], 'gap', entry['checks']['enter_exit_gap_m'], 'slide mm', entry['checks']['foot_slide_mm'])
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('wrote', OUT, os.path.getsize(OUT))

if __name__ == '__main__':
    main()
