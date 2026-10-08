# 0.13.0 — 스토리 v1.1 데이터 반입과 1차 연결

2026-10-08

Drive의 새 시작 문서 `19_CLAUDE_CODE_IMPORT_v1_1.md`와 기획 패키지(v1.1, 83개 파일)를 읽고, 실제 게임 데이터와 대조한 뒤 연결했다. 점검 결과와 안 한 것은 `docs/STORY_IMPORT_REPORT.md`에 있다.

- `story-plan/v1.1/`에 패키지 원본 보관(SHA-256 82개 일치). `dist/data/`에 `story_visitors.json`, `story_scenes.json`, `story_endings.json` 추가.
- `engine.js`: `newRun(..., pairs)`로 오늘의 근무가 허용 조합(방문객 ↔ 고정 이상징후)만 쓴다. 허용 4·거부 4, 날짜 시드 재현. `ENDING_IDS`로 엔진 결말 6개 ↔ E01~E06. `VERSION` 0.2.0 그대로(저장 호환).
- `game.js`: 첫 근무 8건의 첫마디를 `story_scenes` N1 대사로, 판정 후 방문객 반응 한 줄, 결과 화면에 엔딩 컷신(자막 4컷·배경·대사 3줄, 탭/자동 진행), 결말 제목을 v1.1 제목으로.
- 원본 `visitors/anomalies/scenarios/endings.json`은 바꾸지 않았다. v1.1의 템플릿 대사(정답이 새는 50:50 문장)는 판정 전에 쓰지 않는다.
- 검사: 엔진·데이터 20/20(story 검사 4개 추가), 브라우저 10/10(컷신 검사 추가), 전수 100/100. 캐시 `room404-v0.13.0`.
- 미구현: 2~5야간, 증거보드/PZ/EV, E07~E30 조건식, 긴급 신고 버튼, 실물 아트. 기획 문서가 요구한 대로 완료로 보고하지 않는다.
