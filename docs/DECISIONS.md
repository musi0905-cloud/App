# docs/DECISIONS.md — 기술 결정 기록

> 각 Sprint에서 확정된 중요한 기술 결정을 기록한다.
> 상태: `제안` = PO 승인 대기 / `확정` = 승인됨 / `보류` = 조건 충족 시 재검토

---

## D-001. 개발 환경: 현재 세션은 Linux이며 iOS 빌드가 불가능하다

- **Sprint**: 0
- **상태**: 확정 (사실 확인) / 대응 방안은 **PO 결정 필요**
- **문제 구분**: C — 개발 환경 제약

### 확인된 사실 (2026-08-24)

| 확인 항목 | 명령 | 결과 |
|---|---|---|
| OS | `uname -a` | `Linux vm 6.18.44-fc-v21 ... x86_64` |
| 배포판 | `/etc/os-release` | `Ubuntu 24.04.4 LTS (Noble Numbat)` |
| macOS 여부 | `sw_vers` | **명령 없음 → macOS 아님** |
| Xcode | `xcodebuild -version` | **명령 없음 → 미설치** |
| Swift | `swift --version` | **명령 없음 → 툴체인 미설치** |
| Xcode CLI | `xcrun --version` | **명령 없음** |

### 결과

- Xcode, iOS Simulator, `xcodebuild`는 **macOS 전용**이며 Linux에 설치할 수 없다. 우회 수단은 없다.
- SwiftUI / UIKit / AVFoundation / UserNotifications는 Apple 플랫폼 전용 프레임워크이므로
  Linux용 Swift 툴체인을 설치하더라도 **이 프로젝트의 컴파일 검증에는 쓸 수 없다.**
- 따라서 이 환경에서 Sprint 0 Acceptance Criteria 중 **AC-1(Xcode에서 열림)**, **AC-2(Simulator 빌드 성공)** 는
  **검증 불가**이며, 충족했다고 보고해서는 안 된다.

### 이 환경에서 할 수 있는 것 / 없는 것

| 가능 | 불가능 |
|---|---|
| Swift 소스 작성 | Swift 컴파일 |
| `.xcodeproj` 파일 작성 | Xcode로 열어 확인 |
| 프로젝트 구조·참조 정합성 정적 검증 (`scripts/verify_repo.py`) | Simulator 빌드 |
| 문서 작성 및 동기화 | 유닛 테스트 실행 |
| 시크릿 스캔 | 실기기 검증 |

### 대응 옵션 (PO 결정 필요)

**1안 — macOS + Xcode 로컬 환경에서 검증 (권장)**
- PO가 Mac에서 저장소를 clone하고 `ios/Shim.xcodeproj`를 열어 Simulator 빌드를 실행한다.
- 장점: 즉시 확인 가능, 추가 비용 없음, 실기기 검증까지 같은 환경에서 이어진다.
- 단점: 매 Sprint마다 PO의 수동 확인이 필요하다.

**2안 — GitHub Actions macOS 러너로 CI 자동 검증**
- `.github/workflows/ios.yml`에서 `runs-on: macos-latest` + `xcodebuild build test` 실행.
- 장점: Claude Code가 PR/푸시마다 실제 빌드·테스트 결과를 객관적으로 확인할 수 있다. 회귀 방지.
- 단점: GitHub Actions macOS 러너는 분당 과금 배수가 높다. 초기 설정 시간이 필요하다.
- **B-002로 Backlog에 등록됨.**

**3안 — 1안 + 2안 병행**
- CI로 Simulator 빌드/유닛 테스트를 상시 검증하고, 실기기 검증만 PO가 수동 수행.
- 장점: 실기기가 필요한 항목(Sprint 3·5)과 그 외를 깔끔히 분리할 수 있다.
- 단점: 비용과 설정 부담이 가장 크다.

> **어떤 안을 택하든 Sprint 0은 AC-1/AC-2가 확인되기 전까지 `DONE`이 아니다.**

---

## D-002. 저장소 위치: 기존 `musi0905-cloud/App`의 `ios/` 하위에 배치

- **Sprint**: 0
- **상태**: **제안 (PO 결정 필요)**
- **문제 구분**: D — 제품 결정 필요

### 배경

작업 대상으로 지정된 저장소 `musi0905-cloud/App`에는 이미 「쉼」과 **무관한 Google Apps Script 프로젝트**가 있다.

```
Code.gs          (105 KB)
Index.html
Scripts.html
Styles.html
appsscript.json
```

기본 브랜치는 `claude/ai-business-webapp-u1xuwo`이며, 커밋 이력도 전부 해당 웹앱 관련이다.
이번 작업 브랜치 `claude/shim-ios-sprint-0-setup-aalbvo`는 그 위에서 분기되어 있다.

### 결정 (잠정)

- **기존 파일은 하나도 삭제·수정하지 않는다.**
- 「쉼」 iOS 프로젝트는 `ios/` 디렉터리 아래에만 둔다.
- 기준 문서(`CLAUDE.md`, `docs/`)는 운영규칙 §13이 지정한 대로 저장소 루트에 둔다.
- `README.md`에 저장소가 서로 무관한 두 프로젝트를 담고 있음을 명시한다.

### PO 결정 필요

「쉼」 iOS 프로젝트를 **별도 저장소**(예: `musi0905-cloud/shim-ios`)로 분리할지 여부.

- **분리 시 장점**: 이력·이슈·CI가 섞이지 않는다. iOS CI를 저장소 전체에 적용할 수 있다. `.gitignore`와 루트 문서가 한 프로젝트만 설명한다.
- **분리 시 단점**: 새 저장소 생성 및 접근 권한 설정이 필요하다. 이미 만든 커밋을 옮겨야 한다.
- **유지 시 장점**: 지금 바로 진행 가능하다.
- **유지 시 단점**: 루트 `CLAUDE.md`·`.gitignore`가 무관한 Apps Script 프로젝트에도 적용되어 혼선이 생길 수 있다.

> Claude Code는 PO 승인 없이 새 저장소를 만들거나 기존 파일을 삭제하지 않는다. — **B-001**

---

## D-003. iOS 배포 타깃: iOS 17.0

- **Sprint**: 0
- **상태**: **제안 (PO 확인 필요)**
- **문제 구분**: B — 플랫폼 제약

### 근거

`docs/IOS_SPEC.md` §3은 "최신 안정 Xcode가 권장하는 현실적인 배포 타깃을 사용하고 **실제 장비 테스트 가능성을 우선**한다"고 규정한다.

- iOS 17.0은 이 프로젝트가 필요로 하는 API(`Observation`, SwiftUI `NavigationStack`, `AVAudioSession`, `UNUserNotificationCenter`, `UIScreen.brightness`)를 모두 포함한다.
- 최신 최소버전으로 올리면 PO가 보유한 실기기가 대상에서 빠질 위험이 있다. iOS 17.0은 그 위험이 낮다.

### 확인 필요

PO가 실기기 검증에 사용할 iPhone의 실제 iOS 버전. 해당 버전이 17.0 미만이면 이 값을 낮춰야 한다.

변경 지점: `ios/project.yml`의 `deploymentTarget`, `ios/Shim.xcodeproj/project.pbxproj`의 `IPHONEOS_DEPLOYMENT_TARGET`.

---

## D-004. 코드 서명: Team ID를 저장소에 커밋하지 않는다

- **Sprint**: 0
- **상태**: 확정
- **문제 구분**: B/C

### 결정

- `CODE_SIGN_STYLE = Automatic`, `DEVELOPMENT_TEAM = ""` (빈 값)으로 커밋한다.
- 실기기 배포가 필요한 시점(Sprint 3 이후)에 PO가 Xcode의 Signing & Capabilities에서 자신의 Team을 선택한다.
- Xcode가 `project.pbxproj`에 Team ID를 기록할 수 있으므로, 커밋 전 `git diff`로 확인한다.
- `.p12`, `.mobileprovision`, `AuthKey_*.p8` 등 서명 관련 파일은 `.gitignore`에서 차단된다.

### Apple Developer Program 필요 여부

| 목적 | 유료 프로그램 필요 |
|---|---|
| Simulator 빌드·실행 | **불필요** |
| 실기기 설치 (개인 개발자 계정, 7일 만료) | 불필요 |
| Background Audio 등 capability 실기기 검증 | 실기기 설치가 되면 가능 |
| TestFlight 배포, App Store 심사 | **필요 (연 $99)** |

> Sprint 3(Audio PoC)의 실기기 검증부터는 최소한 무료 개인 계정으로 기기 등록이 필요하다.

---

## D-005. Swift 언어 모드: Swift 5 모드로 시작

- **Sprint**: 0
- **상태**: 제안
- **문제 구분**: C

### 결정

`SWIFT_VERSION = 5.0`으로 시작한다.

- Swift 6 언어 모드의 엄격한 동시성 검사는 Sprint 2~6(타이머·오디오·밝기 Service의 액터 경계 설계)에서 대량의 컴파일 오류를 유발할 수 있다.
- 운영규칙 §4 "현재 필요하지 않은 과도한 추상화 도입을 피한다"에 따라, 실행 흐름이 안정화된 뒤 Swift 6 모드 전환을 별도로 검토한다.
- `docs/IOS_SPEC.md` §3의 "Swift Concurrency 우선" 원칙은 언어 모드와 무관하게 유지한다 (`async/await`, `Task`, `actor` 사용).

---

## D-006. Xcode 프로젝트 파일 생성 방식: 수기 작성 + XcodeGen 스펙 병행

- **Sprint**: 0
- **상태**: 확정
- **문제 구분**: C

### 배경

이 환경에는 Xcode가 없어 `.xcodeproj`를 Xcode로 생성할 수 없다.

### 결정

두 가지를 함께 커밋한다.

1. **`ios/Shim.xcodeproj/project.pbxproj`** — 수기로 작성한 Xcode 프로젝트 파일.
   - `objectVersion = 77` (Xcode 16+ 포맷)
   - `PBXFileSystemSynchronizedRootGroup` 사용 → 소스 파일을 개별 등록하지 않고 디렉터리 전체를 동기화.
     **Sprint 1 이후 파일을 추가해도 `project.pbxproj`를 수정할 필요가 없다.**
   - 공유 스킴 `Shim.xcscheme`를 `xcshareddata/`에 포함 → `xcodebuild -scheme Shim` 사용 가능.
2. **`ios/project.yml`** — XcodeGen 스펙 (동일 구성의 선언적 정의).
   - `.xcodeproj`가 손상되거나 Xcode 버전 문제로 열리지 않으면 `xcodegen generate`로 재생성한다.

### 알려진 리스크

- **`PBXFileSystemSynchronizedRootGroup`은 Xcode 16 이상에서만 인식된다.** Xcode 15 이하에서는 열리지 않는다.
  → 이 경우 `ios/project.yml` + XcodeGen으로 재생성하거나, Xcode에서 새 프로젝트를 만들고 `ios/Shim/` 소스를 드래그해 넣는다.
- 수기 작성한 `project.pbxproj`는 **Xcode로 열어 확인하기 전까지 정상 동작을 보장할 수 없다.** (D-001)
  → `scripts/verify_repo.py`가 구조·참조 정합성만 정적으로 검사한다. 이는 빌드 검증이 아니다.

---

## D-007. 테스트 프레임워크: XCTest

- **Sprint**: 0
- **상태**: 제안
- **문제 구분**: C

### 결정

유닛 테스트는 **XCTest**로 작성한다.

- Swift Testing(`import Testing`)은 Xcode 16+ 전용이다. XCTest는 모든 Xcode 버전과 CI에서 동작한다.
- D-006의 Xcode 15 이하 fallback 경로에서도 테스트 타깃이 그대로 동작해야 한다.
- Swift Testing 전환은 Xcode 버전이 확정된 뒤 별도로 검토한다.
