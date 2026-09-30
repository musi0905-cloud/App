# 404호는 없습니다 — 0.6.0

웹 게임의 v0.6.0 배포 전 작업본입니다. 운영 버전은 v0.5.0이며, 현재 상태와 다음 작업은 CLAUDE_HANDOFF.md를 먼저 확인하세요. 광고·추가 결제 없는 개발용 프로토타입입니다.

## 실행

`python3 -m http.server 8000 --directory dist`

브라우저에서 http://localhost:8000 을 엽니다. 파일을 직접 더블클릭하면 모듈과 JSON 로딩이 제한될 수 있습니다.

## 테스트

Node.js 20 이상에서 `npm ci` 후:

- `npm test`: 엔진과 100건 사건 정의 검증
- `npm run test:ui`: 전체 근무/저장/오프라인 회귀 검사
- `npm run test:all-cases`: 100건·300구간 전수 UI 검사 (`test:ui`로 Linux Chromium 실행 파일을 준비한 뒤 실행)

Linux 테스트는 @sparticuz/chromium 133 실행 파일을 사용합니다. 다른 환경에서는 Playwright 브라우저를 설치하고 테스트 실행 경로를 해당 환경에 맞게 지정해야 합니다. iPhone 실기기 검증을 대체하지 않습니다.

## 자료

- dist/data/scenarios.json: 사건별 장면, 명부, 통화와 대조 기록
- dist/replay.js: 생성 이미지 기반의 18초 재현 애니메이션
- SCENARIO_COVERAGE.json: 사건·자료 대응표
- CHANGELOG-0.6.0.md: 변경 사항과 검증 범위
- test-artifacts/: 실행 결과와 대표 화면 (백업 ZIP에 포함, Git 제외)

현재 재현은 실사 영상 파일이 아니며 음성 오디오는 제공하지 않습니다. 캐릭터 이미지·소품·배경에 이동/반사/시간 변화 등을 적용합니다. 개인정보는 전부 가상 설정이며 게임 진행은 이 기기의 브라우저에 저장됩니다.

문장 개선 근거는 REFERENCE_REVIEW-0.6.0.md를 참고하세요.
