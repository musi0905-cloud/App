# 코드 가이드

코드 구조를 섹션별로 정리합니다. **코드를 바꾸면 해당 섹션도 함께 고칩니다.**

- 기준 버전: v0.9.0 (2026-09-30)
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
│  ├─ voice.js            전화 목소리 (기기 내장 한국어 음성)
│  ├─ sfx.js              합성 효과음 (벨 소리, 문 소리)
│  ├─ sw.js               오프라인 캐시 (서비스워커)
│  ├─ manifest.webmanifest PWA 설정
│  ├─ data/               게임 데이터 (JSON)
│  ├─ assets/             그림. v2/ = 이미지·모션 v2 (WebP, motion/*.mp4, previews/)
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
| `current()` | 지금 사건의 방문객(`v`), 이상 징후(`a`), 시나리오(`pack`)를 합칩니다. `pack.unitOverride`가 있으면 방문 호수를 덮어씁니다. `fillDeep()`이 사건 전체의 `{name}`, `{unit}`을 한 번에 채웁니다. |
| `render()` | `run.screen`에 따라 화면을 그립니다. |
| `evidence()`, `timeline()` | 경비실 화면의 "다음 할 일"과 사건 타임라인 |
| `inspect(tool)`, `verify()`, `renderTool()` | 조사 화면을 엽니다. **열기만 해서는 확인 처리되지 않습니다.** `readTool()`(아래쪽 주 버튼)을 눌러야 `run.seen`에 기록됩니다. |
| `documentView()`, `mountBooks()` | 관리실 기록부. 펼치기 전에는 표지를 보여 주고, 펼치면 4장을 넘겨 봅니다: ① 오늘 밤 방문 기록(`bookEntries()`가 날짜와 사건으로 앞서 온 3명을 고정 생성) ② 이 사람이 말한 것 ③ 관리실 기록 ④ 나란히 비교. 버튼, 밀기(40px 이상), 좌우 화살표로 넘깁니다. |
| `transcript()`, `callLines()`, `playCall()` | 통화 화면. `call.dialogue`(첫 통화)나 `call.verifyDialogue`(한 번 더 확인)를 대본으로 보여 주고, 버튼을 누르면 `voice.js`로 읽습니다. 지금 읽는 줄에 `.speaking`이 붙습니다. |
| `clueFor(tool)` | 도구별로 알게 된 내용. 사건의 핵심 채널(`a.channel`)이면 `plain.what`을 보여 줍니다. |
| `share()` | 1080×1350 결과 카드를 canvas로 만듭니다. 공유가 되면 OS 공유 창을, 안 되면 다운로드 링크를 띄웁니다. |
| `offline()` | 서비스워커를 등록합니다. Capacitor 앱 안에서는 건너뜁니다(이미 대응됨). |

- **저장 키**: `404_active_v2`는 진행 중인 근무, `404_last_run`은 마지막 결과입니다. 저장에 실패하면 경고 문구를 띄웁니다.
- **도구 이름**: 내부 키 `CCTV`, `명부`, `통화`, `재확인`은 유지하고, 화면 이름만 `TOOL_NAMES`로 바꿉니다.
- **초상**: `person(v)`는 `assets/visitors.png`(4명이 가로로 배치된 시트)에서 `(번호-1) % 4`번째 인물을 잘라 씁니다. 방문객 100명이 4가지 그림을 돌려 씁니다.

## 4-1. 전화 목소리 (voice.js)

- `playDialogue(lines, onLine)`: `[{who, text}]`를 차례로 읽습니다. 줄 사이에 0.25초 쉽니다. `stopVoice()`로 멈춥니다. 조사 화면을 떠나면 `show()`가 자동으로 멈춥니다.
- 음성 엔진: 웹은 `speechSynthesis`(ko-KR 음성 우선), 앱은 Capacitor `TextToSpeech` 플러그인(`@capacitor-community/text-to-speech`)입니다. Android 웹뷰에는 speechSynthesis가 없으므로 **앱으로 만들 때 이 플러그인을 꼭 설치**해야 합니다.
- `SPEAKERS`: 말하는 사람별 목소리 높이(pitch)와 빠르기(rate)입니다. 경비원, 주민, 관리실, 방문객, 가족, 회사 직원, 자동 응답, 모르는 사람이 있습니다. 대본의 `who`는 이 목록 안에서만 씁니다.
- 소리 켜기/끄기는 `localStorage['404_sound']`에 저장합니다.
- 나중에 녹음 파일로 바꾸려면 `speakLine()`만 오디오 재생으로 바꾸면 됩니다. 대본 구조는 그대로 씁니다.

## 4-1-1. 효과음 (sfx.js)

- 파일 없이 WebAudio로 만드는 짧은 소리입니다. `ring()`(인터폰 벨, 1.1초 뒤 resolve), `doorOpen()`, `doorShut()`. `voice.js`의 소리 설정을 같이 따릅니다.
- 첫 자동 재생 통화 앞에만 벨이 울립니다(`playCall`의 `start(true)`). ‘다시 듣기’에는 울리지 않습니다.

## 4-2. 화면 사진·영상 (game.js `activateMedia`)

- `class="scene-media"` 상자에 `data-poster`(사진 이름)와 `data-video`(영상 이름)를 적으면 됩니다. 사진은 배경으로 깔리고, 영상은 그 화면이 보일 때만 불러와 재생합니다. 화면을 떠나거나 앱이 가려지면 멈춥니다.
- 동작 줄이기 설정에서는 영상을 쓰지 않습니다.
- 쓰는 곳: 시작(`.door`), 경비실 방문객 카드(`.visitor`), 판단 결과(열린 문/닫힌 문, `setPoster`로 바꿈), 근무 결과, 기록부 표지(`mediaHTML`), 통화(`call-media`), 처음 안내의 예시 영상(`#clipGallery`, 펼칠 때만 불러옴)
- `setPoster(box, poster, video)`: 이미 만들어진 상자의 사진·영상을 바꿉니다.
- 판단 연출 `doorTransition(allow)`: `#doorTransition`(화면 전체, `pointer-events:none`)에 문 사진/영상과 한 줄 문구를 1초 보여 주고 0.4초에 걸쳐 사라집니다. 동작 줄이기에서는 소리만 납니다.

## 5. CCTV 재현 (replay.js)

- 사건마다 장면 3개, 장면당 6초로 총 18초입니다.
- **두 층**으로 되어 있습니다. 아래는 장소별 영상(`<video class="replay-video">`), 위는 투명한 canvas입니다. 영상이 없거나 열리지 않으면 canvas가 배경 사진을 직접 그립니다. 글자(카메라 이름, 시각, 상태)는 그 위의 HTML(`.replay-hud`)입니다.
- `sceneVideo(scene, look, camera)`가 장면에 맞는 영상을 고릅니다. 순서: 신호 끊김(loading) → 문 비교/열린 문 → (기본 카메라일 때) 인물·장소·이상 종류가 모두 맞는 이상 영상 → 공동현관 걷기 영상(소품 없음, normal) → 장소별 모니터 영상.
- 사람이 들어 있는 영상(걷기, 이상 영상)을 쓸 때는 canvas에 사람을 그리지 않습니다.
- 영상 시간은 `setVideo()`가 재생 위치(장면 안에서 0~6초)에 맞춥니다. 재생 중에는 0.3초 이상 어긋날 때만 맞춥니다.
- **원근법**: `LAYOUT[장소]`에 기준 발 위치 `y`와 그때의 키 `h`, 지평선 `horizon`, 뒤쪽 출발점 `far`/`farX`가 있습니다. `heightAt(장소, 발 y)`가 발 위치로 키를 정합니다. 걸어오는 경로는 `perspectiveY()`로 1/거리 원근을 따르고, x는 발 위치에 비례해 화면에서 직선이 됩니다.
- `actorPlacement()`: 위 원근법으로 동작(enter/cross/descend/turn/repeat)별 위치·키·방향(`facing`)을 냅니다. 가까이 보기 카메라의 확대 중심으로도 씁니다. 배경 사진을 바꾸면 `LAYOUT`의 값을 그 사진에 맞게 다시 잽니다.
- 걸음 프레임: `cross`는 이동 거리(보폭 = 키의 0.8배 = 8프레임)로 정해 발이 미끄러지지 않고, 깊이 방향 걷기는 `walkFrame(cursor)`(8fps)입니다.
- `contactShadow()`: 발밑 그림자. 서 있는 인물은 `breath`로 3초 주기 미세한 숨쉬기.
- 장면 전환 연출: `cutUntil`(0.32초 테이프 끊김). 재생 중 장면이 바뀌거나 장면 버튼을 누르면 켜집니다. 동작 줄이기에서는 버튼 전환 시 꺼집니다.
- 카메라(`CAMERAS`): ① 기본 ② 다른 방향(공동현관↔현관 옆은 실제 다른 그림, 나머지는 좌우 반전) ③ 가까이 보기(2.2배). `.replay-stage`에 CSS transform으로 적용하므로 영상과 canvas가 같이 움직입니다.
- `mountReplay(host, {pack, visitor, time, date})`가 화면을 만들고, 정리 함수를 돌려줍니다. 다른 화면으로 가면 `game.js`의 `clearReplay()`가 정리합니다.
- `cursor`(초)가 모든 상태의 기준입니다. 재생, 슬라이더, 장면 버튼이 모두 `cursor`만 바꾸고 `draw()`를 부릅니다. 같은 `cursor`에서는 항상 같은 그림이 나옵니다.
- 장면 데이터의 의미:
  - `location`: 배경. `lobby`, `lobbySide`, `hall`, `elevator`, `stairs`, `parking`, `door`
  - `action`: 움직임. `enter`, `cross`, `descend`, `turn`, `wait`, `wave`, `knock`, `phone`, `pan`
  - `mode`: 이상 징후 연출 41종 (`MODES`). 예: `double`(두 사람), `clock7`(시계 7분 차이), `absent`(사람 없음)
  - `prop`: 소품. `hat`, `umbrella`, `mask`, `phone`, `parcel`, `glove`
  - `offset`: 도착 시각 기준 몇 분 전·후인지
- 검사용 표시: canvas의 `data-mode`, `data-time`, `data-location`, `data-count`, `data-walk-frame`, `data-view`(카메라), `data-video`(재생 중인 영상) 속성을 테스트가 읽습니다.

### 5-1. 걷기 그림 (v0.8)

- 4명 모두 `assets/v2/visitor-0N-walk.webp`(4×2, 칸 384×512, 발 위치 192,496, 8fps)를 씁니다. 방문객 번호 `(번호-1) % 4 + 1`이 외형 번호입니다.
- `walkFrame(cursor) = floor(cursor×8) mod 8`. 내려오는 장면(descend)은 좌우 반전합니다.
- 서 있는 장면은 `assets/visitors.png`(기존 서 있는 그림)를 씁니다. 두 그림은 인물 키를 맞춰 그립니다(`WALK.figure`, `STAND`).
- v0.6.1의 V001 전용 걷기 그림(`character-motion-v1`)은 v2 걷기 그림으로 바뀌었습니다.

## 6. 데이터 (dist/data)

| 파일 | 개수 | 내용 |
|---|---|---|
| `visitors.json` | 100 | `id`(V001~), `name`, `unit`(호수), `role`, `claim` |
| `anomalies.json` | 100 | **정답의 기준**. `safe`(들여보내도 되는지), `channel`(핵심 단서가 있는 도구), `category` |
| `scenarios.json` | 100 | 사건별 장면 3개, 서류(`document`), 통화(`call` — `dialogue`, `verifyDialogue` 대본 포함), 쉬운 설명(`plain.what/check/confirmed/decision`), `recordCode` |
| `endings.json` | 30 | 결말 설계 목록. 실제 구현은 6개 (`implemented_in_prototype`) |

- `scenarios.json`의 `safe`, `channel`, `clue`, `verification`은 `anomalies.json`과 같아야 합니다. 테스트(`scenarios.test.mjs`)가 검사합니다.
- 문구의 `{name}`, `{unit}`은 `fillDeep()`이 방문객 정보로 바꿉니다.
- **화면 문구를 고칠 때는 `docs/WRITING_GUIDE.md`를 따릅니다.** 해요체, 짧은 문장, 어려운 말 금지, 조사 전 정답 노출 금지가 핵심입니다. `call.reply`, `plain.confirmed`, `verificationDetail`은 항상 같은 문장이어야 합니다(테스트가 검사).
- 화면에 보이지 않는 칸: `clue`, `verification`(원래 단서), `question`(이전 버전의 질문), `plain.decision`(현재 미사용). `plain.check`는 틀렸을 때 “다음에는 이렇게 해 보세요” 안내로도 씁니다.
- 결말 설명은 `game.js`의 `ENDING_NOTES`에 있습니다. 결말 종류에 따라 `#result[data-ending]`이 `best`/`bad`/`lost`/`plain`으로 바뀝니다.

## 7. 그림과 영상 (dist/assets)

| 파일 | 쓰는 곳 |
|---|---|
| `visitors.png` | 초상, CCTV의 서 있는 사람, 얼굴 확대 |
| `visitors-before-haircut.png` | `hairOld` 모드의 예전 사진 |
| `v2/cctv-*.webp` (6장) | CCTV 장소별 배경 |
| `v2/door-closed.webp`, `door-open.webp` | 집 현관문 |
| `v2/title-night`, `guard-office`, `intercom-desk`, `ledger-desk`, `ending-dawn` | 화면 사진 |
| `v2/visitor-01~04-walk.webp` | 걷기 8장면 |
| `v2/prop-*.webp` (6개) | 모자, 우산, 마스크, 휴대폰, 택배, 장갑 |
| `v2/motion/*.mp4` (23개) | 화면·CCTV 영상 (960×640, 6초, 무음) |
| `v2/previews/*.webp` | 예시 영상의 미리보기 |

- 원본(PNG, 검수 자료, 제작 코드)은 저장소의 `visual-motion-v2/`에 있습니다. 게임용은 WebP로 줄인 것입니다.
- 새 그림을 넣을 때: `visual-motion-v2`처럼 원본을 보관하고, WebP로 바꿔 `dist/assets/v2/`에 넣은 뒤 `sw.js`의 목록과 캐시 이름을 바꿉니다.

## 8. 오프라인 (sw.js)

- 설치할 때 `FILES` 목록 전체를 캐시합니다. 이후에는 캐시를 먼저 쓰고, 없으면 네트워크를 씁니다.
- **파일을 추가하거나 수정하면 `CACHE` 이름(`room404-v0.9.0`)을 올려야** 사용자에게 새 파일이 전달됩니다. 새 파일은 `FILES`에도 추가합니다.
- 영상(.mp4)은 미리 저장하지 않고 서비스워커도 가로채지 않습니다(용량, 구간 요청). 인터넷이 없으면 사진이 보입니다.
- 앱(Capacitor) 안에서는 서비스워커를 쓰지 않습니다. 모든 파일이 앱 안에 들어 있습니다.

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
- 브라우저 검사는 `speechSynthesis`를 가짜로 바꿔 끼워 통화 음성을 검사합니다(읽은 줄 수, ko-KR, 사람마다 다른 높이, 소리 끄기).
- 테스트용 서버는 `tests/static-server.mjs`입니다. 영상 탐색에 필요한 Range 요청을 지원합니다.
- 이 환경의 브라우저는 GPU가 없어 스크린샷에 영상이 검게 나옵니다. 영상 확인은 `data-video`와 `currentTime`으로 합니다.
- 마지막 결과(2026-09-30, v0.9.0): 13/13, 9/9, 100/100 모두 통과

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
| 높음 | Android 앱에 TextToSpeech 플러그인 설치 | 없으면 앱에서 전화 목소리가 나오지 않습니다. |
| 중간 | 장소별 두 번째 방향 배경 | 지금 ‘다른 방향’은 공동현관만 실제 그림이고 나머지는 좌우 반전입니다. 규격: `docs/CCTV_ANGLE_IMAGE_SPEC.md` |
| 중간 | 녹음 목소리로 교체 | 지금은 기기 내장 음성입니다. 대본 구조는 그대로 두고 오디오 파일로 바꿀 수 있습니다. |
| 중간 | 비스듬히 걷는 인물 그림 | 지금은 정면·옆면 두 가지라 대각선으로 다가오는 장면도 옆면을 씁니다. 3/4 방향 걷기 8장면이 있으면 더 자연스럽습니다. |
| 낮음 | 결말 24개 추가 구현 | `endings.json` 30개 중 6개만 구현되어 있습니다. |

### 완료한 개선

- v0.9.0: 장소별 원근법(발 위치로 키 결정, 1/거리 접근), 접지 그림자, 숨쉬기, 보폭 기반 걸음, 테이프 끊김, 문 열림/닫힘 판단 연출, 효과음, 결말 설명과 색, 틀렸을 때 안내.

- v0.8.0: 이미지·모션 v2를 전 화면에 적용했고, 4명 모두 걷기 그림을 씁니다. CCTV 카메라 바꾸기(다른 방향, 가까이)를 추가했습니다.

- v0.7.0: 모든 대사를 쉬운 말로 다시 썼고, 전화 목소리와 넘기는 기록부를 추가했습니다. 경비실 첫 안내 말투도 통일했습니다.

- v0.6.1: 조사 도구 버튼의 스크린리더 이름을 화면 이름과 일치시켰습니다.
- v0.6.1: `all-cases` 테스트의 브라우저 경로 하드코딩을 제거했습니다.
