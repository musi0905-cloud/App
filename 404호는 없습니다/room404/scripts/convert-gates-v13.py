#!/usr/bin/env python3
"""Convert story-plan/v1.3/ending_gates_30_simulated.json (design data) into the runtime gate schema
dist/data/story_gates.json. The design file is read only; run again whenever it changes.

Runtime schema: {source, generated, gates:[{id,title,type,priority,terminal,cutscene,conditions:[{op,...}]}]}
Condition ops (evaluated by dist/story.js evaluateGate):
  legacy {id}            night-1 engine result (E01-E06), never changed here
  night {min}            story.nightCompleted >= min
  scene {id}             story.completedScenes includes id
  evidence {ids}         every id in story.evidenceAcquired
  verified {ids}         every id in story.evidenceVerified
  choice {scene,value}   story.sceneChoices[scene] === value
  confirm                story.archiveEndingConfirmed === true (explicit '이 기록으로 마무리')
  archiveScene {id}      story.selectedArchiveScene === id
  puzzles {ids}          every id in story.puzzlesSolved
  preserved              story.victimNamesPreserved === true
  submitted              story.externalSubmission === true
  final {value}          story.finalChoice === value
"""
import json, sys, os, datetime
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=os.path.join(root,'..','story-plan','v1.3','ending_gates_30_simulated.json')
dst=os.path.join(root,'dist','data','story_gates.json')
gates=json.load(open(src,encoding='utf-8'))
KEYS={'legacy_engine_result','min_night_completed','scene_completed','evidence_acquired','choice_equals','explicit_confirm_ending','selected_archive_scene','final_choice','puzzles_all','verified_evidence_all','victim_names_preserved','external_submission'}
out=[]
for g in gates:
    req=g['requires'];unknown=set(req)-KEYS
    if unknown: sys.exit(f"{g['id']}: unknown requirement keys {sorted(unknown)}")
    c=[]
    if 'legacy_engine_result' in req: c.append({'op':'legacy','id':req['legacy_engine_result']})
    if 'min_night_completed' in req: c.append({'op':'night','min':int(req['min_night_completed'])})
    if 'scene_completed' in req: c.append({'op':'scene','id':req['scene_completed']})
    if 'evidence_acquired' in req: c.append({'op':'evidence','ids':list(req['evidence_acquired'])})
    if 'verified_evidence_all' in req: c.append({'op':'verified','ids':list(req['verified_evidence_all'])})
    if 'puzzles_all' in req: c.append({'op':'puzzles','ids':list(req['puzzles_all'])})
    for scene,value in (req.get('choice_equals') or {}).items(): c.append({'op':'choice','scene':scene,'value':value})
    if req.get('victim_names_preserved') is True: c.append({'op':'preserved'})
    if req.get('external_submission') is True: c.append({'op':'submitted'})
    if req.get('explicit_confirm_ending') is True: c.append({'op':'confirm'})
    if 'selected_archive_scene' in req: c.append({'op':'archiveScene','id':req['selected_archive_scene']})
    if 'final_choice' in req: c.append({'op':'final','value':req['final_choice']})
    out.append({'id':g['id'],'title':g['title'],'type':g['type'],'priority':int(g['priority']),'terminal':bool(g['terminal']),'cutscene':g['cutscene_ref'],'policy':g.get('missing_evidence_policy'),'conditions':c})
ids=[g['id'] for g in out]
assert ids==[f'E{i:02d}' for i in range(1,31)],ids
doc={'source':'story-plan/v1.3/ending_gates_30_simulated.json','generated':datetime.date.today().isoformat(),'gates':out}
json.dump(doc,open(dst,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print('wrote',dst,len(out),'gates')
