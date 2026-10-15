#!/usr/bin/env python3
"""Evidence crops for the v07 art revision requests (asset-source/v07_QA/NPC06/revision_evidence/).

  python3 -I tools/make_evidence.py --v06 <render dir> --v07 <render dir>

Each image puts the same frame of the fresh v06 render and the v07 render side by side on BG02 (x2), with the rig's hip-knee-
ankle line and the knee drawn in the v07 picture (estimate) marked on the v07 panel; plus sheet-level crops of the parts.
"""
import argparse, json, os, sys
sys.dont_write_bytecode = True
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_v07 import A6, lab

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(PROJECT, 'asset-source', 'v07_QA', 'NPC06', 'revision_evidence')
W, H = A6.W, A6.H

def panel(base, d, n, fr, mark, region, scale=2):
    im = Image.open(os.path.join(d, 'seq', f'{n:04d}.png')).convert('RGBA'); c = A6.comp(base, im, fr[n]['shadows']); b = im.getchannel('A').getbbox(); cx = (b[0] + b[2]) // 2
    y0 = b[1] + int((b[3] - b[1]) * region[0]); y1 = b[1] + int((b[3] - b[1]) * region[1]) + 12; box = (cx - 80, y0, cx + 80, y1)
    if mark:
        g = ImageDraw.Draw(c)
        for s, col in (('L', (90, 200, 255, 255)), ('R', (255, 170, 80, 255))):
            lp = fr[n]['legs_px'][s]; g.line([tuple(lp['hip']), tuple(lp['knee']), tuple(lp['ankle'])], fill=col, width=1)
            x, y = lp['knee']; g.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
            v = fr[n].get('v07')
            if v:
                x, y = v['legs'][s]['knee_px']; g.line([(x - 5, y - 5), (x + 5, y + 5)], fill=(255, 255, 255, 255), width=2); g.line([(x - 5, y + 5), (x + 5, y - 5)], fill=(255, 255, 255, 255), width=2)
    t = c.crop(box); return t.resize((t.width * scale, t.height * scale), Image.LANCZOS)

def strip(base, d6, fr6, d7, fr7, frames, region, title, font, small):
    tiles = []
    for n in frames:
        a = panel(base, d6, n, fr6, False, region); b = panel(base, d7, n, fr7, True, region)
        t = Image.new('RGBA', (a.width + b.width, max(a.height, b.height) + 22), (0, 0, 0, 255)); t.paste(a, (0, 22)); t.paste(b, (a.width, 22))
        v = fr7[n]['v07']; g = ImageDraw.Draw(t)
        g.text((4, 3), f"v06 | v07  {fr7[n]['seg']}{fr7[n]['i']}  L {v['legs']['L']['state']} {v['legs']['L']['flex']}deg  R {v['legs']['R']['state']} {v['legs']['R']['flex']}deg", fill=(255, 255, 0, 255), font=small)
        tiles.append(t)
    sheet = A6.grid(tiles, 4); out = Image.new('RGBA', (sheet.width, sheet.height + 30), (0, 0, 0, 255)); out.paste(sheet, (0, 30)); ImageDraw.Draw(out).text((6, 6), title, fill=(255, 255, 255, 255), font=font)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--v06', required=True); ap.add_argument('--v07', required=True); a = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    fr6 = json.load(open(os.path.join(a.v06, 'frames.json')))['frames']; fr7 = json.load(open(os.path.join(a.v07, 'frames.json')))['frames']
    base = A6.bg02(); font = A6.font(16); small = A6.font(12)
    off = {f['seg']: n for n, f in reversed(list(enumerate(fr7)))}
    strip(base, a.v06, fr6, a.v07, fr7, [off['enter'] + k for k in (4, 12, 25, 36, 40, 46)], (.42, 1.0),
          'E1 front legs: knee30/knee60 pictures bend sideways toward the body midline (white X = knee in the picture, dot = rig knee); colour and herringbone differ from the pelvis',
          font, small).convert('RGB').save(os.path.join(OUT, 'E1_front_knee_sideways.jpg'), quality=86)
    strip(base, a.v06, fr6, a.v07, fr7, [off['exit'] + k for k in (4, 12, 25, 36, 40, 46)], (.42, 1.0),
          'E2 rear legs: knee60 bends sideways, the cuff of a lifted leg shows the dark hem opening, colour lighter than the pelvis', font, small).convert('RGB').save(os.path.join(OUT, 'E2_rear_knee_hem.jpg'), quality=86)
    strip(base, a.v06, fr6, a.v07, fr7, [off['enter'] + 24, off['idle'] + 10, off['exit'] + 24], (.30, .62),
          'E3 hip join: v07 legs (lighter, herringbone) under the atlas pelvis piece (darker, plain)', font, small).convert('RGB').save(os.path.join(OUT, 'E3_hip_join_colour.jpg'), quality=86)
    # E4: torso cells, the right cell mirrored over the left one (silhouettes nearly identical), and the atlas torso at the same height
    src = os.path.join(HERE, 'source', 'NPC06_몸통회전_단추수정_v07b.png'); B = json.load(open(os.path.join(HERE, 'binding_v07.json'))); sh = Image.open(src).convert('RGBA')
    tiles = []
    for view in ('front', 'rear'):
        cs = {c['cell']: c for c in B['torso']['cells'] if c['view'] == view}; crops = {k: sh.crop((c['manifest_bbox_xywh'][0], c['manifest_bbox_xywh'][1], c['manifest_bbox_xywh'][0] + c['manifest_bbox_xywh'][2], c['manifest_bbox_xywh'][1] + c['manifest_bbox_xywh'][3])) for k, c in cs.items()}
        L, R = crops['left_cell'], crops['right_cell'].transpose(Image.FLIP_LEFT_RIGHT); w = max(L.width, R.width); h = max(L.height, R.height)
        ov = Image.new('RGBA', (w, h), (40, 40, 40, 255)); la = np.zeros((h, w), bool); ra = la.copy(); la[:L.height, :L.width] = np.asarray(L)[..., 3] > 128; ra[:R.height, :R.width] = np.asarray(R)[..., 3] > 128
        o = np.zeros((h, w, 4), np.uint8); o[..., 3] = 255; o[la & ra] = (170, 170, 170, 255); o[la & ~ra] = (80, 200, 255, 255); o[~la & ra] = (255, 120, 80, 255)
        for k, img in (('left cell', L), ('right cell', crops['right_cell']), ('mirror overlay', Image.fromarray(o))):
            t = Image.new('RGBA', (w + 10, h + 26), (0, 0, 0, 255)); t.paste(img, (5, 26), img if k != 'mirror overlay' else None)
            ImageDraw.Draw(t).text((5, 4), f"{view} {k}" + (f"  IoU {B['torso']['mirror_check'][view]['iou_mirrored']} (blue/orange = only in one)" if k == 'mirror overlay' else f"  centre offset {cs['left_cell' if k == 'left cell' else 'right_cell']['garment_centre_offset_halfwidth']['value']}, turn est. {cs['left_cell' if k == 'left cell' else 'right_cell']['implied_turn_deg']['value']}"), fill=(255, 255, 0, 255), font=small)
            tiles.append(t.resize((t.width // 2, t.height // 2), Image.LANCZOS))
    A6.grid(tiles, 3).convert('RGB').save(os.path.join(OUT, 'E4_torso_cells_mirror.jpg'), quality=86)
    print('written', sorted(os.listdir(OUT)))

if __name__ == '__main__':
    main()
