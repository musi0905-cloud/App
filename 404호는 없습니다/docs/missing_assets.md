# 빠진 에셋과 남은 제작 과제 (v0.18.0, 2026-10-14)

요청 목록은 기계가 읽을 수 있게 `docs/missing_assets_request.json`에 둡니다. `scripts/build-missing-request.py`가 기록에서 만듭니다.

- **필드:** v0.17.0과 같습니다(assetId, entityId, era, expectedFilename, sourceDriveId, sourceUrl, expectedSha256, priority, blockingReason). 여기에 `kind`, `use`, `spec`이 더해졌습니다.
- **없는 정보:** null로 두었습니다.

## 1. v0.17.0 요청 41건: 41건 파일 확보

2026-10-14 복원 전달(41 source ZIP)로 41건 모두 기대 SHA-256과 같은 파일을 받았습니다(`resolved`, `heldAt`).

- **우선순위별:** P1 13, P2 1, P3 27.
- **해결의 뜻:** "파일 확보"입니다. 시각 검수 PASS가 아닙니다.
- **이번에 다시 본 것:**
  - 정지 인물 12장: BG02 무대의 발·키·그림자, 그리고 CH06·CH08 실제 게임 화면
  - 배경: BG08 좌표, BG13 2004/2026 대조
- 41건이 해결됐다고 계획된 에셋이 모두 끝난 것은 아닙니다. 아래 2절이 남은 일입니다.

## 2. 남은 요청 55건 (P1 9 · P2 26 · P3 20)

종류: 새로 그려야 함(`new_art`) 47, 기록으로 정할 값(`record`) 8. 받기만 하면 되는 파일(`file`)은 0입니다.

| 무엇 | 건수 | 우선 | 근거 · 막는 것 |
|---|---|---|---|
| 걷기: 무릎 상태 셋을 그린 바지 다리(정면·후면) | 9 (9명) | P1 | v06 검수 LEG_STRIP. 이게 와야 정면·후면 PASS가 가능 |
| 걷기: ±8도 돌린 몸통 두 장(정면·후면) | 9 | P2 | v06 검수 TORSO_STATIC |
| 걷기: NPC10 측면 맨팔(볼륨, 길이) | 1 | P2 | v06 검수 ARM_LONG |
| 걷기: 45도 부품 세트 | 9 | P3 | 회전 그림 바꿈을 매끄럽게(막지 않음) |
| CCTV 걷기·몸짓 그림 NPC01~NPC10 | 10 | P2 | v0.19.0부터 역할 그림은 사건별로 켬(19/100). 남은 81개 사건을 역할 그림으로 바꾸려면 필요(사건별 `needed_by_cases`) |
| NPC01 걷기 클립 | 1 | P2 | v05 패키지에 NPC01이 없음 |
| 증거 EV04·EV05 사진 원본 | 2 | P2 | 카드 BLOCKED(revision_backlog_v02) |
| 증거 EV01·EV18·EV19 결합·음성 | 3 | P2 | REVISE(도면 대조, 일기 그림 결합, 음성 미제작) |
| 이야기 장면 인물 MC07·MC27·MC30 수정 | 3 | P3 | REVISE(얼굴 구별) |
| 키 기록 CH06·CH08·CH09·CH10·MC15·MC25·NPC01 | 7 | P3 | 기록이 없어 [DESIGN] 1.68m. NPC02~NPC10은 v05 렌더 설정의 키를 씀 |
| BG13 외관의 4층 창 줄 | 1 | P3 | 보이는 1층이 몇 층인지 기록 없음(2004·2026 윤곽은 같은 자리) |

이 세션에는 이미지 생성 수단이 없습니다. 그래서 그림을 만들지 않았고, 만들었다고 적지 않았습니다. 그림마다 사양(인물, 방향, 부품, 프레임, 참고 그림, 그려야 할 것)은 `spec`과 `asset-source/v06_QA/production_requests_v06.json`에 있습니다.

**NPC06 v07 (2026-10-14 추가 전달)**

- 받은 것: 제작 측이 보낸 NPC06 다리·몸통 v07b 시트 3장(+ v07a 초안 3장)
- 형식: 해시·해독 6/6 일치
- 시험: v06 리그에 붙여 실제 프레임으로 검수. 정면·후면·연결 모두 REVISE, 측면은 변화 없이 PASS
- 요청: NPC06의 LEG_STRIP·TORSO_STATIC 4건은 **OPEN 그대로**입니다. 표의 건수도 그대로입니다. 받은 것만으로는 해결 처리하지 않았습니다.
- 표시: 요청 목록의 해당 두 줄에 `latest_attempt`를 달았습니다.
- 원화 수정 요청: `asset-source/v07_QA/NPC06_v07_원화수정요청.md`(R1 정면 다리, R2 후면 다리, R3 몸통)

**NPC06 v09 / v09r (2026-10-15)**

- 받은 것: 새 그림 없는 v09 보정 코드와 그 렌더 프레임(해시 일치). 이 저장소에서 v09r로 다시 고침
- 판정: 다리·몸통 정면·후면 모두 REVISE, 측면·연결·배경 합성 PASS
- 요청: LEG_STRIP·TORSO_STATIC 4건은 **OPEN 그대로**. 두 줄의 `latest_attempt`를 v09/v09r로 바꾸고 v07 시도는 `previous_attempts`로 옮김
- 새 요청 2줄: `NPC06/walk/SLEEVE_FABRIC`(P2, 소매가 가디건과 다른 밝은 굵은 니트·위팔 일정 폭), `NPC06/walk/TURN_REAR_STRAP`(P3, 3/4 후면 그림 — TURN_45의 일부)
- 원화 수정 요청(원본 크롭·관절 좌표·문제 프레임 포함): `asset-source/v09_QA/NPC06_v09_원화수정요청.md`

**NPC06 v10r5 (2026-10-17, v0.19.0 게임 적용)**

- 받은 것: 결과 폴더의 22개 파일(manifest 일치), 프레임 263장(verification 일치). `asset-source/v10r5_NPC06/IMPORT_v10r5.json`
- 게임: 인터폰 4개 사건에서 전체 방문을 재생합니다. **시각 REVISE / 사용자 예외 승인**입니다.
- 요청: LEG_STRIP·TORSO_STATIC·SLEEVE_FABRIC·TURN_REAR_STRAP 4건은 **해결이 아닙니다.**
  - 각 줄에 `release_v0_19_0.status = "이번 릴리스에서 사용자 수용, 후속 개선"`(`resolved: false`)를 붙였습니다.
  - 표의 건수는 그대로입니다.

## 3. 배경 수 (v0.18.0)

| 구분 | 수 | 내용 |
|---|---|---|
| 승인 목록의 배경 항목 | 15 | BG01~BG05, BG06, BG06_interior, BG07, BG08(base_v02), BG09~BG12, BG13_2026, BG13_2004 |
| 받은 배경 파일 | 18 | WebP 16장 + 원본 PNG 2장(BG04·BG05) |
| 그중 승인본 | 17 | BG08 v01은 승인 목록 밖. BG04·BG05는 PNG 원본과 WebP 출력본이 모두 있음 |
| 게임 파일로 만든 것 | 15 ID | `dist/assets/bg`: BG01~BG07, BG06_interior, BG08, BG09~BG12, BG13_2026, BG13_2004 |
| 게임에서 실제로 쓰는 것 | 11 ID | BG01, BG02, BG04, BG05, BG07, BG08(관리실에서 찾은 문서 EV03·EV15), BG09, BG10, BG11, BG12, BG13_2026 |
| 데이터만 있고 안 쓰는 것 | 4 ID | BG03, BG06, BG06_interior, BG13_2004(쓸 장면이 기획에 지정되지 않음) |
| 승인됐지만 받지 못한 것 | 0 | — |
