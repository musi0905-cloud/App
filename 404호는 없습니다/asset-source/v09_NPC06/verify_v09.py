"""Compare already-rendered reference, default and v09 directories; no image editing."""
import argparse, hashlib, json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('reference',type=Path);p.add_argument('default',type=Path);p.add_argument('candidate',type=Path);a=p.parse_args()
h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
files=sorted(a.reference.glob('*/*.png'))
assert len(files)==263, f'Expected 263 NPC06 images, got {len(files)}'
assert len(list(a.default.glob('*/*.png')))==263
assert len(list(a.candidate.glob('*/*.png')))==263
assert all(h(f)==h(a.default/f.relative_to(a.reference)) for f in files), 'Default regression'
assert all(h(f)==h(a.candidate/'pass'/f.name) for f in (a.reference/'pass').glob('*.png')), 'Side regression'
x=json.loads((a.reference/'frames.json').read_text());y=json.loads((a.candidate/'frames.json').read_text())
fields=['root_world','feet_world','root_px','head_px','legs_px','shoulders_px','feet_px','shadows','knee_flex_deg']
assert len(x['frames'])==len(y['frames'])==215
assert len(x['pass'])==len(y['pass'])==48
assert all(i[k]==j[k] for i,j in zip(x['frames']+x['pass'],y['frames']+y['pass']) for k in fields), 'Geometry regression'
print('PASS technical regression only: default 263/263, side 48/48, geometry 263/263. Visual QA remains REVISE.')
