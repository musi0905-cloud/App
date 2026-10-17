# 구현 상태 (v0.19.0, 2026-10-17)

배포는 하지 않았습니다. 운영 사이트·스토어·외부 공개 작업이 없고 공유 설정도 바꾸지 않았습니다. 사용자 저장을 지우는 동작도 없습니다. 바뀐 것은 다음 둘뿐입니다.

- 작업 브랜치 `claude/ecstatic-galileo-qeuh0f`의 커밋
- 프로젝트 Drive 전달 폴더에 올린 작업 보고

전체 완료율은 추정하지 않습니다. 아래 수치마다 기준 총량을 같이 적었습니다.

## 000. v0.19.0 게임 적용 (2026-10-17)

자세한 것은 `report_v0.19.0.md`에 있습니다. 게임 버전과 캐시는 v0.19.0입니다.

| 구분 | 확보 | 등록 | 실제 게임 사용 중 | 미사용 |
|---|---|---|---|---|
| 배경 15 ID | 15 | 15 (`scene_layout.json`) | 11 | 4 (BG03·BG06·BG06_interior·BG13_2004: 장면 지정 없음) |
| 기록 인물 6 | 6 | 6 | 6 (12장면) | 0 |
| 방문객 역할 그림 10 | 10 | 10 | **8** (19개 사건, 인터폰+CCTV) | 2 (NPC01·NPC03: 그릴 수 있는 사건 없음) |
| 기존 방문객 외형 8 | 8 | 8 | 8 (81개 사건, 인터폰+CCTV 같은 외형) | 0 |
| NPC06 v10r5 연결 215프레임 | 215 | clip.json·페이지 7 | **인터폰 4개 사건(시각 REVISE / 사용자 예외)** | — |
| 측면 걷기(v06 side PASS) | NPC02~NPC09 각 48 | 런타임 3(NPC06·07·09) | CCTV 가로지르기 6개 사건 | NPC02·03·04·05·08(필요한 사건 없음), NPC10(REVISE) |
| 정면·후면 걷기 NPC02~NPC10 | 각 48+48 | `walk_clips.json` | 0 (REVISE, 전역 차단 유지) | 전부 |

## 00. NPC06 v09 / v09r (2026-10-15)

게임 버전은 그대로입니다(`room404/dist` 변경 없음). 자세한 것은 `report_NPC06_v09.md`와 `animation_qa.md` 00절에 있습니다.

| 구분 | 결과 |
|---|---|
| 받은 파일 | 문서 6, 코드 ZIP 1, 프레임 ZIP 13(264파일), 검토 영상 1. 해시 전부 일치. 비교 JPG 4는 받지 않음(해시만 기록) |
| 생성 | 기준·기본·v09·v09r 각 215+48프레임(이 저장소에서 렌더) |
| 형식·기술 검사 | PASS: `verify_v09.py`(v09·v09r), v09 재현 263/263 + frames.json Drive와 바이트 동일, 기본·v09 경로는 v09r 추가 뒤에도 바이트 동일 |
| 시각 QA | v09·v09r 모두 정면 다리·후면 다리·정면 몸통·후면 몸통 **REVISE**, 측면·연결·배경 합성 PASS |
| 코드로 고친 것(v09r) | 무릎 단차·가로선, 주름 위치, 몸통 비틀림·yaw 방향, 소매 윗끝, 가방끈 어깨 결합(갇힌 배경 34,017 → 7,966px) |
| 요청 | 해결 0/4. 새 원화 요청 2(소매 직물 P2, 회전 후반 가방끈 P3) |
| 게임 적용 | **없음**(NPC06 정지 대기, clipUsable false) |
| QA 뷰어 | 판 v09·v09r, 12fps, 다리·몸통 3배 확대. 테스트 11/11 |
| 레지스트리 | 1,667개(+9: v09·v09r 아틀라스 4, 비교 영상 5), missing 186 |

## 0. NPC06 v07 원화 시험 (v0.18.0 이후, 2026-10-14)

게임 버전은 그대로입니다(`room404/dist` 변경 없음). 자세한 것은 `animation_qa.md` 0절과 `report_NPC06_v07.md`에 있습니다.

| 항목 | 결과 |
|---|---|
| 받은 파일 | Drive 9/9(문서 3, v07b 3, v07a 3). PNG 6/6 해시·해독 일치 |
| 연결한 부품 | 16(다리 12상태 + 몸통 4칸), v07b만. v07a는 비교용 |
| 다시 렌더한 프레임 | v07 215+48, 같은 조건 v06 215+48. 시도 2회와 회귀 확인(9명 v06 2,248 파일, v05 1,296장) |
| 정면 / 후면 / 측면 / 연결 | **REVISE / REVISE / PASS(그대로) / REVISE** |
| 요청 4건(NPC06 LEG_STRIP·TORSO_STATIC 정면·후면) | **해결 0/4** |
| 게임 적용 | **없음**. NPC06 정지 대기, 다른 인물·역할 그림 상태 변경 없음 |
| 원화 수정 필요 | 3장 모두(R1 정면 다리, R2 후면 다리, R3 몸통) |
| 레지스트리 | 1,658개(+11: v07 그림 6, 기록 2, 검토 영상 3), missing 186 |

## 1. 이번 작업 결과 (CLAUDE_NEXT 8항의 구분)

### 파일 확보

| 항목 | 결과 |
|---|---|
| 복원 전달 41 source ZIP | **41/41** 받음, 크기·SHA-256 매니페스트와 41/41 일치. 재다운로드 0 |
| `restore_sources.py` | 검증만 `VERIFIED`, 복원 `RESTORED`(169 파일, 41 패키지) |
| 독립 재검사 | 169/169 바이트·해시 일치, 그림 50/50 완전 해독 |
| v0.17.0 요청 41건 | **41/41 해결**(기대 SHA-256 일치). P1 13 · P2 1 · P3 27 |
| 저장소로 옮김 | 새로 41개(인물 11, 배경 5, 부품 그림 25), 이미 같은 바이트 128개(덮어쓰기 0) |
| NPC01 게임 출력본 | 복원본 6679a805…가 승인 원본과 픽셀까지 같음(차이 0/1,573,352) |

### 데이터 연결

| 항목 | 결과 |
|---|---|
| 정지 인물 | CH06·CH08을 기록 인물 장면 **5개**에 연결(N2_04·N3_04·N5_06, N2_06·N5_07). 기록 인물 장면 연결은 12/12(대기 0) |
| 방문객 역할 그림 | NPC01~NPC10 **10/10** 게임 파일·데이터(`visitor_role_figures`). 승인 10/10. **켜기 0/10**(아래 막힌 점 1) |
| 배경 | 게임 파일 15 ID(새로 BG06_interior, BG08 승인본, BG13_2004). 실제 사용 11 ID(새로 BG08: 관리실에서 찾은 문서 EV03·EV15) |
| 걷기 | `walk_clips.json`에 v06 판정·구간·연속성(9명). QA 아틀라스 v06 9개 |
| 레지스트리 | 1,647개(원본과 파생본 해시 구분), missing 186 |
| 요청 목록 | `missing_assets_request.json`: 해결 41, 남은 55(P1 9 · P2 26 · P3 20) |

### 형식 검사

- 해시·해독 169/169
- 정지 인물 12장 BG02 무대(발이 서는 점 12/12, 키 = `height_m`, 그림자 둘)
- 렌더러 이식 v05 1,296/1,296 바이트 일치
- 테스트는 4절에 있습니다.

### 시각 검수

| 항목 | 결과 (기준 총량) |
|---|---|
| 정지 인물 무대 합성 | 12/12 확인(발·머리 크기·빛·그림자·가림). 실제 게임 화면: CH06·CH08 인터폰, EV03의 BG08 배경 |
| 배경 | BG08 승인본 좌표 다시 읽음, BG13 2004/2026 윤곽 일치(이동 0px) |
| 걷기 방향별 PASS | 정면 **0/9**, 측면 **8/9**, 후면 **0/9** |
| 입장→대기→회전→퇴장 PASS | **9/9** |
| v05 제작 요청 64건 | 해결 **27**(P1 10, P2 17), 남음 **37**(P1 18, P2 19, 모두 새 그림 필요) |

### 게임 적용

| 항목 | 결과 |
|---|---|
| 정지 인물 | CH06·CH08이 이야기 장면에 나옴(2명) |
| 역할 그림 | **0/10** 적용(켜지 않음) |
| 배경 | BG08 추가 사용 1(관리실 문서 배경) |
| 실제로 걷는 인물 | **0명**. 정면·후면 PASS인 클립이 없어 모든 방문객이 정지 대기 유지 |

## 2. 남은 BLOCKED와 이유

1. **역할 그림 켜기:** 10장 모두 확보·승인·무대 표시를 확인했습니다. 그러나 CCTV 재생이 기존 8개 외형을 그리므로, 켜면 같은 방문객이 두 화면에서 다른 사람이 됩니다("같은 옷차림" 단서 A001·A075와 충돌). 필요한 것은 NPC01~NPC10 CCTV 걷기·몸짓 그림 10건(P2)입니다.
2. **걷기 게임 적용:** 정면·후면 18개가 REVISE입니다. 무릎 상태별 바지 다리(LEG_STRIP)와 비튼 몸통(TORSO_STATIC)은 지금 부품 그림으로 표현할 수 없고 새 그림이 필요합니다. 이 세션에는 이미지 생성 수단이 없습니다.
3. **NPC01 걷기:** 패키지가 없습니다.
4. **실기기:** 휴대폰이 없어 SKIP입니다.

## 3. 대상별 상태

표기: ✅ 됨 · ⚠️ 일부 · ❌ 안 됨 · — 해당 없음

| 대상 | 파일 확보 | 데이터 연결 | 게임 적용 | 형식 검사 | 시각 품질 |
|---|---|---|---|---|---|
| 배경 | ✅ 승인 15항목 모두 확보 | ✅ `scene_layout.json` 15 ID | ⚠️ 11 ID 사용, BG03·BG06·BG06_interior·BG13_2004는 쓰는 장면 없음 | ✅ | ✅ BG08 v02 좌표 다시 읽음 · BG13 대조 |
| 기록 인물 CH06·CH08·CH09·CH10·MC15·MC25 | ✅ 6/6 | ✅ 12장면 | ✅ BG02 위 정지 대기 | ✅ | ✅ |
| 방문객 역할 그림 NPC01~NPC10 | ✅ 10/10 | ✅ 그림·키·발 기준점, 사건별 판정 `visitor_figures.json` | ⚠️ v0.19.0: 8/10 그림이 19/100 사건에서 인터폰·CCTV에 나옴(나머지는 CCTV 그림 없음) | ✅ | ✅ 무대 합성 10/10 |
| NPC06 v10r5 전체 방문 | ✅ 263/263 해시 일치 | ✅ clip.json(해시 연쇄) | ✅ 인터폰 4개 사건 — **시각 REVISE / 사용자 예외 승인** | ✅ | ❌ REVISE(다리 볼륨·몸통 회전·소매·가방끈 수용) |
| 걷기 NPC02~NPC10 v06 | ✅ 부품 그림 25/25 | ✅ `walk_clips.json` v06, QA 아틀라스 | ❌ 정면·후면 REVISE | ✅ | ⚠️ 측면 8/9, 연결 9/9, 정면·후면 0/18 |
| 입장→대기→퇴장 상태기계 | — | ✅ `walk.js` | ✅ 정지 인물(제자리 불투명도) | ✅ | ✅ |
| 증거 본문 20건 | ✅ | ✅ | ✅ 확대 뷰어, BG08 찾은 곳 배경 | ✅ | ✅ |
| 저장·마이그레이션·오프라인 | — | ✅ `sw.js` 캐시 `room404-v0.19.0`(역할 그림 10, 클립 페이지 7, 측면 3) | ✅ | ✅ | — |
| QA 뷰어 | — | ✅ v05·v06 판, 전체 구간, 속도 | — 배포 밖 | ✅ | ✅ |

## 4. 게임 흐름

v0.16.0과 같습니다.

- N1과 E01~E06은 기존 엔진 판정을 씁니다. N2~N5는 v1.2 슬롯을 쓰고, 엔딩은 v1.3 조건 30개를 씁니다.
- 긴급 신고와 출입 판단은 따로 처리합니다.
- 2004년 피해자는 2026년 방문객이나 기록 인물로 나오지 않습니다(`world.test.mjs`).
- v0.18.0에서 바뀐 것: 기록 인물 CH06·CH08 화면, 관리실 문서의 BG08 배경, 게임 버전·캐시 v0.18.0. 게임 판정·저장·엔딩 규칙은 바꾸지 않았습니다.
- v0.17.0에서 바뀐 것:
  - E03~E05가 회차 결말일 뿐 저장 삭제·다음 야간 잠금이 아님을 테스트로 고정
  - EV06 시각 의미 검사
  - 오프라인 캐시 이름 갱신과 검사
  - 걷기 클립 사용 조건 강화

## 5. 테스트 결과 (2026-10-14, 이 세션에서 새로 실행)

**NPC06 v07 작업 뒤 다시 실행(2026-10-15)**

| 명령 | 결과 |
|---|---|
| `npm test` | **83/83**. v07 6건 추가. registry 테스트 2건 고침: v0.18.0 커밋 상태에서도 `figures_qa.json` 미등록으로 1건이 실패하고 있었음. 아래 77/77은 커밋 상태와 맞지 않았음 |
| `npm run test:ui` | **39/39**: browser 10, story-ui 8, game-ui 11, qa-ui 10. QA 뷰어 정지 모드 경쟁 상태 재현 1건 추가 |
| `npm run test:all-cases` | 사건 100 / 장면 300, 자바스크립트 오류 0 |
| `node tests/figures-qa.mjs` | 24/24, 페이지 오류 0 |
| 렌더러 회귀 | 9명 v06 2,248/2,248 파일, v05 모드 1,296/1,296 바이트 일치 |

**v0.18.0 당시 기록**

| 명령 | 결과 |
|---|---|
| `npm test` | **77/77 통과**, 종료 코드 0. v0.17의 71개에 v06 5(복원 전달, NPC01, 렌더러 이식·상수, v06 판정, NPC06 연결)와 characters 1(CH06·CH08·역할 그림)을 더함. registry·stage 검사는 v0.18 기준으로 고침 |
| `npm run test:ui` | **38/38 통과**, 종료 코드 0. browser 10, story-ui 8(5야간 클릭 중 CH06·CH08 화면 포함), game-ui 11(EV03 BG08 찾은 곳 배경 추가), qa-ui 9(v06 전체 구간·8fps 재생 추가) |
| `npm run test:all-cases` | **사건 100개 / 장면 300개 통과**, 자바스크립트 오류 0, 종료 코드 0 |
| `node render_v06.js <NPC> --mode=v05` x 9 + `check_v05_port.py` | **1,296/1,296 바이트 일치** |
| `node tests/figures-qa.mjs` | 정지 인물 16 + 레거시 8, 발이 서는 점·그림자 24/24 |
| 실기기(Android/iOS) | **SKIP**. 실제 휴대폰이 없음. Chromium 모바일 에뮬레이션은 실기기 검증으로 세지 않음 |

CLAUDE_NEXT 7항 회귀 항목:

| 항목 | 결과 | 근거 |
|---|---|---|
| 해시·해독 | PASS | `v06.test.mjs`, `registry.test.mjs` |
| 전환(입장→판정→퇴장) | PASS | `browser.mjs`, `game-ui.mjs` |
| 클릭 영역 | PASS | `stage.test.mjs`, `qa-ui.mjs` |
| 오프라인 캐시 | PASS | `sw.test.mjs`, `browser.mjs` offline cold reload |
| 저장 호환 | PASS | `story-ui.mjs`(120번 재시작, 옛 저장 이전) |
| 긴급 신고 분리 | PASS | `game-ui.mjs`, `world.test.mjs` |
| 증거 본문 | PASS | `game-ui.mjs`(EV06 본문, EV04 사진 없음 안내, EV03 찾은 곳) |

화면 증거:

- `room404/test-artifacts/`(story-contact-CH06/CH08.png, evidence-viewer-found-at-BG08.png, qa-viewer-v06-*.png, figures/)
- `asset-source/v06_QA/<NPC>/`(시트·비교 영상)

## 6. 실행 방법

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

v06 다시 렌더와 검수(부품 그림은 `asset-source/v05_QA/code/<NPC>/assets/`):

```bash
cd "404호는 없습니다/asset-source/v06_render" && npm install          # @napi-rs/canvas 0.1.100
sh run_all.sh <출력 폴더>                                               # 9명, render_v06.js (프레임은 저장소에 넣지 않음)
cd ../../room404
python3 scripts/analyze-v06-frames.py --render <출력 폴더> --ffmpeg <ffmpeg>   # 측정·시트·비교 영상
python3 scripts/build-v06-review.py                                     # visual_review_v06.json을 읽어 판정·남은 요청
python3 scripts/import-v06-frames.py --render <출력 폴더>               # QA 아틀라스
python3 scripts/build-walk-binding.py && python3 scripts/build-asset-registry.py && python3 scripts/build-missing-request.py
```
