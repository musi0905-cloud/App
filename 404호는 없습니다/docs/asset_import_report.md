# 에셋 반입 보고 (v0.17.0, 2026-10-14)

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
| 받지 못한 ZIP | 83개. 3MB를 넘어 Drive 도구로 받을 수 없었고, `drive.usercontent.google.com` 직접 내려받기는 프록시가 403으로 막음. 손상 ZIP `01_캐릭터_이전업로드_불완전_사용금지.zip`은 받지 않음 |
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
