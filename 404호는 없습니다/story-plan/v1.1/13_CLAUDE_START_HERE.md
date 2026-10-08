# CLAUDE CODE / 단독 개발 시작 가이드 (COPY)
당신은 《404호는 없습니다》 기존 저장소의 구현 담당자다. **사용자에게 추가 기획 질문을 하지 말고** 본 패키지의 확정된 사항을 따르되 구현 불가능하거나 자료 부족은 BLOCKER로 기록한다. 파일을 추측하지 말고 소스 점검 후 코드 변경을 시작한다.

## 권위 순서
1. 01_WORLD_BIBLE.md, 02_TIMELINE_AND_COVERUP.md, 03_CHARACTERS.md (사건 진실)
2. 05_EVIDENCE_AND_PUZZLES.md, 09_SCENE_SCRIPT_40.md + story_scenes_40.json (장면/증거)
3. 10_ENDING_MATRIX.md + ending_specs_30.json (엔딩 슬롯; 미완 부분 확인)
4. 11_GAMEPLAY_UI_SPEC.md, 06_ASSET_SHOTLIST.md, 12_ASSET_PROMPT_LIBRARY.md
5. 07_CLAUDE_CODE_IMPLEMENTATION.md, 08_CASE_MAPPING_AND_QA.md, 기존 소스와 tests.

## 가장 먼저 수행할 실제 커맨드
`git status --short && git log -1 --oneline`, `find dist/data -maxdepth 2 -type f`, `cat package.json`; diff 점검, 백업/브랜치 생성. 기존 v0.6이 미배포일 수 있으니 버전 확인.

## 코드 작업 독립 수행 순서
A. 데이터 스키마 + 빌드/테스트 안전장치. B. 첫 야간 기존 V/A IDs 대응 유지 + 사건 시나리오 연결. C. 나머지 4야간 스토리/증거 퍼즐 연동. D. 엔딩과 저장 마이그레이션. E. 더미 플레이스홀더 에셋과 매니페스트. F. 실제 에셋 검수 후 교체. G. 자동 테스트·수동 시나리오·실기기 확인.

## 기준
- 40개 행은 심사 상황의 **작가용 장면 골격**이다. N2~5에 실재하는 방문객 등록 검증 데이터가 작성되지 않은 채 허용/거부를 엔진에 넣지 마라. 출입 결정과 메인 증거 확보는 분리.
- 30 엔딩 중 E07~E29는 상세 컷신 미완이므로 사용자에게 완료로 보고하지 말고 근거 있는 방식으로 구현 범위를 관리하라.
- GitHub 배포/외부 공개/호스팅 변경/실제 계정 인증을 임의 수행하지 않는다.
- 소스 변경 후 각 파일·테스트·실패/남은 위험을 인수인계 보고서로 기록한다.
- 원본 텍스트 `스크립트/이미지/영상/음향` 중 제작되지 않은 자산은 TODO 표기. 있는 척 하지 않는다.
