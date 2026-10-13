#!/usr/bin/env python3
"""Adds the readable text layer of the 20 evidence items to dist/data/story_evidence.json (v0.16.0).

  python3 scripts/merge-evidence-text.py

Source: ../asset-source/04_증거소품/evidence_readable_20_v03.json (asset package 04_증거소품, fetched from Drive). Per the
package README (README_CLAUDE_CODE_v02 4항) the evidence UI shows `body`; proves/does_not_prove stay puzzle logic data.
Copied per item: body (lines), issued_at, source_doc (the card's 'source'), card_title, text_status (card status
PASS/REVISE/BLOCKED), text_reason. Game titles, eras and crosschecks are kept; differences are printed and recorded
in docs/planning_conflicts.md. A BLOCKED card (photo evidence without a source photo) gets an empty body: the viewer says
so instead of inventing text.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'asset-source', '04_증거소품', 'evidence_readable_20_v03.json')
DST = os.path.join(ROOT, 'dist', 'data', 'story_evidence.json')

def years(text):
    return [int(y) for y in re.findall(r'(?<!\d)(19\d\d|20\d\d)(?!\d)', text or '')]

def main():
    cards = {c['id']: c for c in json.load(open(SRC))}
    doc = json.load(open(DST)); diffs = []
    if sorted(cards) != sorted(e['id'] for e in doc['evidence']): sys.exit('evidence ids differ between the card file and the game data')
    for e in doc['evidence']:
        c = cards[e['id']]
        e['body'] = list(c.get('body') or [])
        e['issued_at'] = c.get('issued_at'); e['source_doc'] = c.get('source'); e['card_title'] = c['title']
        e['text_status'] = c['status']; e['text_reason'] = c.get('reason', '')
        if c['title'] != e['title']: diffs.append(f"{e['id']} 제목: 게임 '{e['title']}' / 카드 '{c['title']}'")
        gy, cy = years(e.get('era')), years(c.get('issued_at'))
        if gy and cy and not (min(cy) <= min(gy) <= max(cy) or min(gy) <= min(cy) <= max(gy)):
            diffs.append(f"{e['id']} 연도: 게임 era '{e.get('era')}' / 카드 issued_at '{c.get('issued_at')}'")
    doc['text_source'] = 'asset-source/04_증거소품/evidence_readable_20_v03.json (body = 증거 화면 본문, 이미지에 굽지 않은 텍스트 레이어)'
    json.dump(doc, open(DST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(diffs) or 'no differences')

if __name__ == '__main__':
    main()
