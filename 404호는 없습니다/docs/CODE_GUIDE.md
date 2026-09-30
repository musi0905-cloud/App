# 코드 가이드

코드 구조를 섹션별로 정리합니다. 코드를 바꾸면 해당 섹션도 함께 고칩니다.

> 현재는 v0.6 인수인계서를 바탕으로 한 **뼈대**입니다. v0.6 코드를 이 폴더에 올린 뒤, 실제 코드를 읽고 각 섹션을 채웁니다.
> `(코드 확인 전)` 표시가 있는 섹션은 아직 코드로 검증하지 않은 내용입니다.

---

## 1. 전체 구조 (코드 확인 전)

| 파일 | 역할 |
|---|---|
| `dist/index.html`, `style.css` | 화면 구성과 스타일 |
| `dist/game.js` | 조사 화면, 안내문, 진행·저장·결과 UI |
| `dist/engine.js` | 사건 선택, 점수, 판정, 결말, 저장 유효성 |
| `dist/replay.js` | 18초 CCTV 재현 (6초씩 3구간) |
| `dist/data/anomalies.json` | 100개 사건과 정답 기준 |
| `dist/data/scenarios.json` | 사건별 장면·서류·통화·확인 결과·쉬운 설명 |
| `dist/data/visitors.json`, `endings.json` | 방문객, 결말 |
| `dist/assets/` | 사람·소품·배경 이미지 |
| `dist/sw.js`, `manifest.webmanifest` | 오프라인 캐시, PWA 설정 |
| `tests/` | 엔진·데이터·브라우저 회귀·전수 UI 검사 |

## 2. 게임 흐름 (코드 확인 전)

- 한 근무에 방문객은 8명입니다.
- 화면 상태는 `home` → `game` → `investigation` → `feedback` → `result` 순서입니다.
- `investigation` 도중에 저장하면 `run.screen`은 `game`으로 기록됩니다.
- 도구를 열기만 해서는 확인 처리되지 않습니다. 실제 조회 동작을 해야 확인으로 기록됩니다.
- 재확인 전에는 최종 결과를 숨깁니다.

## 3. 판정 엔진 (engine.js) (코드 확인 전)

- 저장 호환성 때문에 엔진 버전은 `0.2.0`을 유지합니다. UI 버전 0.6.0과 다른 것은 의도된 것입니다.

## 4. 조사 도구 (코드 확인 전)

| 내부 키 (유지) | 화면 이름 (v0.6) |
|---|---|
| `CCTV` | CCTV 보기 |
| `명부` | 주민·방문 기록 |
| `통화` | 집에 전화하기 |
| `재확인` | 한 번 더 확인 |

판정 버튼은 `들여보내기`와 `문 열지 않기` 두 개입니다.

## 5. CCTV 재현 (replay.js) (코드 확인 전)

- 18초를 6초씩 3구간으로 나눕니다. 재생, 정지, 구간 이동을 지원합니다.
- 생성 이미지를 canvas로 움직여 만든 재현이며, 실제 영상 파일은 아닙니다.

## 6. 데이터 형식 (코드 확인 전)

- `scenarios.json`의 각 사건에는 쉬운 설명 필드 `plain.what`, `plain.check`, `plain.confirmed`, `plain.decision`이 있습니다.
- 원래의 clue/verification 필드와 정답 `safe`는 그대로 보존합니다.

## 7. 저장 (코드 확인 전)

- `localStorage` 키는 `404_active_v2`(진행 중인 근무)와 `404_last_run`(마지막 결과)입니다.

## 8. 오프라인·PWA (코드 확인 전)

- UI와 서비스워커 버전은 0.6.0입니다.

## 9. 테스트

```bash
npm ci
npm test                 # 엔진·데이터
npm run test:ui          # 브라우저 회귀 (all-cases보다 먼저 실행)
npm run test:all-cases   # 100개 사건 · 300개 장면 전수 UI 검사
```

- `tests/all-cases.mjs`에는 Linux Chromium 경로가 하드코딩되어 있습니다. 다른 OS에서는 `CHROMIUM_EXECUTABLE`을 지원하도록 고칠 예정입니다.

## 10. 주의사항

- `scripts/plain-language-v6.py`와 `scripts/ui-copy-v6.py`는 **다시 실행하지 않습니다.** 반복 치환으로 문구가 손상될 수 있습니다.
- 결말과 정답을 조사 전에 드러내지 않습니다.

## 11. 개선 후보

코드를 확인한 뒤 우선순위와 함께 채웁니다. 현재 알려진 항목은 다음과 같습니다.

- [ ] `all-cases.mjs`의 하드코딩된 브라우저 경로 제거
- [ ] 테스트 환경에 한국어 글꼴을 설치해 스크린샷으로 가독성 확인
- [ ] 앱 출시용 Capacitor 대응 (`STORE_RELEASE_PLAN.md` 2장)
