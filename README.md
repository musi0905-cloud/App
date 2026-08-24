# 쉼 (Shim) — iOS

> 힘든 순간에 사용자의 상태를 이해하고, 음악·시간·화면·움직임 등의 환경을 조합해
> '지금 나에게 필요한 몇 분'을 대신 설계하고 실행해주는 AI 기반 쉼 서비스.
>
> 「쉼」은 **추천 앱이 아니라 실행 앱**이다. 사용자를 앱에 오래 붙잡지 않는다.

**현재 상태: Sprint 0 — 개발 환경 및 저장소 기초 (BLOCKED, Mac 검증 대기)**

Sprint 0은 아래 [Mac 검증 절차](#mac-검증-절차-sprint-0-종료-조건)가 **3개 모두 성공한 뒤에만** DONE 처리된다.
Sprint 1은 그 전까지 시작하지 않는다.

---

## 기준 문서

Google Drive 문서가 **최상위 제품 기준**이고, 이 저장소의 문서는 개발 세션에서 빠르게 읽기 위한 **동기화 사본**이다.

| 저장소 문서 | Google Drive 원본 | 내용 |
|---|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | 쉼 제품 기획 기준서 v0.1 | 제품 정의, MVP 범위, AI 구조 |
| [`docs/IOS_SPEC.md`](docs/IOS_SPEC.md) | 02_쉼 iOS 개발 명세서 v0.1 | 아키텍처, RestPlan, Service 명세 |
| [`CLAUDE.md`](CLAUDE.md) | 03_쉼 Claude Code 운영규칙 v0.1 | 개발 운영규칙 |
| [`docs/SPRINTS.md`](docs/SPRINTS.md) | 04_쉼 Sprint Backlog v0.1 | Sprint 0~13 계획 및 상태 |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | — | 확정된 기술 결정 기록 (D-001~D-009) |

**문서 간 충돌 시 우선순위**: 제품 기준서 > iOS 개발 명세서 > 운영규칙 > Sprint Backlog

---

## 프로젝트 구조

```
.
├── CLAUDE.md                      # 개발 운영규칙 (Claude Code가 세션마다 읽음)
├── README.md                      # 이 파일
├── .gitignore                     # 시크릿·빌드 산출물 차단
│
├── docs/
│   ├── PRODUCT.md                 # 제품 기획 기준서
│   ├── IOS_SPEC.md                # iOS 개발 명세서
│   ├── SPRINTS.md                 # Sprint Backlog + 현재 상태
│   └── DECISIONS.md               # 기술 결정 기록
│
├── scripts/
│   ├── verify_repo.py             # 저장소 정적 검증 (Linux/Mac 모두 실행 가능)
│   └── mac_verify.sh              # Mac 전용 Sprint 0 검증 자동화 (아래 참고)
│
└── ios/
    ├── project.yml                # XcodeGen 스펙 — 프로젝트 정의의 기준 (D-006)
    ├── Shim.xcodeproj/            # 생성된 Xcode 프로젝트 (fallback 용도로 커밋됨)
    │   ├── project.pbxproj
    │   └── xcshareddata/xcschemes/Shim.xcscheme
    │
    ├── Shim/                      # 앱 타깃 소스
    │   ├── ShimApp.swift          # @main 진입점
    │   ├── RootView.swift         # Sprint 0 플레이스홀더 화면
    │   └── Assets.xcassets/       # AppIcon / AccentColor
    │
    └── ShimTests/                 # 유닛 테스트 타깃
        └── ShimSmokeTests.swift   # 스모크 테스트
```

> `ios/` 하위에 둔 이유: Sprint 8에서 `backend/`가 추가된다 (`docs/SPRINTS.md`). 플랫폼별 최상위 분리를 미리 확보한다.

### Sprint 1 이후 추가될 디렉터리

`docs/IOS_SPEC.md` §4의 권장 구조를 따라 `ios/Shim/` 아래에 배치한다.

```
ios/Shim/
├── Features/Home/  Features/RestSession/  Features/RestResult/
├── Models/         # RestPlan, RestSessionState, ...
├── Engine/         # RestPlanExecutor, RestPlanValidator
├── Services/       # Audio/ Timer/ Brightness/ Notification/
├── Persistence/
└── Resources/
```

⚠️ **소스 파일을 추가한 뒤에는 반드시 `cd ios && xcodegen generate`를 다시 실행한다.**
XcodeGen이 생성한 프로젝트는 파일을 명시적으로 나열하므로, 재생성하지 않으면 새 파일이 빌드에 포함되지 않는다.

---

## 요구 환경

| 항목 | 요구사항 |
|---|---|
| OS | **macOS** |
| Xcode | **16.0 이상** |
| XcodeGen | `brew install xcodegen` — **권장 경로** (D-006) |
| 배포 타깃 | **iOS 17.0** (D-003, Product Owner 확정) |
| Swift | 5.0 언어 모드 (D-005) |
| 테스트 | XCTest (D-007) |
| Apple Developer 계정 | Simulator 빌드·테스트에는 **불필요**. 실기기 설치부터 필요 (D-004) |

---

## Mac 검증 절차 (Sprint 0 종료 조건)

Product Owner 결정에 따라 **다음 3개가 모두 성공해야 Sprint 0을 DONE 처리한다.**

| # | 검증 | Acceptance Criteria |
|---|---|---|
| 1 | Xcode에서 프로젝트가 열린다 | AC-1 |
| 2 | iOS Simulator 대상 build 성공 | AC-2 |
| 3 | Unit Test 성공 | AC-6 |

### 방법 A — 자동화 스크립트 (권장)

Mac에서 아래 한 줄이면 위 3개를 순서대로 검증하고 로그를 남긴다.

```bash
./scripts/mac_verify.sh
```

- XcodeGen이 설치돼 있으면 **`ios/project.yml` 기준으로 프로젝트를 재생성한 뒤** 검증한다 (D-006).
- XcodeGen이 없으면 커밋된 `ios/Shim.xcodeproj`로 fallback하고, 그 사실을 로그에 남긴다.
- 사용 가능한 iPhone Simulator를 자동 탐지한다.
- 전체 로그가 `build-logs/mac_verify_<타임스탬프>.log`에 저장된다. (이 디렉터리는 `.gitignore` 처리됨)

실패하면 스크립트가 **어느 단계에서 실패했는지와 로그 경로**를 출력한다. 그 로그를 그대로 전달하면 된다.

옵션:

```bash
./scripts/mac_verify.sh --simulator "iPhone 16 Pro"   # Simulator 지정
./scripts/mac_verify.sh --no-xcodegen                 # XcodeGen 건너뛰고 커밋된 프로젝트로 검증
./scripts/mac_verify.sh --open                        # 검증 성공 후 Xcode로 열기
```

### 방법 B — 수동 절차

자동화 스크립트가 동작하지 않을 때 아래를 순서대로 실행한다.

```bash
# ── 0. 사전 확인 ────────────────────────────────────────────
xcodebuild -version              # Xcode 16.0 이상인지 확인
xcode-select -p                  # Command Line Tools 경로 확인
brew install xcodegen            # 미설치 시
xcodegen --version

# ── 1. XcodeGen으로 프로젝트 재생성 (우선 경로, D-006) ──────
cd ios
xcodegen generate
# 기대 출력: "Created project at .../ios/Shim.xcodeproj"

# ── 2. Xcode에서 열기  → AC-1 ──────────────────────────────
open Shim.xcodeproj
# 확인: 좌측 네비게이터에 Shim / ShimTests 두 타깃이 보이고,
#       상단 스킴 선택기에 "Shim" 스킴이 있는지

# ── 3. 사용 가능한 Simulator 확인 ──────────────────────────
xcrun simctl list devices available | grep iPhone
# 아래 명령의 name= 값을 여기서 나온 실제 이름으로 바꿔 사용한다

# ── 4. Simulator 대상 빌드  → AC-2 ─────────────────────────
xcodebuild build \
  -project Shim.xcodeproj \
  -scheme Shim \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  | tail -30
# 기대: ** BUILD SUCCEEDED **

# ── 5. Unit Test 실행  → AC-6 ──────────────────────────────
xcodebuild test \
  -project Shim.xcodeproj \
  -scheme Shim \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  | tail -40
# 기대: ** TEST SUCCEEDED **  (ShimSmokeTests 2개 통과)
```

### 검증 후 할 일

**성공한 경우** — 아래를 알려주면 Sprint 0을 DONE 처리하고 Sprint 1 계획을 제시한다.

1. `xcodebuild -version` 출력
2. `** BUILD SUCCEEDED **` / `** TEST SUCCEEDED **` 확인 여부
3. XcodeGen을 사용했는지 여부
4. `xcodegen generate` 후 `git status`에 `ios/Shim.xcodeproj/project.pbxproj` 변경이 잡혔다면 그 사실
   → 생성된 프로젝트가 기준이 되므로 **그 변경을 커밋한다** (D-006)

**실패한 경우** — 아래를 그대로 전달하면 원인을 분석해 수정한다.

1. 실패한 단계 번호 (1~5) 또는 `mac_verify.sh` 로그 파일
2. 오류 메시지 전문 (`xcodebuild` 출력의 `error:` 줄 포함)
3. `xcodebuild -version` 출력

> `ios/Shim.xcodeproj/project.pbxproj`는 Xcode 없이 수기로 작성됐다.
> **문제가 있으면 억지로 유지하지 않고 `ios/project.yml` 기준으로 재생성한 결과로 교체한다** (D-006, Product Owner 결정).

---

## 실기기 배포 준비

Sprint 0에는 실기기 검증 항목이 없다. Sprint 3(Audio PoC)부터 필요하다.

1. Xcode에서 `Shim` 타깃 → Signing & Capabilities
2. Team을 본인 Apple ID 팀으로 선택
3. ⚠️ **Team ID가 프로젝트 파일에 기록되므로 커밋 전 `git diff`로 확인한다** (D-004)
   - XcodeGen 경로를 쓴다면 `ios/project.yml`의 `DEVELOPMENT_TEAM`은 빈 값으로 유지하고, 로컬에서만 설정한다

---

## 저장소 정적 검증

Xcode가 없는 환경(Linux 개발 세션 포함)에서도 실행 가능하다.

```bash
python3 scripts/verify_repo.py
```

**검증하는 것**
- Sprint 0 필수 문서·파일 존재 여부
- `project.pbxproj` 구조 정합성 (오브젝트 ID 참조, 괄호 균형, 필수 섹션)
- 동기화 그룹이 가리키는 디렉터리 실존 여부
- 공유 스킴이 실제 타깃을 참조하는지
- `project.yml` ↔ `project.pbxproj` 설정 일치 (배포 타깃 / Swift 버전 / 번들 ID)
- **시크릿 스캔** (API Key, 토큰, 개인키 등 9종 패턴)
- `DEVELOPMENT_TEAM`이 커밋되지 않았는지

**검증하지 않는 것 — 중요**
- Swift 컴파일 여부
- Xcode가 프로젝트를 여는지 (AC-1)
- Simulator 빌드 성공 여부 (AC-2)
- 유닛 테스트 통과 여부 (AC-6)

> **이 스크립트의 PASS는 "빌드 성공"이 아니다.** 위 세 AC는 macOS + Xcode에서만 확인 가능하다.
> 그래서 `scripts/mac_verify.sh`가 따로 있다.

---

## 현재 개발 환경 제약

이 프로젝트의 Claude Code 세션은 **Linux(Ubuntu 24.04)** 에서 실행된다.

| 항목 | 상태 |
|---|---|
| macOS | ❌ 아님 |
| Xcode | ❌ 미설치, 설치 불가 |
| Swift 툴체인 | ❌ 미설치 |
| iOS Simulator | ❌ 사용 불가 |
| 실기기 iPhone | ❌ 연결 불가 |

Xcode와 iOS Simulator는 macOS 전용이며 Linux에서 우회할 방법이 없다.
SwiftUI·UIKit·AVFoundation 등은 Apple 플랫폼 전용이라 Linux Swift 툴체인으로도 컴파일 검증이 불가능하다.

따라서 **AC-1 / AC-2 / AC-6은 Product Owner의 Mac 환경에서만 확인 가능하다.** → `docs/DECISIONS.md` **D-001**

GitHub Actions macOS CI는 Product Owner 결정에 따라 **Sprint 0 완료의 필수 조건이 아니다.**
MVP 초기 기능 안정화 이후 도입할 Backlog 항목으로 유지한다 (B-002, D-008).

> `CLAUDE.md` §5에 따라, 검증되지 않은 항목을 "완료"라고 보고하지 않는다.

---

## 개발 원칙 요약

전문은 [`CLAUDE.md`](CLAUDE.md)를 참고한다.

- 한 번에 **하나의 Sprint**만 수행한다. 현재 Sprint 완료 전 다음 Sprint를 구현하지 않는다.
- 테스트하지 않은 기능을 "완료"라고 표현하지 않는다.
- 실기기 검증이 필요한 항목은 **"구현 완료 / 실기기 미검증"** 으로 구분해 보고한다.
- **API Key와 secret을 앱이나 Git에 저장하지 않는다.** iOS 앱은 OpenAI API를 직접 호출하지 않는다.
- iOS 비공개 API와 App Store 정책 우회 방식을 사용하지 않는다.
- UI에 iOS 시스템 API 호출 로직을 넣지 않는다. Service 계층이 담당한다.
- 제품 기준서와 충돌하는 기능을 임의로 추가하지 않는다.

---

## 라이선스

미정 — Product Owner 결정 필요.
