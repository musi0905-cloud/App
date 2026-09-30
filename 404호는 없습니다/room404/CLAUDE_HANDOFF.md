# 404호는 없습니다 — Claude Code 인수인계

기준: 2026-09-30 UTC. 이 문서와 함께 제공한 ZIP의 파일이 현재 작업본이다.

## 1. 먼저 읽을 결론

- 운영 사이트는 v0.5.0이다. ZIP의 UI/캐시는 v0.6.0이며 아직 커밋·푸시·배포하지 않았다. README의 버전만 보고 운영 반영으로 판단하면 안 된다.
- 현재 작업본은 v0.5 커밋 `7a610ce407cae5f8d0f4217d05910819f40948bd` 위의 변경 사항과 새 파일 전체를 포함한다. Git 저장소 자체와 node_modules는 ZIP에서 제외했다.
- v0.6의 목표는 어려운 설명을 쉬운 한국어로 바꾸는 것이다. 100개 사건의 표시용 설명과 UI 수정은 끝났고, 최종 사용자 이해도 확인과 배포가 남았다.
- 현재는 생성 이미지로 구성한 웹/PWA 프로토타입이다. App Store 네이티브 앱, 구매 연동, 실기기 검증까지 완성됐다고 말하지 말 것.
- 사용자는 크레딧 사용량 80%에 도달하면 멈추고 완료/미완료 작업을 Drive에 남기라고 요청했다. 이 환경에는 Codex 크레딧 사용률 조회 기능이 없어 임계값을 감지하지 못했다. 80% 도달을 확인했다는 뜻이 아니라, 손실 방지를 위한 선제 인수인계다. 다음 담당자는 사용 가능한 실제 사용량 지표가 있을 때만 이를 기준으로 중단할 것.

## 2. 사용자 의도와 유지할 조건

게임 이름은 ‘404호는 없습니다’. 아파트 야간 경비원이 방문객의 출입 여부를 판단하는 한국어 공포 게임이다.

- 최종 목표: 앱으로 실행하고 테스트를 마친 게임. 원래 상품 방향은 한 번 구매하면 계속 사용, 광고 없음, 추가 결제 없음.
- CCTV, 주민·방문 기록, 전화, 추가 확인 버튼을 누르면 실제 조사 화면으로 전환되어야 한다.
- 사람 형태가 보여야 한다. 방문객 이미지가 있다.
- 사건을 시간 순서로 이해할 수 있어야 한다. 사건 당시 모습과 상황별 자료를 보여주고, 내용은 자세하되 쉬워야 한다.
- 추상적인 용어를 일상적인 말로 바꾸고, 확인한 사실과 다음 행동을 분리한다.
- 사용자 요청: 코드와 작업 기록을 모두 Google Drive에 저장. 코드뿐 아니라 남은 일과 검증 한계도 기록한다.
- 현재 사이트의 소유자 전용 접근 범위를 유지한다. 공개 전환, 외부 초대, 호스팅 이전을 임의로 하지 않는다.
- 실제 기록은 가상 설정이다. 결말/정답을 조사 전에 드러내지 않는다.

## 3. 위치와 버전

- 운영 URL: https://room404-nightwatch.musi0905.chatgpt.site
- Sites project_id: `appgprj_6abb2ee827248191b32ab5ba1c1b588b`
- `.openai/hosting.json`의 static directory: `dist`
- 마지막 확인한 성공 배포: `appgdep_6abc12fb045c81919b156cd7ed191fb7`
- 해당 Sites version_id: `appgprj_6abb2ee827248191b32ab5ba1c1b588b~appgver_eec5ebb30e2081918ce1a374d4f58b25`
- Sites 저장 버전 번호와 게임의 0.5/0.6 번호는 서로 다르다. Sites latest_version_number는 이번 읽기에서 4였다.
- 기존 작업 폴더: `/workspace/scratch/1efaf0c09a42/room404-update` (임시 경로이므로 다음 환경에서 존재한다고 가정하지 않는다.)
- Drive 프로젝트 폴더: https://drive.google.com/drive/folders/1lsBgozxM3Ac3rGedzehYRwTkBtvo5Obl
- 이전 v0.5 백업: https://drive.google.com/file/d/1v_92zw9SeChWdHmwNrbOqZp3wEL5v3Du/view
- 이전 `404-game` 폴더의 Capacitor 초안은 최신 소스가 아니다. 네이티브 작업 시 현재 dist와 동기화하고 별도로 검증해야 한다. 이 ZIP에는 그 오래된 별도 폴더를 넣지 않았다.

## 4. 구현 구조

| 파일 | 역할 |
|---|---|
| dist/index.html, style.css | 화면 구성과 스타일 |
| dist/game.js | 조사 화면, 안내문, 진행/저장/결과 UI |
| dist/engine.js | 사건 선택, 점수, 판정, 결말, 저장 유효성 |
| dist/replay.js | 18초 CCTV 재현: 6초씩 3구간, 재생/정지/구간 이동 |
| dist/data/anomalies.json | 원래 100개 사건과 정답의 기준 |
| dist/data/scenarios.json | 100개 사건의 장면·서류·통화·확인 결과·쉬운 설명 |
| dist/data/visitors.json, endings.json | 방문객과 결말 |
| dist/assets/ | 사람/소품/복도/엘리베이터/주차장 등의 이미지 |
| dist/sw.js, manifest.webmanifest | 오프라인 캐시, PWA 설정 |
| SCENARIO_COVERAGE.json | 사건별 자료/장면 대응표 |
| tests/ | 엔진, 데이터, 브라우저 회귀, 전수 UI 검사 |
| REFERENCE_REVIEW-0.6.0.md | 조사한 출처와 적용 판단, 변경 예 |
| test-artifacts/ | 검사 결과 JSON과 대표 화면 |

한 근무는 8명. 상태는 home/game/investigation/feedback/result이다. investigation 중 저장된 run.screen은 game을 사용한다. 도구를 열기만 해서는 확인 처리하지 않고 실제 조회 동작 때 처리한다. 재확인 전에는 최종 결과를 숨긴다.

엔진 버전은 저장 호환성을 위해 0.2.0을 유지한다. UI/서비스워커 버전 0.6.0과 다르며 오류가 아니다. 저장 키는 `404_active_v2`, `404_last_run`이다. 내부 도구 키 `CCTV`, `명부`, `통화`, `재확인`은 유지했다. 표시 이름만 바꾸었다.

## 5. 완료한 내용

v0.5까지 사람 이미지, 조사 화면 전환, 사건별 3구간 재현, 자료 비교, 전화 기록, 마지막 확인, 저장/재개, 결과 PNG, 로컬 오프라인 동작을 구현하고 배포했다.

v0.6 작업본:

- 100개 사건에 `plain.what`, `plain.check`, `plain.confirmed`, `plain.decision` 작성.
- 원래 clue/verification 및 정답 safe를 보존했다. 표시용 verificationDetail은 쉬운 confirmed 문장으로 연결한다.
- ‘지금 알게 된 것’과 ‘다음에는 이것을 확인하세요’를 안내한다.
- 버튼: ‘CCTV 보기’, ‘주민·방문 기록’, ‘집에 전화하기’, ‘한 번 더 확인’, ‘들여보내기’, ‘문 열지 않기’.
- 처음 하는 사람을 위한 4단계 안내 추가.
- 문구 변경에 맞춰 회귀 테스트를 수정했다. 사건 판정과 장면 동작은 변경하지 않았다.
- Papers, Please 공식 소개, Game Accessibility Guidelines, GOV.UK 쉬운 언어 가이드를 참고했다. 자세한 URL/적용 내용은 REFERENCE_REVIEW 문서에 있다. 원작 게임 전체를 직접 플레이해 분석했거나 한국어 사용자 연구를 했다는 뜻은 아니다.

`scripts/plain-language-v6.py`, `scripts/ui-copy-v6.py`는 이미 적용한 일회성 변환 기록이다. **재실행하지 말 것.** 반복 치환으로 문구가 손상될 수 있다. 현재 dist 파일을 직접 검토·수정한다.

## 6. 실행과 테스트

Node.js 20 이상, Python 3. 이번 실행 환경은 Linux / Node 24 / Chromium 133이다.

```bash
npm ci
python3 -m http.server 8000 --directory dist
```

브라우저에서 http://localhost:8000 을 연다. 위 서버는 별도 터미널에서 실행하고 다음 검사는 프로젝트 루트에서 한다.

```bash
npm test
npm run test:ui
npm run test:all-cases
```

검사 결과의 정확한 시각과 성공 여부는 `HANDOFF_TEST_STATUS.json` 및 `test-artifacts/*results.json`을 기준으로 한다. 전수 UI 검사는 화면의 요소·장면 상태·정답 흐름을 검사하며, 모든 애니메이션 프레임을 사람이 눈으로 확인했다는 뜻은 아니다.

이번 재시작 시 test:all-cases를 먼저 실행하여 `/tmp/room404-chromium` 부재로 실행 실패했다. 앱 오류가 아니라 테스트 브라우저 준비 순서 문제다. test:ui가 Linux Chromium 파일을 준비하므로 반드시 먼저 실행한다. 재실행 결과를 함께 기록한다.

다른 OS 주의: tests/all-cases.mjs는 Linux 실행 경로가 하드코딩되어 있다. macOS/Windows Claude Code에서는 Playwright 브라우저를 설치하고 실행 경로를 맞춘 뒤 검사해야 한다. browser.mjs에는 CHROMIUM_EXECUTABLE 환경변수 지원이 있지만 all-cases에는 없다. Linux 스크린샷에 한글이 네모로 나오면 한국어 글꼴을 설치한다. iPhone에서는 시스템 글꼴을 사용한다.

## 7. 미완료 및 검증 한계

1. v0.6 커밋·푸시·운영 배포와 배포 상태 확인은 미완료.
2. 실제 사용자가 읽고 사건 순서를 이해하는지 확인하지 않았다. 데이터/자동 검사 통과가 이해도 검증을 대신하지 않는다.
3. CCTV는 생성 이미지와 canvas 움직임으로 만든 재현이다. 실제 촬영 영상이나 사건별 MP4가 아니다. 전화는 텍스트 기록이며 음성 재생은 없다. 필요한 경우 사용자 의도를 확인하여 후속 미디어 작업으로 진행한다.
4. 실제 iPhone Safari/PWA 설치·백그라운드 복귀·운영 인증 상태의 오프라인 검증을 하지 않았다. 현재 오프라인 성공은 로컬 Chromium 범위다.
5. 네이티브 패키징, 서명, App Store 제출, 구매 정책 구현은 미완료. 관련 계정/권한과 제품 결정을 확보해야 한다.
6. 로그인 화면은 소유자 전용 Sites 접근과 관련된다. 앱명 ‘404호는 없습니다’를 HTTP 404 오류라고 단정하지 않는다. 이미지 임시 경로가 사라졌다는 오류와 사이트 로그인 문제도 구분한다.

## 8. 다음 담당자의 작업 순서

1. ZIP을 풀고 SHA256SUMS.txt로 무결성을 확인한다. CLAUDE.md → 이 문서 → README → REFERENCE_REVIEW → CHANGELOG 순서로 읽는다.
2. 위 명령으로 실행하고 검사한다. 현재 작업본을 과거 v0.5 파일로 덮어쓰지 않는다. diff patch는 참고용이며 ZIP에 다시 적용하지 않는다.
3. CCTV/주민·방문 기록/전화/마지막 확인 화면의 문장과 모바일 줄바꿈을 직접 확인한다. 특히 ‘무슨 일이 있었는지 → 언제 있었는지 → 무엇을 더 확인할지’가 연결되는지 본다. 어색한 문장만 고치고 정답/원래 사건 의미를 바꾸지 않는다.
4. v0.6을 리뷰한 뒤 기존 Sites 프로젝트에 배포한다. 접근 범위를 유지하고, 배포 성공 응답을 확인한 뒤 운영 반영을 보고한다.
5. 배포 후 실제 iPhone에서 읽기/버튼/저장/재개/PWA를 확인한다. 가능하지 않은 검사는 미검증으로 기록한다.
6. 결과/스크린샷/변경 사유/남은 일을 Drive에 다시 저장한다. 이후 네이티브 앱과 미디어 범위 작업을 진행한다.

## 9. Sites 배포 권한과 보안

현재 프로젝트는 Sites 저장소/호스팅을 사용한다. Claude Code에 동일한 Sites 도구와 권한이 있다고 가정하지 않는다. 권한이 없으면 코드 수정/테스트까지 수행하고 배포용 소스와 기록을 전달한다. 임의로 다른 호스팅에 공개 배포하지 않는다.

배포 담당자는 설치된 Sites 스킬의 현재 절차를 따른다: 기존 project_id 확인 → 새 단기 저장소 credential 발급 → 기존 소스 상태 확인 → 정확한 변경을 커밋/푸시 → 그 상태에서 배포 아카이브 생성 → 버전 저장 및 private 배포 → 상태가 succeeded인지 확인. 운영 전용 토큰이나 credential을 문서/ZIP/로그에 기록하지 않는다. 과거 토큰은 만료되었으므로 재사용하지 않는다.

이 ZIP은 작업 트리 전체의 스냅샷이며 Git 원격에 저장 완료됐다는 증거가 아니다. 마지막 Git 커밋과 미커밋 수정 상태를 HANDOFF_STATE.json에 기록했다. SHA256SUMS.txt는 ZIP 내부 파일들의 체크섬이며 자기 자신은 제외한다.

## 10. 이번 재시작의 최종 검사 결과

엔진/데이터 11개, Chromium 회귀 9그룹, 100개 사건·300개 장면 전수 UI 검사를 모두 통과했다. 실행 시각은 HANDOFF_TEST_STATUS.json 참조. 초기 브라우저 실행 파일 부재 오류는 test:ui 실행 후 해소됐다.

대표 CCTV 스크린샷을 열어 확인했으나 현재 Linux 환경의 한국어 글꼴 부재로 한글이 네모로 보였다. 따라서 이번 스크린샷으로 한국어 가독성/줄바꿈을 검증 완료했다고 말할 수 없다. 다음 담당자는 글꼴을 준비한 후 UI 검사를 재실행하여 화면을 확인할 것. DOM 문구/흐름 검사는 통과했다. 이 문제와 iPhone 실제 렌더링은 별개이며 실기기는 미검증이다.
