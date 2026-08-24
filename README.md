# 쉼 (Shim) — iOS

> 힘든 순간에 사용자의 상태를 이해하고, 음악·시간·화면·움직임 등의 환경을 조합해
> '지금 나에게 필요한 몇 분'을 대신 설계하고 실행해주는 AI 기반 쉼 서비스.
>
> 「쉼」은 **추천 앱이 아니라 실행 앱**이다. 사용자를 앱에 오래 붙잡지 않는다.

현재 상태: **Sprint 0 — 개발 환경 및 저장소 기초 (부분 완료 / BLOCKED)**

---

## ⚠️ 이 저장소에 대한 중요한 참고사항

이 저장소(`musi0905-cloud/App`)에는 **서로 무관한 두 개의 프로젝트**가 함께 들어 있다.

| 위치 | 프로젝트 | 관계 |
|---|---|---|
| 저장소 루트 (`Code.gs`, `Index.html`, `Scripts.html`, `Styles.html`, `appsscript.json`) | 기존 Google Apps Script 웹앱 | 「쉼」과 **무관**. 건드리지 않는다. |
| `ios/`, `docs/`, `CLAUDE.md` | **「쉼」 iOS 프로젝트** | 이 README가 설명하는 대상 |

저장소 분리 여부는 Product Owner 결정 대기 중이다 — `docs/DECISIONS.md` **D-002** 참고.

---

## 기준 문서

Google Drive 문서가 **최상위 제품 기준**이고, 이 저장소의 문서는 개발 세션에서 빠르게 읽기 위한 **동기화 사본**이다.

| 저장소 문서 | Google Drive 원본 | 내용 |
|---|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | 쉼 제품 기획 기준서 v0.1 | 제품 정의, MVP 범위, AI 구조 |
| [`docs/IOS_SPEC.md`](docs/IOS_SPEC.md) | 02_쉼 iOS 개발 명세서 v0.1 | 아키텍처, RestPlan, Service 명세 |
| [`CLAUDE.md`](CLAUDE.md) | 03_쉼 Claude Code 운영규칙 v0.1 | 개발 운영규칙 |
| [`docs/SPRINTS.md`](docs/SPRINTS.md) | 04_쉼 Sprint Backlog v0.1 | Sprint 0~13 계획 및 상태 |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | — | 확정된 기술 결정 기록 |

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
│   └── DECISIONS.md               # 기술 결정 기록 (D-001 ~ D-007)
│
├── scripts/
│   └── verify_repo.py             # 저장소 정적 검증 (Linux에서도 실행 가능)
│
├── ios/
│   ├── project.yml                # XcodeGen 스펙 (프로젝트 재생성용)
│   ├── Shim.xcodeproj/
│   │   ├── project.pbxproj        # Xcode 프로젝트 (수기 작성, objectVersion 77)
│   │   └── xcshareddata/xcschemes/
│   │       └── Shim.xcscheme      # 공유 스킴 (xcodebuild -scheme Shim)
│   │
│   ├── Shim/                      # 앱 타깃 소스 (디렉터리 전체가 자동 동기화됨)
│   │   ├── ShimApp.swift          # @main 진입점
│   │   ├── RootView.swift         # Sprint 0 플레이스홀더 화면
│   │   └── Assets.xcassets/       # AppIcon / AccentColor
│   │
│   └── ShimTests/                 # 유닛 테스트 타깃
│       └── ShimSmokeTests.swift   # 스모크 테스트
│
└── (Code.gs, Index.html, ...)     # 기존 Apps Script 프로젝트 — 「쉼」과 무관
```

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

> `Shim.xcodeproj`는 `PBXFileSystemSynchronizedRootGroup`을 사용한다.
> **`ios/Shim/` 아래에 파일을 추가할 때 `project.pbxproj`를 수정할 필요가 없다.** 디렉터리가 그대로 타깃에 동기화된다.

---

## 빌드 방법

### 요구 환경

| 항목 | 요구사항 |
|---|---|
| OS | **macOS** |
| Xcode | **16.0 이상** (`objectVersion = 77` 포맷 — `docs/DECISIONS.md` D-006) |
| 배포 타깃 | iOS 17.0 (D-003) |
| Swift | 5.0 언어 모드 (D-005) |
| Apple Developer 계정 | Simulator 빌드에는 **불필요**. 실기기 설치부터 필요 (D-004) |

### Xcode에서 열기

```bash
open ios/Shim.xcodeproj
```

스킴 `Shim`을 선택하고 Simulator(예: iPhone 15) 대상으로 ⌘R.

### 명령줄 빌드

```bash
# Simulator 대상 빌드
xcodebuild build \
  -project ios/Shim.xcodeproj \
  -scheme Shim \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# 유닛 테스트 실행
xcodebuild test \
  -project ios/Shim.xcodeproj \
  -scheme Shim \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# 사용 가능한 Simulator 목록 확인
xcrun simctl list devices available
```

### 프로젝트 파일이 열리지 않는 경우

`project.pbxproj`는 Xcode 없이 수기로 작성했다 (D-006). Xcode 15 이하이거나 파일이 손상된 경우 XcodeGen으로 재생성한다.

```bash
brew install xcodegen
cd ios && xcodegen generate
```

`ios/project.yml`은 `Shim.xcodeproj`와 동일한 구성의 선언적 정의다. **한쪽을 바꾸면 다른 쪽도 갱신해야 한다.**

### 실기기 배포 준비

1. Xcode에서 `Shim` 타깃 → Signing & Capabilities
2. Team을 본인 Apple ID 팀으로 선택
3. **Team ID가 `project.pbxproj`에 기록되므로 커밋 전 `git diff`로 확인한다** (D-004)

---

## 저장소 검증

Xcode가 없는 환경에서도 실행 가능한 정적 검증 스크립트를 제공한다.

```bash
python3 scripts/verify_repo.py
```

**검증하는 것**
- Sprint 0 필수 문서·파일 존재 여부
- `project.pbxproj` 구조 정합성 (오브젝트 ID 참조, 괄호 균형, 필수 섹션)
- 동기화 그룹이 가리키는 디렉터리 실존 여부
- 공유 스킴이 실제 타깃을 참조하는지
- `project.yml` ↔ `project.pbxproj` 설정 일치
- **시크릿 스캔** (API Key, 토큰, 개인키 등)
- `DEVELOPMENT_TEAM`이 커밋되지 않았는지

**검증하지 않는 것 — 중요**
- Swift 컴파일 여부
- Xcode가 프로젝트를 여는지
- Simulator 빌드 성공 여부
- 유닛 테스트 통과 여부

> **이 스크립트의 PASS는 "빌드 성공"이 아니다.** 위 네 항목은 macOS + Xcode에서만 확인 가능하다.

---

## 현재 개발 환경 제약 (중요)

이 프로젝트의 Claude Code 세션은 **Linux(Ubuntu 24.04)** 에서 실행되고 있다.

| 항목 | 상태 |
|---|---|
| macOS | ❌ 아님 |
| Xcode | ❌ 미설치, 설치 불가 |
| Swift 툴체인 | ❌ 미설치 |
| iOS Simulator | ❌ 사용 불가 |
| 실기기 iPhone | ❌ 연결 불가 |

Xcode와 iOS Simulator는 macOS 전용이며 Linux에서 우회할 방법이 없다.
SwiftUI·UIKit·AVFoundation 등은 Apple 플랫폼 전용이라 Linux Swift 툴체인으로도 컴파일 검증이 불가능하다.

**따라서 Sprint 0의 Acceptance Criteria 중 다음 두 항목은 이 환경에서 충족할 수 없다.**
- AC-1: 프로젝트가 Xcode에서 열린다
- AC-2: Simulator 대상 빌드가 성공한다

해제 방법(1안 로컬 Mac / 2안 GitHub Actions macOS 러너 / 3안 병행)은 `docs/DECISIONS.md` **D-001** 참고.

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
