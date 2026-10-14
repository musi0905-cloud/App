#!/usr/bin/env python3
"""Port check: render_v06.js --mode=v05 must reproduce the producer's delivered v05 sprites byte for byte.
  python3 check_v05_port.py <outRoot> [NPC ...]   (run `node render_v06.js <NPC> <outRoot>/<NPC> --mode=v05` first)
Compares every sprites/{front,side,rear}/NNNN.png with checksums_v05.json of ../v05_QA/code/<NPC>/."""
import hashlib, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); CODE = os.path.join(HERE, '..', 'v05_QA', 'code')
out = sys.argv[1]; npcs = sys.argv[2:] or ['NPC%02d' % n for n in range(2, 11)]; res = {}
for npc in npcs:
    sums = json.load(open(os.path.join(CODE, npc, 'checksums_v05.json'))); same = diff = missing = 0
    for v in ('front', 'side', 'rear'):
        for i in range(48):
            p = os.path.join(out, npc, v, f'{i:04d}.png'); k = f'sprites/{v}/{i:04d}.png'
            if not os.path.exists(p): missing += 1; continue
            if hashlib.sha256(open(p, 'rb').read()).hexdigest() == sums[k]: same += 1
            else: diff += 1
    res[npc] = {'identical': same, 'different': diff, 'missing': missing}; print(npc, res[npc])
print(json.dumps(res))
