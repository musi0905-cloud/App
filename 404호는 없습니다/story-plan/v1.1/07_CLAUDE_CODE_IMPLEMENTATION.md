# Claude Code 적용 명세 — 스토리 v0.5
목표: 기존 웹/PWA 구조 및 저장 호환성을 유지하면서 우선 1야간을 새 설정에 맞게 교체, 이후 5야간의 메인 시나리오 구현. 이 문서는 **Claude Code에 전달하는 지시서**이며 실제 소스 업데이트 완료 보고가 아니다.

## 먼저 해야 할 점검
1. 현재 프로젝트 버전·Git HEAD·작업 트리 diff·배포 버전을 확인. 2026-09-30 인수인계는 v0.6 미배포 상태이므로 운영 사이트가 같은 버전이라고 가정 금지.
2. `dist/data/{visitors,anomalies,scenarios,endings}.json`, `dist/{game,engine,replay}.js`, `tests/`를 실제로 열어 스키마 검증.
3. 변경 전 스냅샷/백업 생성. 원본 IDs 보존; 잠재 데이터 마이그레이션 계획 문서화.
4. 기존 원본 `GDD.md`는 백업 후 새 기획에 반하는 항목을 주석/변경 이력으로 교체. 독립 파일 이력 유지.

## 권장 신규 데이터(실제 저장소 관례에 맞춰 조정)
- `dist/data/lore.json`: roomTruth, coverupChronology, narrativeRules.
- `dist/data/characters_story.json`: `id`, `name`, `era`, `knownFacts[]`, `motives[]`, `trustState`, `assetRefs[]`.
- `dist/data/evidence.json`: EV01~EV20, source, era, acquisition, integrity, claimsSupported, claimsNotSupported, corroboration.
- `dist/data/story_scenes.json`: SC IDs와 조건, 대사, 시야 정보, 증거, 후속 플래그.
- `dist/data/story_nights.json`: N1~N5, 일반사건과 고정 메인사건 슬롯; 슬롯 숫자 총 8개.
- `dist/data/ending_conditions.json`: 실제 플레이 조건, 우선순위, 잠금, 증거·윤리 선택 반영.
- `dist/data/assets_manifest.json`: BG/SH/CH/PR/AU 참조를 한곳에서 관리. 빠진 파일일 경우 대체 화면/텍스트.

## 엔진 상태 예시
`story={night:1,caseIndex:0,seenScenes:[],evidenceFound:[],evidenceVerified:[],claims:{},relations:{},choices:{},endingFlags:{},schemaVersion:3}`. 기존 `404_active_v2` 저장 상태는 안전한 로딩 마이그레이션을 제공하거나 구버전으로 분리; 절대 조용히 상태 유실하지 않는다.

## 구현 단계
- **Sprint S0**: 파일 비교 / 세계관 모순 리포트 / 스토리 데이터 검증 JSON Schema / 미디어 매니페스트 생성.
- **Sprint S1**: 기존 N1의 8건을 스토리 장면으로 확장. 출입 판정 기존 기준 존중. V058의 404 기록은 스토리 플래그만 추가. 모든 조사 버튼에서 화면·증거 출처 표시.
- **Sprint S2**: N2~N5 핵심 32 슬롯과 퍼즐 PZ01~PZ05; 보조 일반사건은 기존 카드에서 제약 검증 후 재사용.
- **Sprint S3**: 엔딩 장면과 증거보드, 음향·모션 에셋 연결. 30개 조건 구현 범위가 불명확하면 E01~E06부터 명확한 상태로 인수하고 미구현 E07~E30은 비노출.
- **Sprint S4**: 100개 사건 스키마·대사·선후관계 정합성 전수 검사, 5일 야간 전체 플레이, 모바일/오프라인/자동저장.

## UI 필수 사항
- '문 열기/문 열지 않기'는 출입판정; '신고/관리소 긴급 연락'은 별도 행동.
- 사실/추정/검증완료 탭을 분리. 증거 이미지 확대 시 대체 텍스트와 실제 자료 내용.
- 최초 읽는 자료에서 `CH04 murder=true` 등 숨겨진 진실을 노출하지 않음.
- 인물·단지 표기는 전부 픽션. 모든 필수 추리는 색각·음향 없이 수행 가능.
- 1야간 시작 UI는 튜토리얼의 자연스러운 일부, 정답률보다 학습 가능성이 핵심.

## 금지 작업
- 기존 `scripts/plain-language-v6.py`, `scripts/ui-copy-v6.py` 재실행 금지(과거 인수인계에 중복 치환 위험 명시).
- 실물 이미지·영상이 없는 상태에서 자동 생성됐다고 보고 금지.
- 서비스 공개 상태 변경·호스팅 이전·토큰 출력 금지.
- 사건 데이터 의미 변경 없이 '무작위 방문객×무작위 이상징후'를 무제한 결합 금지.

## 테스트 명령 및 합격 조건
환경: Node.js 20+, Python3. `npm ci`, `npm test`, `npm run test:ui`, `npm run test:all-cases` 순서(환경별 Playwright 브라우저 경로 조정). 기존 Linux Chromium 고정 경로는 플랫폼 이식 가능하게 수정 후 검증.
신규 테스트:
1. `1997 도면에 404 존재`와 `2004 이후 은폐` 연대기 충돌 없는지 자동 확인.
2. N1 8건 원래 판정 중복/정상예외 확인 및 스토리 플래그 분리.
3. EV 증거 참조 무결성, PZ 필수 증거 최소 2개 독립 출처.
4. 모든 장면 대사 시간축 / 사망 캐릭터 2026 실존 등장 금지.
5. 중요 단서 미수집 시 진행 보완 루트 및 오류 복구.
6. 저장→재개, 오프라인, 모바일 뷰포트, 한국어 줄바꿈, 실기기 별도 미검증 표시.
7. 야간 5회 전체 완주, 모든 선택의 스토리 플래그 저장 일관성.
결과는 PASS/FAIL/SKIP + 시각 + 환경 + 로그 경로로 기록. 미실행 검사를 합격 처리하지 않는다.

## Claude Code 실행 요청(복사 가능)
'스토리 v0.5 MD 8종을 순서대로 읽고, 기존 저장소를 검사한 뒤 충돌 목록·데이터 변경 계획·원본 백업을 먼저 작성하라. 코드 작업은 S0→S1부터 진행하고 각 단계 전후 테스트를 기록하라. 최초 구현은 첫 야간 8건과 증거·서사 상태 저장에 한정하라. 재배포 및 외부 공개는 지시 없이는 수행하지 말고, 제작되지 않은 이미지·영상은 매니페스트상 TODO로 남겨라.'
