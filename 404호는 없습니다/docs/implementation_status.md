# 구현 상태 (v0.17.0, 2026-10-14)

배포는 하지 않았습니다. 운영 사이트·스토어·외부 공개 작업이 없고 공유 설정도 바꾸지 않았습니다. 사용자 저장을 지우는 동작도 추가하지 않았습니다. 바뀐 것은 다음 둘뿐입니다.

- 작업 브랜치 `claude/ecstatic-galileo-qeuh0f`의 커밋
- 프로젝트 Drive에 버전명으로 올린 작업 문서

전체 완료율은 추정하지 않습니다. 아래 표의 칸마다 실제 상태를 적었습니다.

## 1. 이번 작업 결과 (작업 지시 [8]의 8개 구분)

### ① 프레임 반입 수 / 기대 수

- **1,296 / 1,296**(9명 x 3방향 x 48)입니다.
- 독립 ZIP **93 / 93**을 받았습니다.
- 원본은 `asset-source/v05_frames/`에 그대로 보관했습니다.

### ② 무결성 통과 / 실패 / 누락

- 통과 1,296, 실패 0, 누락 0입니다.
- 검사 항목: ZIP 해시, 안의 파일 해시, `checksums_v05.json` 해시, 720x1280 RGBA, config·rig 연결
- 근거 파일: `V05_IMPORT_RESULT.json`, `V05_VERIFY_REPORT.json`, `tests/v05-frames.test.mjs`
- 무결성 PASS는 품질 PASS가 아닙니다.

### ③ 걷기 품질 판정 (`docs/animation_qa.md`)

| NPC | 정면(입장) | 측면 | 후면(퇴장) | 입장→대기→퇴장 |
|---|---|---|---|---|
| NPC02~NPC05, NPC07~NPC10 | REVISE | REVISE | REVISE | REVISE |
| NPC06 | REVISE | REVISE | REVISE | **BLOCKED** (렌더 경로 끊김) |

PASS는 0개입니다. 측정 항목(발 교차, 디딤발 고정, 발바닥 위치, 얼굴·크기 일관성, BG02 원근)은 27/27 통과했습니다. 그래도 그림·동작 결함이 남아 있습니다.

- 다리가 판처럼 그려짐
- 몸통이 돌지 않음
- 측면에서 무릎이 굽은 채 걸음
- 반대편 팔이 띠처럼 보임
- 들고 있는 팔이 고정됨
- 대기·돌아서기 그림이 없음

### ④ 실제 게임 적용

- **걷기 클립 적용 0개입니다.** 모든 방문객이 정지 대기를 유지합니다.
- 이유는 `walk_clips.json`의 `npcs.<id>.review`에 기록했습니다.
- `stage.js`의 `clipUsable()`이 다음을 모두 만족해야 클립을 받습니다.
  - 패키지 PASS
  - 프레임 검수에서 정면·후면·연속이 PASS
  - 이음 0.15m 이하
- QA 뷰어에서만 실제 프레임을 재생합니다(입장→대기→퇴장 포함).

### ⑤ 남은 그림·동작 요청

- 걷기 클립 제작 요청 64건이 있습니다(`production_requests_v05.json`, P1 28).
- 빠진 승인 에셋 41건은 `docs/missing_assets_request.json`에 있습니다.
  - P1 13건: 역할 그림 9, CH06, CH08, BG08 승인본, BG13_2004
  - P2 1건
  - P3 27건

### ⑥ 기획 충돌 해결 / 미해결 (`docs/planning_conflicts.md`)

- **이번에 근거로 정한 것:**
  - 1번: E03~E05는 1야간 회차 결말로만 처리. 다음 야간은 열려 있고 저장은 지우지 않음(v1.3)
  - 6번: E28·E29는 최종 선택 값으로 갈림(v1.3)
  - 11번: EV06 접수 21:28과 방화 21:25를 다른 시각으로 유지
  - 21번: NPC06 이음 원인 확정
- **미해결 질문:**
  - Q1 관리소장 이름(정대식/정범수)
  - Q2 EV15 날짜(지금 2006-05-12가 02 연표의 2004-11~2005와 어긋남)
  - Q3 장면 대사와 결말 연결
  - Q4 엔딩 대사
  - Q5 증거보드 3탭

### ⑦ 실제 테스트 PASS / FAIL / SKIP

4절에 적었습니다.

### ⑧ 구체적인 막힌 점

1. **복구 ZIP을 받지 못함:** 역할 그림·CH06·CH08·BG 승인본이 든 복구 ZIP(9.4~17.8MB)을 이 세션의 Drive 연결 도구로 받지 못했습니다. 9.4MB ZIP에서 "응답 메시지가 너무 큼"으로 연결이 닫혔습니다. 1.9MB 이하 독립 ZIP으로 올리면 받을 수 있습니다.
2. **다시 렌더할 수 없음:** v05 부품 그림 25개가 없어 걷기 프레임을 다시 렌더할 수 없습니다. 제작 요청은 제작 측에서 처리해야 합니다.
3. **실기기 없음:** 실기기 테스트를 할 수 없었습니다(SKIP).

## 2. 대상별 상태

표기: ✅ 됨 · ⚠️ 일부 · ❌ 안 됨 · — 해당 없음

| 대상 | 파일 확보 | 데이터 연결 | 게임 적용 | 형식 검사 | 시각 품질 | 저장·엔딩 검증 |
|---|---|---|---|---|---|---|
| 배경 | ⚠️ 승인 항목 15개 중 승인본 12개 확보. BG08 v01(미승인) 별도. BG06 내부·BG08 승인본·BG13_2004 미확보 | ✅ `scene_layout.json` | ⚠️ 게임 파일 12 ID, 실제 사용 10 ID, 데이터만 BG03·BG06 | ✅ 해시, 720x1280, 불투명, 연도 규칙 | ⚠️ BG02·BG01·BG05·BG09는 실제 화면 확인. 나머지 좌표는 추정값 | ✅ |
| 승인 인물 CH09·CH10·MC15·MC25 | ✅ 4/4 | ✅ 기록 인물 7장면 | ✅ BG02 위 정지 대기 | ✅ | ✅ | ✅ |
| 기록 인물 CH06·CH08 | ❌ (요청 P1) | ✅ 대기 목록 5장면 | ❌ 글만 나옴 | — | — | ✅ |
| 방문객 역할 그림 NPC01~NPC10 | ⚠️ NPC02 게임판, NPC01 승인 원본(v0.17). 8장 미확보 | ✅ 역할 매핑(전원 켜기 대기) | ❌ 10장이 모여야 켬. 지금은 레거시 v2 그림 | ✅ | — | ✅ |
| v05 걷기 NPC02~NPC10 | ✅ 원본 프레임 1,296, 설정·리그 9/9. 부품 그림 0/25 | ✅ `walk_clips.json`(검수 결과·실측 이음 포함), QA 아틀라스 9 | ❌ 검수 미통과로 의도적으로 안 함 | ✅ 1,296/1,296 | ❌ REVISE 35 · BLOCKED 1 · PASS 0 | — |
| 입장→대기→퇴장 상태기계 | — | ✅ `walk.js` | ✅ 정지 인물(제자리 불투명도) | ✅ 되감기·역재생 없음 | ✅ | ✅ |
| 증거 본문 20건 | ✅ | ✅ | ✅ 확대 뷰어 | ✅ | ✅ | ✅ |
| 긴급 신고 | — | ✅ `run.reports` | ✅ 판정과 별도 | ✅ | ✅ | ✅ 엔딩·점수 영향 없음 |
| 저장·마이그레이션 | — | ✅ `404_story_v3` | ✅ | ✅ 손상 저장 보관·복구 | — | ✅ 120번 재시작, 회차 종료 ≠ 저장 삭제 |
| 오프라인 | — | ✅ `sw.js` 캐시 `room404-v0.17.0` | ✅ | ✅ 게임이 읽는 파일 전부 사전 캐시(`tests/sw.test.mjs`) | — | ✅ 오프라인 재시작(브라우저) |
| QA 뷰어 | — | ✅ 실제 프레임, 연속 재생, 검수 결과 | — 배포 밖 | ✅ | ✅ | — |
| 에셋 레지스트리 | ✅ 1,552개 해시 | ✅ | — | ✅ 8개 검사(요청 JSON 포함) | — | — |

## 3. 게임 흐름

v0.16.0과 같습니다.

- N1과 E01~E06은 기존 엔진 판정을 씁니다. N2~N5는 v1.2 슬롯을 쓰고, 엔딩은 v1.3 조건 30개를 씁니다.
- 긴급 신고와 출입 판단은 따로 처리합니다.
- 2004년 피해자는 2026년 방문객이나 기록 인물로 나오지 않습니다(`world.test.mjs`).
- v0.17.0에서 바뀐 것:
  - E03~E05가 회차 결말일 뿐 저장 삭제·다음 야간 잠금이 아님을 테스트로 고정
  - EV06 시각 의미 검사
  - 오프라인 캐시 이름 갱신과 검사
  - 걷기 클립 사용 조건 강화

## 4. 테스트 결과 (2026-10-14, 이 세션에서 실행)

| 명령 | 결과 |
|---|---|
| `npm test` | **71/71 통과**, 종료 코드 0. v0.16의 62개에 v05-frames 4, sw 3, world 1(EV06 시각), registry 1(요청 JSON)을 더함. E03~E05 회차 결말 검사는 기존 gates 테스트 안에 추가 |
| `npm run test:ui` | **36/36 통과**, 종료 코드 0. browser 10, story-ui 8(5야간 클릭, 120번 재시작, 엔딩 30개 화면 + E03~E05 뒤 2야간 버튼·저장 유지), game-ui 10, qa-ui 8(실제 프레임 레이어, NPC06 입장→대기→퇴장) |
| `npm run test:all-cases` | **사건 100개 / 장면 300개 통과**, 자바스크립트 오류 0, 종료 코드 0 |
| `python3 scripts/verify-v05-frames.py` | **1,296/1,296 PASS**, 종료 코드 0 |
| 실기기(Android/iOS) | **SKIP**. 실제 휴대폰이 없음. Chromium 모바일 에뮬레이션(390x844, 터치)과 320~1280px 폭은 실기기 검증으로 세지 않음 |

작업 지시 [7] 항목별:

| 항목 | 결과 | 근거 |
|---|---|---|
| 에셋 누락·해시·알파 | PASS | `registry.test.mjs` 8, `v05-frames.test.mjs` 4 |
| 캐시 갱신 | PASS | `sw.test.mjs` 3(캐시 이름 = 게임 버전, 이전 캐시 삭제, 사전 캐시 목록) |
| 방문객 입장→조사→판정→퇴장 | PASS | `browser.mjs`, `game-ui.mjs`(인터폰 무대, 도구에서 돌아와도 입장 재생 안 함) |
| 정지 대기 대체 | PASS | `stage.test.mjs`(REVISE 클립 9명 전부 거부), `qa-ui.mjs` |
| 긴급 신고와 판정 분리 | PASS | `game-ui.mjs`, `world.test.mjs` |
| 증거 확대·키보드·터치 | PASS | `game-ui.mjs` |
| 야간 전환과 저장 복구 | PASS | `story-ui.mjs`(5야간 클릭, 120번 재시작) |
| 중복 적용 방지 | PASS | `browser.mjs`(중복 판정 없음), `gates.test.mjs`(야간 재처리 없음) |
| 영향받는 엔딩 조건 | PASS | `gates.test.mjs`(30개 양성·음성, E03~E05 회차 결말), `story-ui.mjs`(엔딩 30개 화면) |
| 오프라인 재시작 | PASS | `browser.mjs` offline cold reload |
| 걷기 클립 시각 품질 | REVISE(자동 PASS와 별도) | `docs/animation_qa.md` |

화면 증거는 다음 위치에 있습니다.

- `room404/test-artifacts/` (qa-viewer-frames.png, qa-viewer-seq-NPC06-*.png 등)
- `asset-source/v05_QA/frame_qa/` (검수 시트·증거 이미지)

## 5. 실행 방법

```bash
cd "404호는 없습니다/room404"
npm ci
npm test && npm run test:ui && npm run test:all-cases
npm run qa        # <주소>/room404/dist/ = 게임, <주소>/room404/qa/ = 내부 QA 뷰어
```

v05 프레임과 검수 자료를 다시 만들 때는 다음 순서로 실행합니다.

```bash
python3 import_v05_frames.py --packages <ZIP 93개 폴더> --output ../asset-source/v05_frames   # 제작 측 스크립트
python3 scripts/verify-v05-frames.py      # 무결성
python3 scripts/import-v05-frames.py      # QA 아틀라스
python3 scripts/build-walk-binding.py     # walk_clips.json
python3 scripts/analyze-v05-frames.py     # 실측과 검수 시트
python3 scripts/build-v05-review.py       # 판정·제작 요청 (visual_review_v05.json을 읽음)
python3 scripts/build-walk-binding.py     # 판정 반영
python3 scripts/build-asset-registry.py
python3 scripts/build-missing-request.py
```
