#!/usr/bin/env python3
"""Integrity check of the imported v05 walk-frame originals (NPC02-NPC10), independent of the import script.

  python3 scripts/verify-v05-frames.py            # exit 1 on any failure

Source of the originals: ../asset-source/v05_frames/<NPC>/ as written by the producer's import_v05_frames.py from the
93 independent ZIPs (Drive folder 1WGKr1rLNaUORGJMp-8IZaRQStqddjeiU). Checked here, file by file:
  1. every sprite listed in TRANSFER_MANIFEST.json and in the package's own checksums_v05.json exists and both SHA-256 match
  2. 9 NPC x 3 views x 48 frames = 1,296 PNGs, each 720x1280 RGBA with at least one opaque pixel; no extra sprite files
  3. config.json id equals its folder, config.rig_path names a rig file that is present, and config/rig/binding/QA files
     are byte-identical to the reproduction-code copies in ../asset-source/v05_QA/code/<NPC>/
Output: ../asset-source/v05_frames/V05_VERIFY_REPORT.json (integrity only; the quality status stays REVISE).
"""
import hashlib, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_frames')
CODE = os.path.join(os.path.dirname(ROOT), 'asset-source', 'v05_QA', 'code')
NPCS = ['NPC%02d' % n for n in range(2, 11)]
VIEWS = ['front', 'side', 'rear']

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def main():
    man = json.load(open(os.path.join(SRC, 'TRANSFER_MANIFEST.json')))
    listed = {f['path']: f['sha256'] for pk in man['packages'] for f in pk['files']}
    report = {'source': 'asset-source/v05_frames', 'quality': 'REVISE', 'npcs': {}, 'totals': {}}
    fails = []
    for npc in NPCS:
        base = os.path.join(SRC, npc); r = {'frames_expected': 144, 'frames_ok': 0, 'missing': [], 'hash_fail': [], 'format_fail': [], 'extra': [], 'linkage': {}}
        sums = json.load(open(os.path.join(CODE, npc, 'checksums_v05.json')))
        for view in VIEWS:
            have = set(os.listdir(os.path.join(base, 'sprites', view))) if os.path.isdir(os.path.join(base, 'sprites', view)) else set()
            want = {f'{i:04d}.png' for i in range(48)}
            r['extra'] += sorted(f'sprites/{view}/{x}' for x in have - want)
            for i in range(48):
                rel = f'sprites/{view}/{i:04d}.png'; p = os.path.join(base, rel)
                if not os.path.exists(p): r['missing'].append(rel); continue
                h = sha(p)
                if h != listed.get(f'{npc}/{rel}') or h != sums.get(rel): r['hash_fail'].append(rel); continue
                im = Image.open(p)
                if im.format != 'PNG' or im.size != (720, 1280) or im.mode != 'RGBA' or im.getchannel('A').getbbox() is None:
                    r['format_fail'].append(f'{rel}: {im.format} {im.size} {im.mode}'); continue
                r['frames_ok'] += 1
        cfg = json.load(open(os.path.join(base, 'config.json'))); rig = cfg.get('rig_path') or 'walk_rig_scene_retimed_v01.json'
        r['linkage'] = {'config_id': cfg['id'], 'id_matches_folder': cfg['id'] == npc, 'rig_path': rig, 'rig_present': os.path.exists(os.path.join(base, rig)),
                        'same_as_code_copy': {}}
        for name in sorted(os.listdir(base)):
            if name == 'sprites': continue
            c = os.path.join(CODE, npc, name)
            r['linkage']['same_as_code_copy'][name] = os.path.exists(c) and sha(c) == sha(os.path.join(base, name))
        ok = (r['frames_ok'] == 144 and not (r['missing'] or r['hash_fail'] or r['format_fail'] or r['extra'])
              and r['linkage']['id_matches_folder'] and r['linkage']['rig_present'] and all(r['linkage']['same_as_code_copy'].values()))
        r['integrity'] = 'PASS' if ok else 'FAIL'
        if not ok: fails.append(npc)
        report['npcs'][npc] = r
    report['totals'] = {'frames_expected': 1296, 'frames_ok': sum(r['frames_ok'] for r in report['npcs'].values()),
                        'missing': sum(len(r['missing']) for r in report['npcs'].values()), 'hash_fail': sum(len(r['hash_fail']) for r in report['npcs'].values()),
                        'format_fail': sum(len(r['format_fail']) for r in report['npcs'].values()), 'npc_fail': fails}
    json.dump(report, open(os.path.join(SRC, 'V05_VERIFY_REPORT.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for npc, r in report['npcs'].items():
        print(npc, r['integrity'], r['frames_ok'], '/ 144', 'rig', r['linkage']['rig_path'], 'files same as code copy:', sum(r['linkage']['same_as_code_copy'].values()), '/', len(r['linkage']['same_as_code_copy']))
    print('total', report['totals'])
    if fails: sys.exit(1)

if __name__ == '__main__':
    main()
