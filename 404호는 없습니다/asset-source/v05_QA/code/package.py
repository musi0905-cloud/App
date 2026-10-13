from pathlib import Path
import json,hashlib,zipfile,subprocess,os
from PIL import Image
r=Path(__file__).resolve().parent;out=r/'deliverables';out.mkdir(exist_ok=True);allqa=[]
for n in range(2,11):
 id=f'NPC{n:02}';d=r/id;cfg=json.load(open(d/'config.json'));rig=cfg.get('rig_path','walk_rig_scene_retimed_v01.json');assert (d/rig).exists()
 sp=sorted((d/'sprites').rglob('*.png'));assert len(sp)==144
 for p in sp:
  with Image.open(p) as im:assert im.mode=='RGBA' and im.size==(720,1280)
 vids=sorted(d.glob('*v05.mp4'));assert len(vids)==4
 for p in vids:
  st=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames,width,height','-of','json',str(p)]))['streams'][0];assert int(st['nb_frames'])==(144 if '3view' in p.name else 48)
 assert hashlib.sha256((d/rig).read_bytes()).digest()==hashlib.sha256((Path('baseline_v04')/id/rig).read_bytes()).digest()
 carry=n in [3,9];qa={'id':id,'revision':'v05','status':'REVISE','technical_export':'PASS','engine_applied':False,'new_carrying_source':carry,'new_source_views':3 if carry else 0,'rig_unchanged_from_v04':True,'frames':144,'videos':4,'visual_review_scope':'first frame 3-view comparison, side 8 phases; NPC03/09 additionally front/rear 8 phases','changes':['thigh/shin upper-edge runtime alpha blend']+(['replace separate carrying-arm and prop with coherent shoulder-to-hand/prop source'] if carry else []),'remaining':['full-motion naturalness not certified','texture joints and body rotation still limited','scene lighting and contact shadows need engine-side calibration']}
 if carry:qa['carrying_arm']={'driver':'Lshoulder','Lelbow_Lwrist':'not used to deform carrying source','pose':'static bent carrying arm attached to moving shoulder','rear_mapping':'mirrored locally to keep left-arm object tucked toward torso','status':'REVISE: shoulder texture and held-arm secondary motion remain'}
 (d/'QA_v05.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2));allqa.append(qa)
 (d/'README_v05.md').write_text(f'''# {id} 손·소품 경계 수정 v05

REVISE. 엔진 적용 0. 최종 애니메이션 아님.

수정: 허벅지·종아리 위쪽 경계의 투명도 겹침. {'추가로 어깨부터 손·소품까지 연결된 새 원화로 교체. 소품을 든 왼팔은 Lshoulder에 묶인 고정된 굽힘 포즈이며 L엘보·손목 좌표로 변형하지 않는다. 반대 팔과 다리는 기존 리그로 보행한다.' if carry else '팔·소품 원화는 v04 유지. 다른 인물의 새 소품 부품을 이 인물에 재사용하지 않음.'}

sprites/: 방향별48장, 720×1280 RGBA. MP4는 합성 검토용. assets/는 기존 소스와 새 소스(해당 인물만). config.json에서 실제 rig_path를 확인. 원본 v04는 보존했다. 얼굴·배경·발 궤적 변경 없음.

Node.js, @napi-rs/canvas 0.1.100, Python, ffmpeg/ffprobe 필요. npm install 후 npm run render → npm run qa → npm run encode. 배경합성 전체PNG는 재출력 가능하며 이 ZIP은 방향별 첫 프레임과 합성 영상 포함. 루트 이동이 있어 마지막 프레임을 첫 프레임으로 위치까지 초기화하는 단순 반복은 순간 이동함.

원화 생성 여부와 검수 범위는 QA_v05.json 참고. 형식 검사 PASS는 품질 PASS를 뜻하지 않음.
''',encoding='utf8')
 files=sp+vids+list((d/'assets').glob('*'))+list(d.glob('*.js'))+list(d.glob('*.py'))+[d/'config.json',d/'binding.json',d/'package.json',d/rig,d/'QA_v05.json',d/'README_v05.md',d/'comparison_v04_v05.jpg',d/'frame_connectivity_check.json',d/'execution_v05.json']+list(d.glob('QA_*phase.jpg'))+[d/f'renders/{v}/0000.png' for v in ['front','side','rear']]
 if carry:files.append(d/'carrying_binding_v05.json')
 files=sorted(set(files));(d/'checksums_v05.json').write_text(json.dumps({str(p.relative_to(d)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},indent=2));files.append(d/'checksums_v05.json');target=out/f'{id}_손소품경계_REVISE_v05.zip';tmp=r/f'{id}_pack.tmp'
 with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=4) as z:
  for p in files:z.write(p,p.relative_to(d))
 with zipfile.ZipFile(tmp) as z:assert z.testzip() is None
 os.replace(tmp,target);print(id,'validated packaged',flush=True)
(r/'validation_all_v05.json').write_text(json.dumps(allqa,ensure_ascii=False,indent=2))
