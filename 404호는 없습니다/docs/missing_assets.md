# 빠진 에셋과 남은 제작 과제 (v0.17.0, 2026-10-14)

요청 목록은 기계가 읽을 수 있게 `docs/missing_assets_request.json`에 두었습니다. 41건이며 `scripts/build-missing-request.py`가 기록에서 만듭니다. 필드는 다음과 같습니다.

- assetId
- entityId
- era
- expectedFilename
- sourceDriveId
- sourceUrl
- expectedSha256
- priority
- blockingReason

없는 정보는 null로 두었습니다. 레지스트리 전체 대조 목록은 `asset_registry.json`의 `missing` 227줄입니다. "받지 못함"은 이 세션이 파일을 손에 넣지 못했다는 뜻이고, 원본이 없다는 뜻이 아닙니다.

## v0.17.0에서 들어온 것

- **v05 걷기 원본 프레임 1,296장**(NPC02~NPC10 x 3방향 x 48)과 인물별 설정·리그·바인딩·QA 파일입니다. 독립 ZIP 93개로 받았고 해시가 모두 맞습니다(`docs/asset_import_report.md` 1절).
- **NPC01 정면 승인 원본** `01_캐릭터/originals/NPC01_visitor_male_2026_front_full_v01.png`입니다. 승인 기록 SHA-256 c6836c1c…와 일치합니다.

## 받지 못한 이유 (이 세션 기준)

- **복구 ZIP을 읽지 못함:** 역할 그림, CH06·CH08, BG 승인본은 Drive에 낱개 파일로 없습니다(2026-10-14 제목 검색). 복구 ZIP 8개(9.4~17.8MB) 안에 있는 것으로 보입니다. 그중 가장 작은 `01_캐릭터_복구완료_v02_part05.zip`(9.4MB)을 이 세션의 Drive 연결 도구로 한 번 받으려 했지만 "응답 메시지가 너무 큼"으로 연결이 닫혔습니다. 더 큰 ZIP은 시도하지 않았습니다. 이것은 이 환경의 도구 동작이며 Drive의 일반 제한이 아닙니다. 1.9MB 이하 독립 ZIP 93개는 모두 정상으로 받았습니다.
- **ZIP 목록에 내용이 없음:** `ZIP_압축해제_목록_20261013.json`에는 각 ZIP의 크기·해시·파일 수만 있고 안의 파일 이름은 없습니다. 그래서 요청 목록의 `candidateArchives`는 폴더 이름이 맞는 후보일 뿐입니다.
- **NPC01 game 사본이 잘려 있음:** Drive의 `01_캐릭터/game/NPC01_…_v01.png`(1CDivKEz…)는 327,769바이트입니다. SHA-256이 eaee7a07…로 기대값과 다르고 PNG로 해독되지 않습니다. 승인 원본만 받았습니다.
- **손상 ZIP:** `01_캐릭터_이전업로드_불완전_사용금지.zip`은 지시대로 받지도 쓰지도 않았습니다.

받는 방법(이전과 같음, 하나면 됨):

1. Drive를 동기화한 PC에서 `extract_404_archives.py`를 실행합니다.
2. 네트워크 허용 목록에 Drive 내려받기 호스트를 추가합니다.
3. GitHub 릴리스 자산으로 올립니다.
4. 필요한 파일만 1.9MB 이하 낱개 또는 독립 ZIP으로 올립니다. v05 프레임에 썼던 방식이 이 세션에서 동작했습니다.

## P1. 게임 화면에 빠져 있는 것 (13건)

| 무엇 | 기대 파일 | SHA-256 | 영향 |
|---|---|---|---|
| 역할 그림 NPC01 게임 출력본 | `01_캐릭터/game/NPC01_visitor_male_2026_front_full_v01.png` | 6679a805… | 원본은 받음. 출력본이 원본과 같은지 제작 측 확인 필요 |
| 역할 그림 NPC03 (승인본 v02) | `…/NPC03_courier_2026_front_full_v02_v01.png` | caacae5c… | v01은 대체됨 |
| 역할 그림 NPC04~NPC10 | `…/NPC04_technician_…` ~ `…/NPC10_friend_…` | 요청 JSON | 방문객 역할 그림은 10장이 다 있어야 한 번에 켬. 지금 2/10(NPC01 원본, NPC02) |
| CH06 장혜숙 | `…/CH06_jang_hyesook_2026_front_full_v01.png` | e1ec8915… | N2_04·N3_04·N5_06 기록 인물 화면이 글만 나옴 |
| CH08 서민아 | `…/CH08_seo_mina_2026_front_full_v01.png` | 360ea47d… | N2_06·N5_07 기록 인물 화면이 글만 나옴 |
| BG08 관리사무소 승인본 | `02_배경/game/BG08_management_office_2026_base_v02_v01.webp` | d0c3c33c… | 받은 v01은 미승인이라 게임 파일 없음 |
| BG13 2004년 외관 | `02_배경/game/BG13_2004_exterior_2004_v01.webp` | 1b7cb1ea… | 2004/2026 외관 대조(4층 창 줄) 불가 |

## P2 (1건)

| 무엇 | 기대 파일 | SHA-256 | 영향 |
|---|---|---|---|
| BG06 엘리베이터 내부 | `02_배경/game/BG06_interior_elevator_2026_interior_v01.webp` | 73db049c… | 지금 쓰는 곳 없음 |

## P3 (27건)

- **BG04·BG05 패키지 WebP 출력본:** 승인 원본 PNG로 게임 파일을 만들었으므로 게임에는 영향이 없습니다. 레지스트리 대조용입니다.
- **v05 부품 그림 25개(`assets/`):** 프레임 전송 ZIP에는 들어 있지 않습니다. 걷기 프레임을 다시 렌더할 때만 필요하고, 8절 제작 요청을 반영하려면 필요합니다.

## 배경 수 정정 (이전 "배경 13장(3장 미확보)" 표현을 나눠 셈)

| 구분 | 수 | 내용 |
|---|---|---|
| 승인 목록의 배경 항목 | 15 | BG01, BG02, BG03, BG04, BG05, BG06, BG06_interior, BG07, BG08(base_v02), BG09, BG10, BG11, BG12, BG13_2026, BG13_2004 |
| 받은 배경 파일 | 13 | WebP 11장 + 원본 PNG 2장(BG04·BG05) |
| 그중 승인본 | 12 | BG08 v01은 승인 목록 밖(미승인) |
| 게임 파일로 만든 것 | 12 ID | `dist/assets/bg`: BG01~BG07, BG09~BG12, BG13_2026 (BG08 없음) |
| 게임에서 실제로 쓰는 것 | 10 ID | BG01, BG02, BG04, BG05, BG07, BG09, BG10, BG11, BG12, BG13_2026 (`scene_layout.json` usage) |
| 데이터만 있고 안 쓰는 것 | 2 ID | BG03, BG06 |
| 승인됐지만 받지 못한 것 | 3 | BG06_interior, BG08 base_v02, BG13_2004 |

## 제작이 필요한 것 (파일이 와도 아직 게임에 쓸 수 없음)

| 과제 | 수량 | 근거 |
|---|---|---|
| v05 걷기 클립 그림·동작 수정 | 64건(P1 28) | `asset-source/v05_QA/frame_qa/production_requests_v05.json`, `docs/animation_qa.md` 8절 |
| NPC06 퇴장 경로 다시 렌더 | 1 | 후면 시작 z를 2.333m로. 원인 render.js 50행 |
| 대기(서 있는) 반복과 돌아서기 | 9명 | 지금은 입장 마지막 프레임(한 발 내디딘 자세)을 붙잡을 수밖에 없음 |
| NPC01 걷기 클립 | 1명 | v05 패키지에 없음 |
| 이야기 장면 인물(MC) 승인본 | 28장면 | 초안만 있음(MC07·MC27·MC30 수정본 미승인) |
| 증거 사진 원본 | EV04, EV05 | 카드 BLOCKED |
| 키 정보 | CH09, CH10, MC15, MC25 | 지금은 [DESIGN] 1.68m |
