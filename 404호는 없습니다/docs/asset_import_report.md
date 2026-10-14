# 에셋 반입 보고 (v0.18.0, 2026-10-14)

## 0. v0.18.0 반입: 복원 전달 41 source ZIP (2026-10-14)

전달 폴더는 Drive `1OjyxfqzZS7wWfcNo-ppjmi2dYft7i1xM`입니다. `CLAUDE_NEXT.md`를 먼저 읽고 받았습니다. 이번 전달은 원본 확보이며, 걷기 품질 PASS가 아닙니다.

### 0-1. 받기와 검증

| 단계 | 결과 |
|---|---|
| 받은 파일 | `SOURCE_MANIFEST.json`, `MATCH_REPORT.json`, `restore_sources.py`, `source_000.zip`~`source_040.zip` **41/41**. ZIP은 모두 1.9MB 이하이고 Drive 연결 도구로 받았음. 실패·재시도 0 |
| ZIP 크기·SHA-256 | 매니페스트와 41/41 일치 |
| `python3 -I restore_sources.py --verify-only` | `{"status": "VERIFIED", "files": 169, "packages": 41}` |
| `python3 -I restore_sources.py` (새 빈 폴더로) | `{"status": "RESTORED", "files": 169, "packages": 41}` |
| 독립 재검사 | 169/169 매니페스트 바이트·해시 일치, 그림 50/50 끝까지 해독(PIL load) |
| 요청 41건 대조 | `MATCH_REPORT.json`의 공통 필드가 `docs/missing_assets_request.json`(v0.17.0)과 차이 0. 41/41이 기대 SHA-256으로 복원 파일과 일치. MATCH_REPORT의 `visualQA`는 전부 `NOT_REASSESSED` |

`restore_sources.py`는 받은 그대로 `-I`(격리)로 실행했습니다. 복원은 새 빈 폴더(scratch)에 했고 저장소에는 아래 반입 스크립트로만 옮겼습니다.

### 0-2. 저장소로 옮김 (`room404/scripts/import-v06-sources.py`)

- 169개를 다시 해시하고 그림을 해독한 뒤, 하나라도 틀리면 아무것도 쓰지 않고 멈추는 방식입니다.
- 바이트는 그대로 복사했습니다(크기 변경·재인코딩 없음). 덮어쓰기는 없고, 같은 바이트가 있으면 기록만 했습니다.

| 구분 | 수 | 위치 |
|---|---|---|
| 새로 복사 | **41** | 아래 3줄 |
| 게임 출력본 인물 | 11 | `asset-source/01_캐릭터/game/` (CH06, CH08, NPC01, NPC03 v02, NPC04~NPC10) |
| 게임 출력본 배경 | 5 | `asset-source/02_배경/game/` (BG04·BG05 WebP, BG06 내부, BG08 승인본 base_v02, BG13_2004) |
| v05 부품 그림 | 25 | `asset-source/v05_QA/code/<NPC>/assets/` (렌더 입력) |
| 이미 같은 바이트가 있음 | **128** | v05 렌더 코드·설정·리그·옛 QA 기록 119개(저장소 `v05_QA/code`와 같음), 패키지마다 든 BG02 사본 9개(`02_배경/game/BG02`와 같아 두 번 두지 않음) |
| 전달 기록 | 4 | `asset-source/v06_sources/` (매니페스트, 대조 보고, 복원 스크립트, `SOURCE_IMPORT_RESULT.json`) |

- **NPC01:** 복원된 게임 출력본(6679a805…)은 승인 원본(c6836c1c…)과 **픽셀이 모두 같습니다**(1,573,352 픽셀 중 차이 0). PNG 압축만 다릅니다. Drive의 잘린 사본(eaee7a07…)은 쓰지 않았습니다.
- **옛 QA 기록:** 패키지 안의 `QA_v05.json`, `frame_connectivity_check.json` 같은 옛 QA 기록은 과거 결과로만 보관했습니다. v06 판정 근거로 쓰지 않았습니다.

### 0-3. 게임 파일과 연결 (`build-stage-assets.py`)

| 대상 | 게임 파일 | 연결 | 확인 |
|---|---|---|---|
| CH06 장혜숙, CH08 서민아 | `dist/assets/v5/figure-CH06/CH08.webp` | 기록 인물 장면 N2_04·N3_04·N5_06(CH06), N2_06·N5_07(CH08). `contacts_waiting_for_files`는 비었음 | BG02 인터폰 무대에서 발·키·그림자(`tests/figures-qa.mjs`), 5야간 실제 클릭 진행 중 화면(`story-ui`) |
| 방문객 역할 그림 NPC01~NPC10 | `dist/assets/v5/figure-NPC01~10.webp` | `character_assets.json` `visitor_role_figures` 10/10. **게임에서는 꺼 둠**(아래) | BG02 무대 10/10: 발이 서는 점 위, 키는 `height_m`대로, 그림자 둘 |
| BG08 관리사무소(승인본) | `dist/assets/bg/BG08.webp` | 관리실에서 찾은 문서 EV03·EV15의 배경(`usage.evidence_found_at`). "찾은 곳 · 2026년 관리사무소"로 표시 | v02는 v01과 방 배치가 달라 좌표를 다시 읽음 |
| BG06 엘리베이터 내부 | `dist/assets/bg/BG06_interior.webp` | 좌표만(기획에 쓰는 장면 없음) | — |
| BG13 2004 외관 | `dist/assets/bg/BG13_2004.webp` | 좌표만(2004 상태라 현재 장면에 안 씀, 기획에 장면 지정 없음) | 2026판과 건물 윤곽 이동 0px(가장자리 상관 0.97) |
| BG04·BG05 WebP | 없음 | 게임 파일은 계속 941x1672 원본 PNG에서 만듦(WebP는 같은 원본의 확대 출력) | 해시 일치, 레지스트리에 등록 |

**역할 그림을 켜지 않은 이유:** 10장 모두 확보·승인·무대 표시를 확인했습니다. 그런데 CCTV 재생(`replay.js`)은 기존 8개 외형의 걷기·몸짓 그림을 그립니다. 인터폰만 바꾸면 같은 방문객이 두 화면에서 다른 사람으로 보입니다. 예를 들어 V001(귀가 주민)은 인터폰에서 초록 재킷의 남자(NPC01), CCTV에서 회색 코트의 여자(외형 1)가 됩니다. 이는 "같은 옷차림" 단서(A001, A075)와 충돌합니다. 그래서 `visitor_roles_enabled`는 false로 두었고, 이유는 `visitor_roles_status.blocked_by`에 적었습니다. 이 10장은 역할별 공용 그림이며 방문객 100명 각각의 고유 원화가 아닙니다.

### 0-4. 레지스트리 (v0.18.0)

- `asset_registry.json`은 1,647개입니다(v0.17.0 1,552).
- 원본 해시와 파생본 해시(`derivedFrom`)를 따로 적었습니다.
- 새 분류:
  - `animation_art`: 부품 그림 25
  - `delivery_record`: 3
  - v06 `qa_atlas`, `review_video`
- `missing`은 186줄입니다(v0.17.0 227). v05 부품 그림과 요청 41건의 파일이 빠졌습니다.

---

# 이전 기록 (v0.17.0)


## 0. v0.17.0 반입 (2026-10-14)

### 0-1. v05 걷기 원본 프레임

받은 곳: Drive 폴더 1WGKr1rLNaUORGJMp-8IZaRQStqddjeiU. 독립 ZIP 93개(각 1.9MB 이하, 분할 압축 아님)와 `TRANSFER_MANIFEST.json`, `import_v05_frames.py`, `CLAUDE_후속지시_반입과검수.md`가 있었습니다.

| 단계 | 결과 |
|---|---|
| 첫 ZIP(NPC03 part003) | 먼저 받아 크기·SHA-256·안의 파일 10개 해시를 확인한 뒤 나머지를 받음 |
| ZIP 93개 | **93/93** 받음. ZIP마다 크기와 SHA-256, 안의 파일마다 SHA-256을 매니페스트와 대조해 모두 일치. 실패·누락 0 |
| 제작 측 반입 스크립트 | `python3 import_v05_frames.py --packages <받은 폴더> --output asset-source/v05_frames`. 종료 코드 0, `V05_IMPORT_RESULT.json`: TRANSFER_VERIFIED, quality REVISE, engine_applied false, 인물마다 144장 |
| 독립 검사 `scripts/verify-v05-frames.py` | **1,296/1,296 PASS**. 인물마다 다음을 확인: 매니페스트와 `checksums_v05.json` 두 기록의 해시, 720x1280 RGBA PNG, 투명이 아닌 화소 존재, 남는 파일 없음, config id = 폴더, rig_path 파일 있음, 설정·리그·바인딩·QA 파일이 재현 코드 사본과 바이트까지 같음. 결과는 `V05_VERIFY_REPORT.json` |
| 원본 보관 | `asset-source/v05_frames/<NPC>/sprites/<view>/0000-0047.png` 그대로. 자르기, 가운데 맞춤, 좌우 반전, 크기 변경 없음 |
| QA용 아틀라스 | `scripts/import-v05-frames.py`가 원본을 읽어 `asset-source/v05_QA/frames/<NPC>/atlas.webp`(0.5배)와 `atlas.json`을 만듦. 프레임마다 자기 알파 상자와 오프셋을 저장(패커의 trim+offset)하고, 모든 사각형이 원래 알파 상자로 돌아가는지 확인함. 게임 빌드 밖 |
| 인물·설정 연결 | NPC06만 `walk_rig_elder_v04.json`, 나머지는 `walk_rig_scene_retimed_v01.json`. `walk_clips.json`이 같은 리그를 씀(`tests/v05-frames.test.mjs`) |
| 품질 | 반입 성공은 품질 PASS가 아님. 프레임 검수 결과는 `docs/animation_qa.md` (전부 REVISE, NPC06 연속 BLOCKED) |

v05 부품 그림(`assets/` 25개)은 이 패키지에 없습니다. 그래서 README의 렌더 명령은 실행되지 않습니다(제작 측 안내와 같음).

### 0-2. 남은 미술 에셋 찾기

| 대상 | 결과 |
|---|---|
| NPC01 정면 | Drive에 두 개가 있었음. originals 사본(1P5Jooxpp…, 1,108,538바이트)은 승인 기록 SHA-256 c6836c1c…와 일치해 `asset-source/01_캐릭터/originals/`에 반입(PASS, 게임 미선택). game 사본(1CDivKEz…, 327,769바이트)은 SHA-256 eaee7a07…로 기대값 6679a805…와 다르고 PNG가 잘려 있어 쓰지 않음 |
| NPC03~NPC10 정면, CH06, CH08, BG08 base_v02, BG13_2004, BG06 내부 | Drive 제목 검색(영문 이름 포함)으로 낱개 파일을 찾지 못함. 복구 ZIP 8개 중 가장 작은 9.4MB ZIP을 한 번 받으려 했으나 이 세션의 Drive 연결 도구가 "응답 메시지가 너무 큼"으로 닫힘. 비슷한 파일로 대체하지 않음 |
| 요청 목록 | `docs/missing_assets_request.json` 41건(P1 13, P2 1, P3 27) |

### 0-3. 레지스트리 (v0.17.0)

| qaStatus | 수 |
|---|---|
| REVISE | 1,344 (v05 원본 프레임 1,296 + QA 아틀라스 18 + 리그·설정 30) |
| LEGACY_IN_GAME | 99 |
| PASS | 66 (NPC01 승인 원본 추가) |
| NOT_GAME_ASSET | 36 |
| REFERENCE_ONLY | 5 |
| UNREVIEWED | 1 (BG08 v01) |
| PASS_TEXT_LAYOUT_PER_ITEM | 1 |

- 전체 1,552개입니다.
- missing은 227줄로, v05 스프라이트 27줄이 빠지고 NPC01 원본 1줄이 빠졌습니다.
- v05 프레임과 아틀라스는 `selectedFor`가 `qa_viewer`뿐입니다. 게임 선택이 없는 것을 `registry.test.mjs`가 검사합니다.

---

아래 1~5절은 v0.16.0 기록입니다.

자료를 가져온 곳은 두 곳입니다.

- Drive 프로젝트 폴더 `404호는 없습니다_게임 개발`(1lsBgozx…)
- 인수인계 폴더(1jpjKUHM…): `CLAUDE_CODE_404_게임구현_프롬프트.md`, `extract_404_archives.py`, `ZIP_압축해제_목록_20261013.json`, `압축해제_실행결과_20261013.md`

모든 반입 파일은 SHA-256을 패키지 기록과 대조했습니다. 대조한 기록은 `ZIP_압축해제_목록_20261013.json`, `download_integrity_v02.json`, `checksums_v05.json`입니다. 무결성 PASS(바이트가 같음)와 검수 PASS(그림 품질 승인)는 다릅니다. 검수 상태는 `asset_registry.json`의 `qaStatus`와 `qaBasis`에만 적습니다.

## 1. 압축 해제 (작업 지시 3항)

| 단계 | 결과 |
|---|---|
| 매니페스트 | ZIP 98개, 2,072,965,448바이트(인수인계 기록: 97개 정상, 1개 손상) |
| 이 세션에서 받은 ZIP | 15개(3MB 이하 전부). SHA-256이 매니페스트와 모두 일치 |
| 받지 못한 ZIP | 83개. 3MB를 넘는 ZIP은 그 세션의 Drive 연결 도구로 받지 못했고(그 환경의 도구 동작이며 Drive의 일반 제한이 아님. v0.17에서는 1.9MB 이하 독립 ZIP 93개를 정상으로 받음), `drive.usercontent.google.com` 직접 내려받기는 프록시가 403으로 막음. 손상 ZIP `01_캐릭터_이전업로드_불완전_사용금지.zip`은 받지 않음 |
| `extract_404_archives.py` 실행 | 받은 15개를 원래 경로 구조로 놓고 그대로 실행. EXTRACTED 15개, 파일 558개. 받지 못한 83개 때문에 종료 코드 1(스크립트 설명대로) |
| 보고서 | `docs/extraction/EXTRACTION_REPORT_session_20261013.json`, 실행 기록 `docs/extraction/extract_run_session_20261013.log` |

풀어 낸 15개의 내용은 다음과 같습니다.

- **기획 ZIP 4개(v1.0~v1.3):** 파일 113개가 `story-plan/`의 사본과 바이트까지 같습니다. 그래서 저장소에 다시 넣지 않았습니다.
- **`07_검수완료` 승인 목록:** `character-v5/docs/approved_static_assets_v01.json`과 같습니다.
- **`06_애니메이션` 모션 명세 1개:** 검수 기준으로 읽었습니다(`docs/animation_qa.md`).
- **v0.2 앱 코드, 옛 보행 코드(v01·v02·v04), MC05~MC30 제작 기록, 제작 재개 자료:** 과거 버전이라 현재 저장소를 덮어쓰지 않았고 게임에도 쓰지 않았습니다(작업 지시 "과거 ZIP 코드로 덮어쓰지 말 것").
- **v05 재현 코드·QA(434KB):** 아래 2절처럼 반입했습니다.

## 2. 저장소에 넣은 원본 (`asset-source/`, 게임 빌드 밖)

| 폴더 | 파일 | 대조 기준 | 비고 |
|---|---|---|---|
| `02_배경/game/` | BG01~BG03, BG06~BG12, BG13_2026 WebP 1080x1920 11장. BG04·BG05는 941x1672 원본 PNG 2장 | `download_integrity_v02.json` 13/13 일치 | BG08 v01은 승인 목록 밖(아래 4절) |
| `04_증거소품/` | `evidence_readable_20_v03.json` | Drive 원본 바이트 | 증거 화면 본문 |
| `05_UI/` | UI01~UI20 PNG·SVG 40개, 목록·문구 JSON 3개 | ZIP SHA-256 일치 | 게임 UI는 DOM/CSS라 연결하지 않음 |
| `v05_QA/code/` | NPC02~NPC10 설정·바인딩·리그·체크섬·QA 기록, `validation_all_v05.json` | ZIP SHA-256 일치 | 스프라이트·부품 그림은 없음 |
| `v05_QA/review/` | NPC03·NPC09 3방향 검토 MP4 2개, 전후 비교 JPG 2장 | `checksums_v05.json` 일치 | 불투명 합성. QA 뷰어 전용 |
| `00_스타일가이드/` | `QA_NPC01_BG02_static_placement_v01.jpg` | `download_integrity_v02.json` 일치 | BG02 서 있는 위치의 근거 |
| (v0.15부터) `character-v5/png/` | CH09, CH10, MC15, MC25, NPC02 정면 | 같은 기준 | |

## 3. 게임 파일로 만든 것 (`room404/dist/`)

| 파일 | 만든 방법 | 수 |
|---|---|---|
| `assets/bg/BG*.webp` | `scripts/build-stage-assets.py`: 해시 확인 → 720x1280 WebP. 확대하지 않음 | 12장, 1.3MB |
| `assets/v5/figure-*.webp` | 같은 스크립트: 먼지 알파(≤16) 제거 → 알파 상자로 자르기 → 최대 1200px. 발 기준점·양발 위치·키(px) 기록 | 4장 |
| `data/scene_layout.json` | 배경 13개의 파일, 연도, 카메라, 수평선, 바닥선, 바닥, 서 있는 위치, 입장·퇴장 경로, 클릭 영역, 가림, 게임 사용처 | 직접 작성(격자 판독 + v05 카메라) |
| `data/walk_clips.json` | `scripts/build-walk-binding.py`: v05 `render.js` 계산을 옮김. 9명 x 3방향 x 48프레임의 발 바닥점, 몸 상자, 접지 그림자, 입장·퇴장 깊이, 미끄럼, 들고 있는 팔 | 게임은 읽지 않음(QA 뷰어 전용) |
| `data/story_evidence.json` | `scripts/merge-evidence-text.py`: 카드 v03의 본문·발급 시기·출처·카드 상태 추가 | 20건 |
| `data/character_assets.json` | 전신 컷 정보(figure), 레거시 방문객 그림 8종의 발 기준점(legacy) 추가 | |

없앤 것: v0.15 흉상 크롭 `assets/v5/bust-*.webp` 4장과 `scripts/build-character-busts.py`. 인터폰 화면이 무대 합성으로 바뀌어 쓰이지 않습니다. git 기록에는 남아 있습니다.

## 4. 반입하면서 드러난 문제

- **BG08:** 받은 `BG08_management_office_2026_v01`은 승인 목록에 없습니다. 승인본은 `…_2026_base_v02_v01`이고 받지 못했습니다. 게임 파일로 만들지 않았습니다.
- **UI PNG 중복:** UI01·UI03·UI04·UI06·UI08 다섯 개가 같은 바이트입니다. 레지스트리에서 한 항목으로 합쳤습니다.
- **증거 접수 시각:** EV06 era가 카드 본문(21:28)과 달라 era를 고쳤습니다(이전 값 21:31, 제가 넣은 DESIGN 값).
- **증거 제목·날짜:** 제목 16건이 다르고 EV15의 날짜 범위가 다릅니다. 처리는 `docs/planning_conflicts.md` 11~13번에 적었습니다.

## 5. 레지스트리 (`asset_registry.json`, 작업 지시 6항)

- **만드는 방법:** `python3 room404/scripts/build-asset-registry.py`. 저장소 안 파일을 직접 해시합니다.
- **항목:** 237개. 같은 바이트는 `duplicatePaths`로 합쳤습니다.
- **qaStatus 분포:**

| qaStatus | 수 |
|---|---|
| LEGACY_IN_GAME | 99 |
| PASS | 65 |
| NOT_GAME_ASSET | 36 (v1.1 블록아웃) |
| REVISE | 30 (v05 리그·설정) |
| REFERENCE_ONLY | 5 |
| UNREVIEWED | 1 (BG08 v01) |
| 증거 본문 JSON | 1 |

- **ID 체계 분리:** entityId에는 CH/MC/NPC/BG/UI/EV만 씁니다. 방문객 V###와 장면 N#_##는 `selectedFor`에서 `scene:`·`visitor:` 접두사로만 가리킵니다.
- **missing:** 255줄. 기대 해시가 있으며, 우선순위는 `docs/missing_assets.md`에 있습니다.
- **검사:** `tests/registry.test.mjs`. 7개 항목입니다.
  - 해시
  - ID 충돌
  - 필수 필드
  - QA 근거
  - 연도와 알파
  - 게임이 읽는 경로가 모두 등록됐는지
  - missing이 실제로 없는지
