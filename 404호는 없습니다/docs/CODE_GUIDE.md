# 코드 가이드

코드 구조를 섹션별로 정리합니다. **코드를 바꾸면 해당 섹션도 함께 고칩니다.**

- 기준 버전: v0.6.1 (2026-09-30)
- 코드 위치: `room404/`
- 빌드 과정 없이 `room404/dist/` 폴더를 그대로 웹 서버에 올리면 실행됩니다.

---

## 1. 전체 구조

```
room404/
├─ dist/                  ← 실제 게임 (이 폴더만 배포)
│  ├─ index.html          화면 뼈대 (5개 화면 섹션)
│  ├─ style.css           스타일 (모바일 우선, 최대 폭 540px)
│  ├─ game.js             화면 제어·조사 도구·저장·결과 카드
│  ├─ engine.js           규칙: 사건 선택·판정·결말·저장 검증
│  ├─ replay.js           CCTV 재현 (canvas 애니메이션)
│  ├─ sw.js               오프라인 캐시 (서비스워커)
│  ├─ manifest.webmanifest PWA 설정
│  ├─ data/               게임 데이터 (JSON)
│  ├─ assets/             그림 (스프라이트 시트)
│  └─ icons/              앱 아이콘
├─ tests/                 자동 검사
├─ scripts/               v0.6 문구 변환 기록 (다시 실행 금지)
├─ test-artifacts/        검사 결과와 화면 캡처
└─ CLAUDE_HANDOFF.md 등   인수인계·변경 기록
```

## 2. 화면 흐름

`index.html`에는 5개 화면이 있고, `game.js`의 `show(screen)`이 하나만 보이게 합니다.

```
home ──시작──▶ game ◀──돌아가기── investigation
                 │                 (CCTV / 기록 / 전화 / 한 번 더 확인)
              판단(들여보내기 / 문 열지 않기)
                 ▼
             feedback ──다음──▶ game … (8명) ──▶ result
```

| 화면 | 역할 |
|---|---|
| `home` | 첫 근무, 오늘의 근무, 이어하기, 처음 하는 사람을 위한 4단계 안내, 설치 안내 |
| `game` | 방문객 초상, 주장, 조사 도구 4개, 사건 타임라인, 판단 버튼 |
| `investigation` | 도구별 조사 화면. 버튼을 눌러야 내용이 열림 |
| `feedback` | 판단이 맞았는지와 이유 |
| `result` | 결말, 통계, 결과 이미지(PNG) 저장 |

- `investigation`은 저장 대상이 아닙니다. 저장되는 `run.screen`은 `game`, `feedback`, `result` 셋뿐입니다. 조사 중에 앱을 닫으면 `game` 화면에서 다시 시작합니다.

## 3. 게임 규칙 (engine.js)

순수 함수로만 되어 있어 화면 없이 테스트할 수 있습니다.

| 함수 | 역할 |
|---|---|
| `newRun(mode, visitors, anomalies, date)` | 근무 1회(8건)를 만듭니다. `story`는 순서가 고정되고, `daily`는 날짜(한국 시간) 기반 시드로 매일 같은 8건이 나옵니다. |
| `decideRun(run, allow, anomalies)` | 판단을 기록합니다. 같은 사건에 두 번 판단하는 것은 막습니다. |
| `advance(run)` | 다음 사건으로 넘어갑니다. 8건을 마치면 `result`가 됩니다. |
| `totals(run)` | 정답 수, 위험 허용 수, 정상 거부 수, 조사 횟수를 셉니다. |
| `ending(run, anomalies)` | 결말을 정합니다. 우선순위: 404호 → 오판 → 무고한 거부 → 신중한 경비원 → 기본 결말 |
| `validRun(...)` | 저장 데이터가 손상됐는지 검사합니다. 손상되면 새 근무로 시작합니다. |

- **`VERSION='0.2.0'`은 바꾸면 안 됩니다.** 저장 호환 키입니다. 바꾸면 기존 사용자의 진행 기록이 모두 무효가 됩니다. 화면 버전(v0.6.1)과 다른 것은 의도된 것입니다.
- 도착 시각은 `TIMES`에 고정되어 있습니다(00:13 ~ 05:50).

## 4. 화면 제어 (game.js)

| 부분 | 설명 |
|---|---|
| `boot()` | JSON 3개를 불러와 개수(각 100개)를 검증하고, 저장된 근무를 복원합니다. 실패하면 "다시 불러오기" 버튼을 보여 줍니다. |
| `current()` | 지금 사건의 방문객(`v`), 이상 징후(`a`), 시나리오(`pack`)를 합칩니다. `pack.unitOverride`가 있으면 방문 호수를 덮어씁니다. |
| `render()` | `run.screen`에 따라 화면을 그립니다. |
| `evidence()`, `timeline()` | 경비실 화면의 "다음 할 일"과 사건 타임라인 |
| `inspect(tool)`, `verify()`, `renderTool()` | 조사 화면을 엽니다. **열기만 해서는 확인 처리되지 않습니다.** `readTool()`(아래쪽 주 버튼)을 눌러야 `run.seen`에 기록됩니다. |
| `documentView()`, `transcript()` | 기록 비교 화면과 통화 기록 화면 |
| `clueFor(tool)` | 도구별로 알게 된 내용. 사건의 핵심 채널(`a.channel`)이면 `plain.what`을 보여 줍니다. |
| `share()` | 1080×1350 결과 카드를 canvas로 만듭니다. 공유가 되면 OS 공유 창을, 안 되면 다운로드 링크를 띄웁니다. |
| `offline()` | 서비스워커를 등록합니다. Capacitor 앱 안에서는 건너뜁니다(이미 대응됨). |

- **저장 키**: `404_active_v2`는 진행 중인 근무, `404_last_run`은 마지막 결과입니다. 저장에 실패하면 경고 문구를 띄웁니다.
- **도구 이름**: 내부 키 `CCTV`, `명부`, `통화`, `재확인`은 유지하고, 화면 이름만 `TOOL_NAMES`로 바꿉니다.
- **초상**: `person(v)`는 `assets/visitors.png`(4명이 가로로 배치된 시트)에서 `(번호-1) % 4`번째 인물을 잘라 씁니다. 방문객 100명이 4가지 그림을 돌려 씁니다.

## 5. CCTV 재현 (replay.js)

- 사건마다 장면 3개, 장면당 6초로 총 18초입니다. 실제 영상이 아니라 그림을 canvas 위에서 움직인 것입니다.
- `mountReplay(host, {pack, visitor, time, date})`가 화면을 만들고, 정리 함수를 돌려줍니다. 다른 화면으로 가면 `game.js`의 `clearReplay()`가 정리합니다.
- `cursor`(초)가 모든 상태의 기준입니다. 재생, 슬라이더, 장면 버튼이 모두 `cursor`만 바꾸고 `draw()`를 부릅니다. 같은 `cursor`에서는 항상 같은 그림이 나옵니다.
- 장면 데이터의 의미:
  - `location`: 배경. `lobby`, `lobbySide`, `hall`, `elevator`, `stairs`, `parking`, `door`
  - `action`: 움직임. `enter`, `cross`, `descend`, `turn`, `wait`, `wave`, `knock`, `phone`, `pan`
  - `mode`: 이상 징후 연출 41종 (`MODES`). 예: `double`(두 사람), `clock7`(시계 7분 차이), `absent`(사람 없음)
  - `prop`: 소품. `hat`, `umbrella`, `mask`, `phone`, `parcel`, `glove`
  - `offset`: 도착 시각 기준 몇 분 전·후인지
- 검사용 표시: canvas의 `data-mode`, `data-time`, `data-location`, `data-count`, `data-walk-frame` 속성을 테스트가 읽습니다.

### 5-1. V001 걷기 모션 (v0.6.1)

- `WALK` 설정: `assets/visitor-v001-walk-8f.png`(4×2, 프레임 384×512, 8fps). 대상은 방문객 `V001`, 동작은 `enter`, `cross`, `descend`입니다.
- `walkFrame(cursor) = floor(cursor×8) mod 8`
- `WALK.anchors`에는 프레임별 `[몸통 중심 x, 발 y, 머리 y]`가 들어 있습니다. 불투명 픽셀(alpha>128)을 측정한 값입니다. `actor()`가 이 값으로 기존 서 있는 그림(`STAND`)과 키, 발 위치, 몸통 중심을 맞춥니다.
- `descend`에서는 좌우 반전합니다. 그림이 오른쪽을 보고 있기 때문입니다.
- **다른 방문객에게 넓히려면**: 새 시트를 만든 뒤 `anchors`를 다시 측정하고 `WALK.visitors`에 추가합니다. 방문객마다 시트가 다르면 `WALK`를 방문객별 목록으로 바꿔야 합니다.

## 6. 데이터 (dist/data)

| 파일 | 개수 | 내용 |
|---|---|---|
| `visitors.json` | 100 | `id`(V001~), `name`, `unit`(호수), `role`, `claim` |
| `anomalies.json` | 100 | **정답의 기준**. `safe`(들여보내도 되는지), `channel`(핵심 단서가 있는 도구), `category` |
| `scenarios.json` | 100 | 사건별 장면 3개, 서류(`document`), 통화(`call`), 쉬운 설명(`plain.what/check/confirmed/decision`), `recordCode` |
| `endings.json` | 30 | 결말 설계 목록. 실제 구현은 6개 (`implemented_in_prototype`) |

- `scenarios.json`의 `safe`, `channel`, `clue`, `verification`은 `anomalies.json`과 같아야 합니다. 테스트(`scenarios.test.mjs`)가 검사합니다.
- 문구의 `{name}`, `{unit}`은 `fill()`이 방문객 정보로 바꿉니다.

## 7. 그림 (dist/assets)

| 파일 | 배치 | 쓰는 곳 |
|---|---|---|
| `visitors.png` | 1536×1024, 가로 4명 | 초상, CCTV 인물 |
| `visitors-before-haircut.png` | 같은 배치 | `hairOld` 모드의 예전 사진 |
| `visitor-v001-walk-8f.png` | 4×2 프레임 | V001 걷기 (v0.6.1) |
| `cctv-lobby.png` | 1장 | 공동현관 배경 |
| `apartment-scenes.png` | 가로 3칸 | 승강기, 복도, 계단 |
| `detail-scenes.png` | 가로 3칸 | 주차장, 문 열림, 문 닫힘 |
| `mystery-props.png` | 3×2 | 모자, 우산, 마스크, 휴대폰, 택배, 장갑 |

## 8. 오프라인 (sw.js)

- 설치할 때 `FILES` 목록 전체를 캐시합니다. 이후에는 캐시를 먼저 쓰고, 없으면 네트워크를 씁니다.
- **파일을 추가하거나 수정하면 `CACHE` 이름(`room404-v0.6.1`)을 올려야** 사용자에게 새 파일이 전달됩니다. 새 파일은 `FILES`에도 추가합니다.
- 앱(Capacitor) 안에서는 서비스워커를 쓰지 않습니다.

## 9. 테스트 (tests)

```bash
cd room404
npm ci
npm test                 # engine.test + scenarios.test (11개)
npm run test:ui          # 브라우저 회귀 9그룹. Linux용 Chromium 준비를 겸함
npm run test:all-cases   # 사건 100개 × 장면 3개 전수 검사
```

- `test:ui`를 먼저 실행해야 합니다. `@sparticuz/chromium`에서 브라우저를 `/tmp/room404-chromium`으로 풀기 때문입니다. 다른 OS에서는 `CHROMIUM_EXECUTABLE`을 지정합니다.
- 두 브라우저 검사는 `test-artifacts/`의 결과 JSON과 스크린샷을 덮어씁니다.
- 스크린샷의 한글이 네모로 보이면 한국어 글꼴을 설치합니다(예: `fonts-noto-cjk`).
- 마지막 결과(2026-09-30): 11/11, 9/9, 100/100 모두 통과

## 10. 주의사항

- `scripts/*-v6.py`는 **다시 실행하지 않습니다.** 반복 치환으로 문구가 손상됩니다.
- `changes-from-v0.5.patch`는 참고 기록입니다. **다시 적용하지 않습니다.**
- 조사하기 전에 결말이나 정답이 드러나면 안 됩니다. 테스트가 "버튼을 누르기 전에는 확인 결과가 보이지 않음"을 검사합니다.
- 운영 사이트(ChatGPT Sites, 소유자 전용)의 공개 범위는 바꾸지 않습니다.

## 11. 개선 후보

| 우선 | 항목 | 이유 |
|---|---|---|
| 높음 | Android 뒤로가기 처리 | 앱에서 뒤로가기를 누르면 바로 종료됩니다. 조사 화면에서는 경비실로 돌아가야 합니다. |
| 높음 | 결과 이미지 저장을 앱 방식으로 | Android 웹뷰에서는 파일 공유와 blob 다운로드가 동작하지 않을 수 있습니다. Capacitor Share/Filesystem을 씁니다. |
| 중간 | 저장을 Capacitor Preferences로 이중화 | 웹뷰의 localStorage는 OS가 정리할 때 지워질 수 있습니다. |
| 중간 | 걷기 모션을 다른 방문객으로 확대 | 지금은 V001만 적용되어 있습니다. |
| 낮음 | 경비실 첫 안내 문구 말투 통일 | "확인하십시오"만 딱딱한 말투로 남아 있습니다. |
| 낮음 | 결말 24개 추가 구현 | `endings.json` 30개 중 6개만 구현되어 있습니다. |

### 완료한 개선

- v0.6.1: 조사 도구 버튼의 스크린리더 이름을 화면 이름과 일치시켰습니다.
- v0.6.1: `all-cases` 테스트의 브라우저 경로 하드코딩을 제거했습니다.
