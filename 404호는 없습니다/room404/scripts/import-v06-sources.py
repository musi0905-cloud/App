#!/usr/bin/env python3
"""Brings the producer's restored source delivery (2026-10-14, 41 source_*.zip, format 404-byte-pieces-v1) into asset-source.

  python3 -I <dir>/restore_sources.py --input <pkgs> --output <restored> --verify-only   # producer's script, first
  python3 -I <dir>/restore_sources.py --input <pkgs> --output <restored>
  python3 scripts/import-v06-sources.py --restored <restored> --manifest <pkgs>/SOURCE_MANIFEST.json \
          --match <pkgs>/MATCH_REPORT.json --restore-script <pkgs>/restore_sources.py

Every file listed in SOURCE_MANIFEST.json is hashed again here and image files are fully decoded; one mismatch stops
the whole import before anything is written. Bytes are copied as they are (no resize, no re-encode). Nothing in the
repository is overwritten: a destination that already holds the same bytes is recorded as 'already', one that holds
different bytes stops the import.

Destinations:
  01_캐릭터/game/*  -> asset-source/01_캐릭터/game/        (game exports of the approved figures)
  02_배경/game/*    -> asset-source/02_배경/game/          (game exports of the approved backgrounds)
  06_애니메이션/NPC02-NPC10_손소품경계수정_v05/<NPC>/assets/* -> asset-source/v05_QA/code/<NPC>/assets/ (render inputs)
      except the BG02 copy each package carries: it must equal asset-source/02_배경/game/BG02_… and is not duplicated
  06_애니메이션/…/<NPC>/<code, config, rig, old QA> -> must already equal asset-source/v05_QA/code/<NPC>/… (checked)
The manifest, the match report and the restore script are kept in asset-source/v06_sources/ with the result
(SOURCE_IMPORT_RESULT.json). The old QA records inside the packages are past results, not evidence for new renders.
"""
import argparse, hashlib, json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(ROOT)
AS = os.path.join(PROJECT, 'asset-source')
ANIM = '06_애니메이션/NPC02-NPC10_손소품경계수정_v05/'
BG02 = '02_배경/game/BG02_shared_entrance_night_v01.webp'

def sha(b): return hashlib.sha256(b).hexdigest()

def dest_of(path):
    if path.startswith(('01_캐릭터/game/', '02_배경/game/')): return path, 'copy'
    if path.startswith(ANIM):
        npc, rest = path[len(ANIM):].split('/', 1)
        if rest == 'assets/BG02_shared_entrance_night_v01.webp': return BG02, 'same_as_existing'
        if rest.startswith('assets/'): return f'v05_QA/code/{npc}/{rest}', 'copy'
        return f'v05_QA/code/{npc}/{rest}', 'must_equal_existing'
    raise SystemExit('no destination rule for ' + path)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--restored', required=True); ap.add_argument('--manifest', required=True)
    ap.add_argument('--match', required=True); ap.add_argument('--restore-script', required=True)
    a = ap.parse_args()
    man = json.load(open(a.manifest)); mr = json.load(open(a.match))
    if man.get('format') != '404-byte-pieces-v1': sys.exit('unknown manifest format ' + str(man.get('format')))
    req = {r['expectedSha256']: r for r in mr['requests']}
    rows, problems = [], []
    for f in man['files']:
        src = os.path.join(a.restored, f['path']); b = open(src, 'rb').read() if os.path.exists(src) else None
        if b is None: problems.append(f['path'] + ': not restored'); continue
        h = sha(b)
        if len(b) != f['bytes'] or h != f['sha256']: problems.append(f"{f['path']}: {len(b)} B {h[:12]} != manifest {f['bytes']} B {f['sha256'][:12]}"); continue
        row = {'source': f['path'], 'bytes': len(b), 'sha256': h}
        if src.lower().endswith(('.png', '.webp', '.jpg')):
            try:
                im = Image.open(src); im.load(); row.update(size=list(im.size), mode=im.mode)
            except Exception as e: problems.append(f"{f['path']}: decode failed {e}"); continue
        rel, rule = dest_of(f['path']); dst = os.path.join(AS, rel); row.update(dest='asset-source/' + rel, rule=rule)
        if os.path.exists(dst):
            same = sha(open(dst, 'rb').read()) == h
            if not same: problems.append(f"{f['path']}: asset-source/{rel} exists with different bytes"); continue
            row['action'] = 'already'
        elif rule == 'copy': row['action'] = 'copy'
        else: problems.append(f"{f['path']}: expected an identical asset-source/{rel}, none found"); continue
        r = req.get(h)
        if r: row.update(request=r['assetId'], priority=r['priority'], transferStatus=r.get('transferStatus'), visualQA=r.get('visualQA'),
                         reportDimensions=r.get('dimensions'), reportMode=r.get('mode'), recoveryArchive=r.get('archive'))
        if r and (r.get('dimensions') and r['dimensions'] != row.get('size') or r.get('mode') and r['mode'] != row.get('mode')):
            problems.append(f"{f['path']}: decoded {row.get('size')} {row.get('mode')} != match report {r.get('dimensions')} {r.get('mode')}")
        rows.append(row)
    missing_req = [r['assetId'] for h, r in req.items() if h not in {x['sha256'] for x in rows}]
    if missing_req: problems.append('match-report requests without a restored file: ' + ', '.join(missing_req))
    if problems:
        print('STOPPED, nothing written'); [print(' ', p) for p in problems[:40]]; sys.exit(1)
    for row in rows:
        if row['action'] != 'copy': continue
        dst = os.path.join(AS, row['dest'][len('asset-source/'):]); os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(os.path.join(a.restored, row['source']), 'rb') as s, open(dst, 'xb') as d: shutil.copyfileobj(s, d)
    keep = os.path.join(AS, 'v06_sources'); os.makedirs(keep, exist_ok=True)
    for p in (a.manifest, a.match, a.restore_script):
        d = os.path.join(keep, os.path.basename(p))
        if os.path.exists(d):
            if open(d, 'rb').read() != open(p, 'rb').read(): sys.exit(d + ' exists with different bytes')
        else: shutil.copyfile(p, d)
    count = lambda k, v: sum(r.get(k) == v for r in rows)
    out = {'generated_by': 'room404/scripts/import-v06-sources.py', 'generated': '2026-10-14', 'format': man['format'],
           'packages': len(man['packages']), 'files': len(rows), 'images_decoded': sum('size' in r for r in rows),
           'copied': count('action', 'copy'), 'already_identical': count('action', 'already'),
           'requests': len(mr['requests']), 'requests_resolved': sum('request' in r for r in rows),
           'manifest_flags': {k: man.get(k) for k in ('artModified', 'motionFixed')},
           'note': '전송 형식 검사(해시·해독) 결과다. 시각 검수는 다시 하지 않았고(visualQA NOT_REASSESSED) 걷기 품질 PASS가 아니다. '
                   '패키지 안의 QA_v05.json·frame_connectivity_check.json은 과거 결과이며 새 수정본의 검수 증거로 쓰지 않는다.',
           'rows': rows}
    json.dump(out, open(os.path.join(keep, 'SOURCE_IMPORT_RESULT.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print({k: out[k] for k in ('packages', 'files', 'images_decoded', 'copied', 'already_identical', 'requests', 'requests_resolved')})

if __name__ == '__main__':
    main()
