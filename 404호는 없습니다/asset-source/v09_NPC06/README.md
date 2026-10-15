# NPC06 v09 / v09r (보정 후보 — REVISE, 게임 미적용)

제작 측 v09 보정 시험 코드(Drive `NPC06_v09_원본텍스처_보정시험_20261015`, `NPC06_v09_code.zip`)를 독립 폴더로 들인 것과,
이 저장소에서 다시 고친 v09r입니다. 입력은 그대로 `asset-source/v05_QA/code/NPC06`(원본 부품 아틀라스·팔 그림·리그·설정)이고
BG02는 `asset-source/02_배경/game`의 한 벌을 씁니다. v07/v08 생성 시트는 읽지 않습니다. NPC06만 대상입니다.

## 실행 (프로젝트 루트에서)

```
npm ci --prefix asset-source/v09_NPC06
node --expose-gc asset-source/v09_NPC06/render_source.js NPC06 asset-source/v09_QA/reference
node --expose-gc asset-source/v09_NPC06/render_v06.js NPC06 asset-source/v09_QA/default
node --expose-gc asset-source/v09_NPC06/render_v06.js NPC06 asset-source/v09_QA/candidate --art=v09
python asset-source/v09_NPC06/verify_v09.py asset-source/v09_QA/reference asset-source/v09_QA/default asset-source/v09_QA/candidate
node --expose-gc asset-source/v09_NPC06/render_v06.js NPC06 asset-source/v09_QA/render_v09r --art=v09r
python asset-source/v09_NPC06/verify_v09.py asset-source/v09_QA/reference asset-source/v09_QA/default asset-source/v09_QA/render_v09r
python3 -B -I asset-source/v09_NPC06/tools/analyze_v09.py --run default=asset-source/v09_QA/default --run v09=asset-source/v09_QA/candidate --run v09r=asset-source/v09_QA/render_v09r --ffmpeg <ffmpeg>
python3 room404/scripts/import-v06-frames.py --render asset-source/v09_QA/render_v09r --npc NPC06 --out asset-source/v09_QA/v09r --revision v09r --scale 1
```

렌더 출력(`asset-source/v09_QA/{reference,default,candidate,render_v09r}`)은 저장소에 넣지 않습니다(같은 입력에서 바이트 단위로
다시 나옴). 남기는 것: QA 아틀라스(`v09_QA/v09`, `v09_QA/v09r`), 지표(`metrics_v09.json`), 판정(`review_v09.json`),
주름 위치(`fold_position_v09.json`), 뷰어 재생 기록(`viewer_playback_v09.json`), 증거(`evidence/`), 원화 요청.

## 파일

| 파일 | 내용 |
|---|---|
| `render_source.js` | 전달본 그대로. 저장소 `asset-source/v06_render/render_v06.js`와 끝 줄바꿈 1개만 다름(기준 렌더용) |
| `render_v06.js` | 전달본 v09 렌더러 + `--art=v09r` 분기(기본·v09 출력은 바이트 동일함을 다시 확인) |
| `material_v09.js` | 전달본 그대로(v09) |
| `material_v09r.js` | v09r: 둥근 끝 없는 무릎 텍스처, 무릎 위치 주름, 골반→어깨 비틀림 + 원통 yaw, 그림 어깨 기준점 |
| `verify_v09.py`, `camera_v06.json`, `configs/`, `package*.json` | 전달본 그대로(`@napi-rs/canvas` 0.1.100) |
| `IMPORT_v09.json` | 받은 파일·해시·압축 검사·source_lock 대조·의존성·재현·반입 뒤 변경 |
| `tools/` | `analyze_v09.py`(실프레임 지표), `media_v09.py`(비교 영상·시트), `fold_position.py`, `viewer_capture.mjs`(QA 뷰어 실재생), `build_review_v09.py`, `build_requests_v09.py` |

## v09 → v09r에서 고친 것 (코드)

- 무릎 가로선: v06/v09 다리 텍스처는 허벅지 조각의 무릎 쪽 둥근 끝(어두운 윤곽)과 정강이 조각의 위쪽 둥근 끝(밝은 테)을
  무릎 교차 구간에 그대로 넣고, v09는 그 행을 가로로 늘려 선이 됨. v09r는 둥근 끝 행을 쓰지 않음(행 폭으로 찾음).
- 주름 위치: v09 정면 5.6–8.4px 위 → v09r 1.8–4.2px 위(무릎뼈 바로 위), 후면 v09 2.9–6.0px 위 → v09r −0.6~+1.6px.
- 몸통: v09는 1–2px를 실제 회전의 반대로 옮김. v09r는 밑단=골반선, 어깨=어깨선(비틀림), 리그 yaw만큼 원통 회전.
- 어깨 결합: 리그 어깨점은 그림 가디건 어깨보다 12–15px 위·2–5px 바깥. 소매 윗끝과 가방끈 꼭짓점을 그림 어깨에 맞춤
  (가방 몸체는 v06 자리 그대로, 끈 윗부분만 기울임 — 시점 전환에서 가방이 튀지 않음).

남은 것(그림 필요)은 `asset-source/v09_QA/NPC06_v09_원화수정요청.md`.
